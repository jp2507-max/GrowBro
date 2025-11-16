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
import { PushReceiverService } from '@/lib/notifications/push-receiver-service';
import { PushNotificationService } from '@/lib/notifications/push-service';
import { PermissionManager } from '@/lib/permissions/permission-manager';
import { captureCategorizedErrorSync } from '@/lib/sentry-utils';
import { supabase } from '@/lib/supabase';
import type { NotificationPreferenceModel } from '@/lib/watermelon-models/notification-preference';

// Subscription type that supports both remove and unsubscribe
type NotificationSubscription = {
  remove?: () => void;
  unsubscribe?: () => void;
};

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

class NotificationManager {
  private responseSubscription: NotificationSubscription | null = null;
  private currentUserId: string | undefined;
  private currentProjectId: string | undefined;
  private listenerUserId: string | null = null;

  // Mutex for serializing critical operations
  private operationQueue: (() => Promise<unknown>)[] = [];
  private isProcessingQueue = false;
  private isDisposed = false;

  async initialize(options: InitializeOptions = {}): Promise<void> {
    return this.enqueueOperation(async () => {
      if (this.isDisposed) return;

      this.currentUserId = options.userId ?? this.currentUserId;
      this.currentProjectId = options.projectId ?? this.currentProjectId;

      if (Platform.OS === 'ios') {
        await registerNotificationCategories();
      }

      const permissionGranted =
        await PermissionManager.isNotificationPermissionGranted();
      if (permissionGranted) {
        await registerAndroidChannels();
      }

      // Setup push notification handlers for foreground/background
      await PushReceiverService.setupNotificationHandlers();

      this.subscribeToNotificationResponses({
        ensureAuthenticated: options.ensureAuthenticated,
        stashRedirect: options.stashRedirect,
        onDeepLinkFailure: options.onDeepLinkFailure,
      });

      if (permissionGranted && this.currentUserId) {
        try {
          await PushNotificationService.registerDeviceToken({
            userId: this.currentUserId,
            projectId: this.currentProjectId,
          });
          await this.ensureTokenListener();
        } catch (error) {
          captureCategorizedErrorSync(error, {
            category: 'notification',
            message: 'Device token registration failed during initialization',
            context: {
              userId: this.currentUserId,
              projectId: this.currentProjectId,
            },
          });
        }
      }
    });
  }

  async requestPermissions(): Promise<RequestPermissionResult> {
    return this.enqueueOperation(async () => {
      if (this.isDisposed)
        return {
          granted: false,
          error: NotificationErrorType.PERMISSION_DENIED,
        };

      const result = await PermissionManager.requestNotificationPermission();
      if (result === 'granted') {
        await registerAndroidChannels();
        if (this.currentUserId) {
          try {
            await PushNotificationService.registerDeviceToken({
              userId: this.currentUserId,
              projectId: this.currentProjectId,
            });
            await this.ensureTokenListener();
          } catch (error) {
            captureCategorizedErrorSync(error, {
              category: 'notification',
              message:
                'Device token registration failed after permission granted',
              context: {
                userId: this.currentUserId,
                projectId: this.currentProjectId,
              },
            });
            return {
              granted: false,
              error: NotificationErrorType.NETWORK_ERROR,
            };
          }
        }
        return { granted: true };
      }
      if (result === 'denied') {
        return {
          granted: false,
          error: NotificationErrorType.PERMISSION_DENIED,
        };
      }
      return { granted: false, error: NotificationErrorType.NETWORK_ERROR };
    });
  }

