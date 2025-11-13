import type { Database } from '@nozbe/watermelondb';
import { Q } from '@nozbe/watermelondb';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { NotificationErrorType } from '@/lib/notification-errors';
import { captureCategorizedErrorSync } from '@/lib/sentry-utils';
import { supabase } from '@/lib/supabase';
import type { DeviceTokenModel } from '@/lib/watermelon-models/device-token';

type WatermelonModule = {
  database: Database;
};

const EXPONENT_TOKEN_PREFIX = 'ExponentPushToken[';

type RegisterTokenOptions = {
  userId: string;
  projectId?: string;
};

type RegisterResult = {
  token: string | null;
  error?: NotificationErrorType;
};

type TokenListenerOptions = {
  userId: string;
  projectId?: string;
};

let tokenSubscription: { remove: () => void } | null = null;
let currentListenerUserId: string | null = null;

// Export for testing
export const __testResetGlobals = () => {
  tokenSubscription = null;
  currentListenerUserId = null;
};

export const PushNotificationService = {
  async registerDeviceToken(
    options: RegisterTokenOptions
  ): Promise<RegisterResult> {
    try {
      const token = await getExpoPushToken(options.projectId);
      if (!token) {
        return {
          token: null,
          error: NotificationErrorType.TOKEN_REFRESH_FAILED,
        };
      }
      await persistAndSyncToken({
        token,
        userId: options.userId,
      });
      return { token };
    } catch (error) {
      captureCategorizedErrorSync(error);
      return { token: null, error: NotificationErrorType.TOKEN_REFRESH_FAILED };
    }
  },

  async markTokenInactive(token: string): Promise<void> {
    await updateTokenActiveState(token, false);
    await markTokenInactiveRemote(token);
  },

  async trackNotificationOpened(messageId: string): Promise<void> {
    if (!messageId) return;
    const isTest = getIsTestEnvironment();
    if (isTest) return;
    try {
      await supabase.rpc('track_notification_opened', {
        message_id: messageId,
      });
    } catch (error) {
      captureCategorizedErrorSync(error);
    }
  },

  async startTokenListener(options: TokenListenerOptions): Promise<void> {
    // If we already have a listener for the same user, nothing to do
    if (tokenSubscription && currentListenerUserId === options.userId) return;

    // If we have a listener for a different user, stop it first
    if (tokenSubscription) {
      tokenSubscription.remove();
      tokenSubscription = null;
    }

    // Create new listener for the current user
    tokenSubscription = Notifications.addPushTokenListener(
      async (payload: unknown) => {
        const nextToken = extractTokenString(payload);
        if (!nextToken) return;
        try {
          await persistAndSyncToken({
            token: nextToken,
            userId: options.userId,
          });
        } catch (error) {
          captureCategorizedErrorSync(error);
        }
      }
    );

    currentListenerUserId = options.userId;
  },

  stopTokenListener(): void {
    if (!tokenSubscription) return;
    tokenSubscription.remove();
    tokenSubscription = null;
    currentListenerUserId = null;
  },
};

async function getExpoPushToken(projectId?: string): Promise<string | null> {
  try {
    const resolvedProjectId = projectId ?? resolveExpoProjectId();
    const tokenResponse = resolvedProjectId
      ? await Notifications.getExpoPushTokenAsync({
          projectId: resolvedProjectId,
        })
      : await Notifications.getExpoPushTokenAsync();
    const token = sanitizeToken(tokenResponse?.data);
    if (!token) return null;
    return token;
  } catch (error) {
    captureCategorizedErrorSync(error);
    return null;
  }
}

async function upsertLocalToken(token: string, userId: string): Promise<void> {
  const { database } = await loadWatermelonDatabase();
  const collection =
    database.collections.get<DeviceTokenModel>('device_tokens');
  const existing = await collection.query(Q.where('token', token)).fetch();
  if (existing.length > 0) {
    try {
      await database.write(async () => {
        await existing[0].update((model) => {
          model.userId = userId;
          model.lastUsedAt = new Date();
          model.isActive = true;
        });
      });
    } catch (error) {
      captureCategorizedErrorSync(error, {
        operation: 'update_device_token',
        token: token.substring(0, 10) + '...', // Truncate for privacy
        userId,
      });
      throw error;
    }
    return;
  }
  try {
    await database.write(async () => {
      await collection.create((model) => {
        model.token = token;
        model.platform = Platform.OS;
        model.userId = userId;
        model.createdAt = new Date();
        model.lastUsedAt = new Date();
        model.isActive = true;
      });
    });
  } catch (error) {
    captureCategorizedErrorSync(error, {
      operation: 'create_device_token',
      token: token.substring(0, 10) + '...', // Truncate for privacy
      userId,
    });
    throw error;
  }
}

