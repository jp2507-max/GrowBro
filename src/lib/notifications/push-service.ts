import { Q } from '@nozbe/watermelondb';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { NotificationErrorType } from '@/lib/notification-errors';
import { captureCategorizedErrorSync } from '@/lib/sentry-utils';
import { supabase } from '@/lib/supabase';

type WatermelonModule = {
  database: any;
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
    if (tokenSubscription) return;
    const anyNotifications: any = Notifications as any;
    tokenSubscription = anyNotifications.addPushTokenListener(
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
  },

  stopTokenListener(): void {
    if (!tokenSubscription) return;
    tokenSubscription.remove();
    tokenSubscription = null;
  },
};

async function getExpoPushToken(projectId?: string): Promise<string | null> {
  try {
    const resolvedProjectId = projectId ?? resolveExpoProjectId();
    const anyNotifications: any = Notifications as any;
    const tokenResponse = resolvedProjectId
      ? await anyNotifications.getExpoPushTokenAsync({
          projectId: resolvedProjectId,
        })
      : await anyNotifications.getExpoPushTokenAsync();
    const token = sanitizeToken((tokenResponse as any)?.data);
    if (!token) return null;
    return token;
  } catch (error) {
    captureCategorizedErrorSync(error);
    return null;
  }
}

async function upsertLocalToken(token: string, userId: string): Promise<void> {
  const { database } = await loadWatermelonDatabase();
  const collection = database.collections.get('device_tokens' as any);
  const existing = (await (collection as any)
    .query(Q.where('token', token))
    .fetch()) as any[];
  if (existing.length > 0) {
    await database.write(async () => {
      await existing[0].update((model: any) => {
        model.userId = userId;
        model.lastUsedAt = new Date();
        model.isActive = true;
      });
    });
    return;
  }
  await database.write(async () => {
    await (collection as any).create((model: any) => {
      model.token = token;
      model.platform = Platform.OS;
      model.userId = userId;
      model.createdAt = new Date();
      model.lastUsedAt = new Date();
      model.isActive = true;
    });
  });
}

async function updateTokenActiveState(
  token: string,
  isActive: boolean
): Promise<void> {
  const { database } = await loadWatermelonDatabase();
  const collection = database.collections.get('device_tokens' as any);
  const matches = (await (collection as any)
    .query(Q.where('token', token))
    .fetch()) as any[];
  if (matches.length === 0) return;
  await database.write(async () => {
    await matches[0].update((model: any) => {
      model.isActive = isActive;
      model.lastUsedAt = new Date();
    });
  });
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
  const config: any = (Constants as any)?.expoConfig;
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
  const collection = database.collections.get('device_tokens' as any);
  const matches = (await (collection as any)
    .query(Q.where('user_id', userId))
    .fetch()) as any[];
  const stale = matches.filter((model: any) => model.token !== activeToken);
  if (stale.length === 0) return;
  await database.write(async () => {
    await Promise.all(
      stale.map((model: any) =>
        model.update((entry: any) => {
          entry.isActive = false;
          entry.lastUsedAt = new Date();
        })
      )
    );
  });
}

async function syncTokenWithSupabase(
  token: string,
  userId: string
): Promise<void> {
  if (getIsTestEnvironment()) return;
  try {
    const nowIso = new Date().toISOString();
    await supabase.from('push_tokens').upsert(
      {
        user_id: userId,
        token,
        platform: Platform.OS,
        last_used_at: nowIso,
        is_active: true,
      },
      { onConflict: 'user_id,token' }
    );
    await supabase
      .from('push_tokens')
      .update({ is_active: false, last_used_at: nowIso })
      .eq('user_id', userId)
      .eq('platform', Platform.OS)
      .neq('token', token);
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
    const maybeData = (payload as any).data;
    if (typeof maybeData === 'string') {
      return sanitizeToken(maybeData);
    }
    if (maybeData && typeof maybeData === 'object') {
      const nested = (maybeData as any).token ?? (maybeData as any).data;
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