  async registerCurrentUser(
    userId: string,
    options?: { projectId?: string }
  ): Promise<void> {
    return this.enqueueOperation(async () => {
      if (this.isDisposed) return;

      this.currentUserId = userId;
      if (options?.projectId) this.currentProjectId = options.projectId;
      const granted = await PermissionManager.isNotificationPermissionGranted();
      if (granted) {
        try {
          await PushNotificationService.registerDeviceToken({
            userId,
            projectId: this.currentProjectId,
          });
          await this.ensureTokenListener();
        } catch (error) {
          captureCategorizedErrorSync(error, {
            category: 'notification',
            message:
              'Device token registration failed during user registration',
            context: {
              userId,
              projectId: this.currentProjectId,
            },
          });
        }
      }
      await ensurePreferencesRecord(userId);
    });
  }

  async getPreferences(): Promise<NotificationPreferencesSnapshot> {
    if (!this.currentUserId) return { ...DEFAULT_PREFERENCES };
    return getPreferencesForUser(this.currentUserId);
  }

  async updatePreferences(
    partial: Partial<NotificationPreferencesSnapshot>
  ): Promise<boolean> {
    if (!this.currentUserId) return true;
    await upsertPreferences(this.currentUserId, partial);
    return syncPreferencesRemote(this.currentUserId);
  }

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
  }

  dispose(): void {
    this.isDisposed = true;
    if (this.responseSubscription) {
      this.responseSubscription.remove?.();
      this.responseSubscription = null;
    }
    PushReceiverService.removeNotificationHandlers();
    PushNotificationService.stopTokenListener();
    this.listenerUserId = null;
  }

  // Private methods converted from module-level functions
  private subscribeToNotificationResponses(options: {
    ensureAuthenticated?: () => Promise<boolean>;
    stashRedirect?: (url: string) => Promise<void> | void;
    onDeepLinkFailure?: (reason: string) => void;
  }): void {
    // Dispose of existing subscription before creating a new one
    if (this.responseSubscription) {
      if (typeof this.responseSubscription.remove === 'function') {
        this.responseSubscription.remove();
      } else if (typeof this.responseSubscription.unsubscribe === 'function') {
        this.responseSubscription.unsubscribe();
      }
      this.responseSubscription = null;
    }

    this.responseSubscription =
      Notifications.addNotificationResponseReceivedListener(
        async (response: Notifications.NotificationResponse) => {
          const data = response.notification.request.content.data as
            | Record<string, unknown>
            | undefined;
          const deepLink = data?.deepLink as string | undefined;
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

  private async ensureTokenListener(): Promise<void> {
    if (!this.currentUserId) return;
    const permissionGranted =
      await PermissionManager.isNotificationPermissionGranted();
    if (!permissionGranted) return;

    // If we already have a listener for the current user, nothing to do
    if (this.listenerUserId === this.currentUserId) return;

    // If switching users, start new listener (startTokenListener handles stopping old one internally)
    if (this.listenerUserId && this.listenerUserId !== this.currentUserId) {
      try {
        await PushNotificationService.startTokenListener({
          userId: this.currentUserId,
          projectId: this.currentProjectId,
        });
        this.listenerUserId = this.currentUserId;
      } catch (error) {
        // On failure, keep the existing listener active and log the error
        captureCategorizedErrorSync(error, {
          category: 'notification',
          message:
            'Failed to start token listener for new user, keeping existing listener active',
          context: {
            currentUserId: this.currentUserId,
            existingListenerUserId: this.listenerUserId,
            projectId: this.currentProjectId,
          },
        });
        // Don't change listenerUserId - existing listener remains active
        return;
      }
    } else {
      // No existing listener, just start a new one
      try {
        await PushNotificationService.startTokenListener({
          userId: this.currentUserId,
          projectId: this.currentProjectId,
        });
        this.listenerUserId = this.currentUserId;
      } catch (error) {
        captureCategorizedErrorSync(error, {
          category: 'notification',
          message: 'Failed to start token listener',
          context: {
            userId: this.currentUserId,
            projectId: this.currentProjectId,
          },
        });
        // listenerUserId remains null/undefined
        throw error; // Re-throw for caller to handle
      }
    }
  }

  // Mutex implementation using operation queue
  private async enqueueOperation<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.operationQueue.push(async () => {
        try {
          const result = await operation();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.operationQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      while (this.operationQueue.length > 0) {
        const operation = this.operationQueue.shift()!;
        try {
          await operation();
        } catch {
          // The promise returned by enqueueOperation already sees the rejection;
          // keep draining the queue instead of killing the processor.
        }
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }
}

// Factory function for creating instances
export function createNotificationManager(): NotificationManager {
  return new NotificationManager();
}

// Singleton instance for backward compatibility
let singletonInstance: NotificationManager | null = null;

export function getNotificationManager(): NotificationManager {
  if (!singletonInstance) {
    singletonInstance = new NotificationManager();
  }
  return singletonInstance;
}

// Export the class for direct instantiation if needed
export { NotificationManager };

async function getPreferencesForUser(
  userId: string
): Promise<NotificationPreferencesSnapshot> {
  const { database } = await import('@/lib/watermelon');
  const collection = database.collections.get<NotificationPreferenceModel>(
    'notification_preferences'
  );
  const records = await collection.query(Q.where('user_id', userId)).fetch();

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
  const collection = database.collections.get<NotificationPreferenceModel>(
    'notification_preferences'
  );
  const Q = (await import('@nozbe/watermelondb')).Q;
  const matches = await collection.query(Q.where('user_id', userId)).fetch();
  if (matches.length > 0) {
    await database.write(async () => {
      await matches[0].update((model: NotificationPreferenceModel) => {
        Object.assign(model, {
          communityInteractions:
            partial.communityInteractions ?? model.communityInteractions,
          communityLikes: partial.communityLikes ?? model.communityLikes,
          cultivationReminders:
            partial.cultivationReminders ?? model.cultivationReminders,
          systemUpdates: partial.systemUpdates ?? model.systemUpdates,
          quietHoursEnabled:
            partial.quietHoursEnabled ?? model.quietHoursEnabled,
          quietHoursStart: Object.prototype.hasOwnProperty.call(
            partial,
            'quietHoursStart'
          )
            ? partial.quietHoursStart
            : model.quietHoursStart,
          quietHoursEnd: Object.prototype.hasOwnProperty.call(
            partial,
            'quietHoursEnd'
          )
            ? partial.quietHoursEnd
            : model.quietHoursEnd,
          lastUpdated: new Date(),
        });
      });
    });
    return;
  }

  const defaults = { ...DEFAULT_PREFERENCES, ...partial };
  await database.write(async () => {
    await collection.create((model: NotificationPreferenceModel) => {
      model.userId = userId;
      model.communityInteractions = defaults.communityInteractions;
      model.communityLikes = defaults.communityLikes;
      model.cultivationReminders = defaults.cultivationReminders;
      model.systemUpdates = defaults.systemUpdates;
      model.quietHoursEnabled = defaults.quietHoursEnabled;
      model.quietHoursStart = defaults.quietHoursStart ?? undefined;
      model.quietHoursEnd = defaults.quietHoursEnd ?? undefined;
      model.lastUpdated = new Date();
    });
  });
}

async function ensurePreferencesRecord(userId: string): Promise<void> {
  const { database } = await import('@/lib/watermelon');
  const collection = database.collections.get<NotificationPreferenceModel>(
    'notification_preferences'
  );
  const matches = await collection.query(Q.where('user_id', userId)).fetch();
  if (matches.length === 0) {
    await upsertPreferences(userId, DEFAULT_PREFERENCES);
  }
}

async function syncPreferencesRemote(userId: string): Promise<boolean> {
  if (getIsTestEnvironment()) return true;

  const maxRetries = 2;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
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
      return true;
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        // Exponential backoff: 1000ms, 2000ms
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  // All retries failed
  captureCategorizedErrorSync(lastError);
  return false;
}

function getIsTestEnvironment(): boolean {
  return (
    typeof process !== 'undefined' && process.env?.JEST_WORKER_ID !== undefined
  );
}
