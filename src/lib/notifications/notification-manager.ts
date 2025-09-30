import { Q } from '@nozbe/watermelondb';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { NotificationErrorType } from '@/lib/notification-errors';
import {
  type AndroidChannelKey,
  registerAndroidChannels,
} from '@/lib/notifications/android-channels';
import { DeepLinkService } from '@/lib/notifications/deep-link-service';
import { registerNotificationCategories } from '@/lib/notifications/ios-categories';
import { LocalNotificationService } from '@/lib/notifications/local-service';
import { PushNotificationService } from '@/lib/notifications/push-service';
import { PermissionManager } from '@/lib/permissions/permission-manager';
import { captureCategorizedErrorSync } from '@/lib/sentry-utils';
import { supabase } from '@/lib/supabase';

const DEFAULT_PREFERENCES: NotificationPreferencesSnapshot = {
  communityInteractions: true,
  communityLikes: true,
  cultivationReminders: true,
  systemUpdates: true,
  quietHoursEnabled: false,
  quietHoursStart: null,
  quietHoursEnd: null,
};

type InitializeOptions = {
  userId?: string;
  projectId?: string;
  onDeepLinkFailure?: (reason: string) => void;
  ensureAuthenticated?: () => Promise<boolean>;
  stashRedirect?: (url: string) => Promise<void> | void;
};

type RequestPermissionResult = {
  granted: boolean;
  error?: NotificationErrorType;
};

export type NotificationPreferencesSnapshot = {
  communityInteractions: boolean;
  communityLikes: boolean;
  cultivationReminders: boolean;
  systemUpdates: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
};

let responseSubscription: { remove: () => void } | null = null;
let currentUserId: string | undefined;
let currentProjectId: string | undefined;
let listenerUserId: string | null = null;

export const NotificationManager = {
  async initialize(options: InitializeOptions = {}): Promise<void> {
    currentUserId = options.userId ?? currentUserId;
    currentProjectId = options.projectId ?? currentProjectId;

    if (Platform.OS === 'ios') {
      await registerNotificationCategories();
    }

    const permissionGranted =
      await PermissionManager.isNotificationPermissionGranted();
    if (permissionGranted) {
      await registerAndroidChannels();
    }

    subscribeToNotificationResponses({
      ensureAuthenticated: options.ensureAuthenticated,
      stashRedirect: options.stashRedirect,
      onDeepLinkFailure: options.onDeepLinkFailure,
    });

    if (permissionGranted && currentUserId) {
      await PushNotificationService.registerDeviceToken({
        userId: currentUserId,
        projectId: currentProjectId,
      });
      await ensureTokenListener();
    }
  },

  async requestPermissions(): Promise<RequestPermissionResult> {
    const result = await PermissionManager.requestNotificationPermission();
    if (result === 'granted') {
      await registerAndroidChannels();
      if (currentUserId) {
        await PushNotificationService.registerDeviceToken({
          userId: currentUserId,
          projectId: currentProjectId,
        });
        await ensureTokenListener();
      }
      return { granted: true };
    }
    if (result === 'denied') {
      return { granted: false, error: NotificationErrorType.PERMISSION_DENIED };
    }
    return { granted: false, error: NotificationErrorType.NETWORK_ERROR };
  },

  async registerCurrentUser(
    userId: string,
    options?: { projectId?: string }
  ): Promise<void> {
    currentUserId = userId;
    if (options?.projectId) currentProjectId = options.projectId;
    const granted = await PermissionManager.isNotificationPermissionGranted();
    if (granted) {
      await PushNotificationService.registerDeviceToken({
        userId,
        projectId: currentProjectId,
      });
      await ensureTokenListener();
    }
    await ensurePreferencesRecord(userId);
  },

  async getPreferences(): Promise<NotificationPreferencesSnapshot> {
    if (!currentUserId) return { ...DEFAULT_PREFERENCES };
    return getPreferencesForUser(currentUserId);
  },

  async updatePreferences(
    partial: Partial<NotificationPreferencesSnapshot>
  ): Promise<void> {
    if (!currentUserId) return;
    await upsertPreferences(currentUserId, partial);
    await syncPreferencesRemote(currentUserId);
  },

  async scheduleLocalReminder(request: {
    title: string;
    body: string;
    data?: Record<string, unknown>;
    triggerDate: Date;
    androidChannelKey?: AndroidChannelKey;
    threadId?: string;
  }): Promise<string> {
    return LocalNotificationService.scheduleExactNotification({
      title: request.title,
      body: request.body,
      data: request.data,
      triggerDate: request.triggerDate,
      androidChannelKey: request.androidChannelKey,
      threadId: request.threadId,
    });
  },

  dispose(): void {
    if (responseSubscription) {
      responseSubscription.remove();
      responseSubscription = null;
    }
    PushNotificationService.stopTokenListener();
    listenerUserId = null;
  },
};