async function updateTokenActiveState(
  token: string,
  isActive: boolean
): Promise<void> {
  const { database } = await loadWatermelonDatabase();
  const collection =
    database.collections.get<DeviceTokenModel>('device_tokens');
  const matches = await collection.query(Q.where('token', token)).fetch();
  if (matches.length === 0) return;
  try {
    await database.write(async () => {
      await matches[0].update((model) => {
        model.isActive = isActive;
        model.lastUsedAt = new Date();
      });
    });
  } catch (error) {
    captureCategorizedErrorSync(error, {
      operation: 'update_token_active_state',
      token: token.substring(0, 10) + '...', // Truncate for privacy
      isActive,
    });
    throw error;
  }
}

async function markTokenInactiveRemote(token: string): Promise<void> {
  if (getIsTestEnvironment()) return;
  try {
    await supabase
      .from('push_tokens')
      .update({ is_active: false, last_used_at: new Date().toISOString() })
      .eq('token', token);
  } catch (error) {
    captureCategorizedErrorSync(error);
  }
}

function resolveExpoProjectId(): string | undefined {
  const config = Constants.expoConfig as
    | (typeof Constants.expoConfig & { id?: string })
    | undefined;
  return (
    config?.extra?.eas?.projectId ||
    config?.extra?.expoClientId ||
    config?.currentFullName ||
    config?.id ||
    undefined
  );
}

function getIsTestEnvironment(): boolean {
  return (
    typeof process !== 'undefined' && process.env?.JEST_WORKER_ID !== undefined
  );
}

async function persistAndSyncToken({
  token,
  userId,
}: {
  token: string;
  userId: string;
}): Promise<void> {
  const normalized = sanitizeToken(token);
  if (!normalized) return;
  await upsertLocalToken(normalized, userId);
  await deactivateOtherLocalTokens(normalized, userId);
  await syncTokenWithSupabase(normalized, userId);
}

async function deactivateOtherLocalTokens(
  activeToken: string,
  userId: string
): Promise<void> {
  const { database } = await loadWatermelonDatabase();
  const collection =
    database.collections.get<DeviceTokenModel>('device_tokens');
  const matches = await collection.query(Q.where('user_id', userId)).fetch();
  const stale = matches.filter((model) => model.token !== activeToken);
  if (stale.length === 0) return;
  try {
    await database.write(async () => {
      await Promise.all(
        stale.map((model) =>
          model.update((entry) => {
            entry.isActive = false;
            entry.lastUsedAt = new Date();
          })
        )
      );
    });
  } catch (error) {
    captureCategorizedErrorSync(error, {
      operation: 'deactivate_stale_tokens',
      activeToken: activeToken.substring(0, 10) + '...', // Truncate for privacy
      userId,
      staleCount: stale.length,
    });
    throw error;
  }
}

async function syncTokenWithSupabase(
  token: string,
  userId: string
): Promise<void> {
  if (getIsTestEnvironment()) return;
  try {
    const nowIso = new Date().toISOString();

    // Use atomic RPC to prevent race conditions between deactivation and upsert
    // This ensures all operations happen within a single database transaction
    await supabase.rpc('upsert_push_token', {
      p_user_id: userId,
      p_token: token,
      p_platform: Platform.OS,
      p_last_used_at: nowIso,
    });
  } catch (error) {
    captureCategorizedErrorSync(error);
  }
}

function sanitizeToken(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith(EXPONENT_TOKEN_PREFIX)) {
    return trimmed;
  }
  return trimmed;
}

function extractTokenString(payload: unknown): string | null {
  if (typeof payload === 'string') {
    return sanitizeToken(payload);
  }
  if (payload && typeof payload === 'object') {
    const maybeData = (payload as Record<string, unknown>).data;
    if (typeof maybeData === 'string') {
      return sanitizeToken(maybeData);
    }
    if (maybeData && typeof maybeData === 'object') {
      const dataObj = maybeData as Record<string, unknown>;
      const nested = dataObj.token ?? dataObj.data;
      if (typeof nested === 'string') {
        return sanitizeToken(nested);
      }
    }
  }
  return null;
}

async function loadWatermelonDatabase(): Promise<WatermelonModule> {
  const loader =
    typeof globalThis !== 'undefined'
      ? (
          globalThis as typeof globalThis & {
            __growbroWatermelonLoader?: () => Promise<WatermelonModule>;
          }
        ).__growbroWatermelonLoader
      : undefined;
  if (loader) {
    return loader();
  }
  const module = (await import(
    '@/lib/watermelon'
  )) as unknown as WatermelonModule;
  return module;
}