async function getPreferencesForUser(
  userId: string
): Promise<NotificationPreferencesSnapshot> {
  const { database } = await import('@/lib/watermelon');
  const collection = database.collections.get(
    'notification_preferences' as any
  );
  const records = (await (collection as any)
    .query(Q.where('user_id', userId))
    .fetch()) as any[];

  if (records.length === 0) {
    return { ...DEFAULT_PREFERENCES };
  }

  const record = records[0];
  return {
    communityInteractions: Boolean(record.communityInteractions),
    communityLikes: Boolean(record.communityLikes),
    cultivationReminders: Boolean(record.cultivationReminders),
    systemUpdates: Boolean(record.systemUpdates),
    quietHoursEnabled: Boolean(record.quietHoursEnabled),
    quietHoursStart: record.quietHoursStart ?? null,
    quietHoursEnd: record.quietHoursEnd ?? null,
  };
}

async function upsertPreferences(
  userId: string,
  partial: Partial<NotificationPreferencesSnapshot>
): Promise<void> {
  const { database } = await import('@/lib/watermelon');
  const collection = database.collections.get(
    'notification_preferences' as any
  );
  const Q = (await import('@nozbe/watermelondb')).Q;
  const matches = (await (collection as any)
    .query(Q.where('user_id', userId))
    .fetch()) as any[];
  if (matches.length > 0) {
    await database.write(async () => {
      await matches[0].update((model: any) => {
        Object.assign(model, {
          communityInteractions:
            partial.communityInteractions ?? model.communityInteractions,
          communityLikes: partial.communityLikes ?? model.communityLikes,
          cultivationReminders:
            partial.cultivationReminders ?? model.cultivationReminders,
          systemUpdates: partial.systemUpdates ?? model.systemUpdates,
          quietHoursEnabled:
            partial.quietHoursEnabled ?? model.quietHoursEnabled,
          quietHoursStart:
            partial.quietHoursStart ?? model.quietHoursStart ?? null,
          quietHoursEnd: partial.quietHoursEnd ?? model.quietHoursEnd ?? null,
          updatedAt: new Date(),
        });
      });
    });
    return;
  }

  const defaults = { ...DEFAULT_PREFERENCES, ...partial };
  await database.write(async () => {
    await (collection as any).create((model: any) => {
      model.userId = userId;
      model.communityInteractions = defaults.communityInteractions;
      model.communityLikes = defaults.communityLikes;
      model.cultivationReminders = defaults.cultivationReminders;
      model.systemUpdates = defaults.systemUpdates;
      model.quietHoursEnabled = defaults.quietHoursEnabled;
      model.quietHoursStart = defaults.quietHoursStart;
      model.quietHoursEnd = defaults.quietHoursEnd;
      model.updatedAt = new Date();
    });
  });
}

async function ensurePreferencesRecord(userId: string): Promise<void> {
  const { database } = await import('@/lib/watermelon');
  const collection = database.collections.get(
    'notification_preferences' as any
  );
  const matches = (await (collection as any)
    .query(Q.where('user_id', userId))
    .fetch()) as any[];
  if (matches.length === 0) {
    await upsertPreferences(userId, DEFAULT_PREFERENCES);
  }
}

async function syncPreferencesRemote(userId: string): Promise<void> {
  if (getIsTestEnvironment()) return;
  try {
    const prefs = await getPreferencesForUser(userId);
    await supabase.from('notification_preferences').upsert(
      {
        user_id: userId,
        community_interactions: prefs.communityInteractions,
        community_likes: prefs.communityLikes,
        cultivation_reminders: prefs.cultivationReminders,
        system_updates: prefs.systemUpdates,
        quiet_hours_enabled: prefs.quietHoursEnabled,
        quiet_hours_start: prefs.quietHoursStart,
        quiet_hours_end: prefs.quietHoursEnd,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );
  } catch (error) {
    captureCategorizedErrorSync(error);
  }
}

function subscribeToNotificationResponses(options: {
  ensureAuthenticated?: () => Promise<boolean>;
  stashRedirect?: (url: string) => Promise<void> | void;
  onDeepLinkFailure?: (reason: string) => void;
}): void {
  if (responseSubscription) return;
  const anyNotifications: any = Notifications as any;
  responseSubscription =
    anyNotifications.addNotificationResponseReceivedListener(
      async (response: any) => {
        const deepLink = (response.notification.request.content.data as any)
          ?.deepLink as string | undefined;
        if (!deepLink) return;
        const result = await DeepLinkService.handle(deepLink, {
          ensureAuthenticated: options.ensureAuthenticated,
          stashRedirect: options.stashRedirect,
          onInvalid: options.onDeepLinkFailure,
        });
        if (!result.ok && options.onDeepLinkFailure) {
          options.onDeepLinkFailure(result.reason);
        }
      }
    );
}

function getIsTestEnvironment(): boolean {
  return (
    typeof process !== 'undefined' && process.env?.JEST_WORKER_ID !== undefined
  );
}

async function ensureTokenListener(): Promise<void> {
  if (!currentUserId) return;
  const permissionGranted =
    await PermissionManager.isNotificationPermissionGranted();
  if (!permissionGranted) return;
  if (listenerUserId && listenerUserId !== currentUserId) {
    PushNotificationService.stopTokenListener();
    listenerUserId = null;
  }
  if (listenerUserId === currentUserId) return;
  await PushNotificationService.startTokenListener({
    userId: currentUserId,
    projectId: currentProjectId,
  });
  listenerUserId = currentUserId;
}
