import { Platform } from 'react-native';

import { saveNotifications } from '@/lib/notifications/notification-storage';
import { captureCategorizedErrorSync } from '@/lib/sentry-utils';

type BackgroundNotificationData = {
  type?: string;
  messageId?: string;
  postId?: string;
  userId?: string;
  action?: string;
};

type BackgroundMessage = {
  data: BackgroundNotificationData;
  messageId?: string;
};

// Track whether device is in Doze mode (Android-specific)
let isInDozeMode = false;
const pendingBackgroundTasks: BackgroundMessage[] = [];

export const BackgroundNotificationHandler = {
  async handleBackgroundMessage(message: BackgroundMessage): Promise<void> {
    try {
      // Platform-specific constraints
      if (Platform.OS === 'ios') {
        await handleIOSBackgroundMessage(message);
      } else {
        await handleAndroidBackgroundMessage(message);
      }
    } catch (error) {
      captureCategorizedErrorSync(error, {
        operation: 'background_notification_handler',
        platform: Platform.OS,
      });
    }
  },

  async processPendingTasks(): Promise<void> {
    if (pendingBackgroundTasks.length === 0) return;

    try {
      const tasks = [...pendingBackgroundTasks];
      pendingBackgroundTasks.length = 0; // Clear queue

      await Promise.all(
        tasks.map((task) =>
          BackgroundNotificationHandler.handleBackgroundMessage(task)
        )
      );
    } catch (error) {
      captureCategorizedErrorSync(error, {
        operation: 'process_pending_background_tasks',
      });
    }
  },

  setDozeMode(inDozeMode: boolean): void {
    isInDozeMode = inDozeMode;
  },

  getPendingTaskCount(): number {
    return pendingBackgroundTasks.length;
  },
};

async function handleIOSBackgroundMessage(
  message: BackgroundMessage
): Promise<void> {
  // iOS silent push is best-effort only
  // Quick sync operation (< 30 seconds) respecting platform limitations
  try {
    // Update local notification data if needed
    if (message.data.messageId) {
      await syncNotificationData(message);
    }

    // For iOS, we cannot guarantee execution
    // Background processing is throttled based on:
    // - App usage patterns
    // - Battery level and Low Power Mode
    // - Background App Refresh setting
    // - Force-quit status
  } catch (error) {
    // Fail gracefully - data will sync on next app open
    captureCategorizedErrorSync(error, {
      operation: 'ios_background_message',
      context: 'Background sync failed, will retry on foreground',
    });
  }
}

async function handleAndroidBackgroundMessage(
  message: BackgroundMessage
): Promise<void> {
  // Respect Doze mode and battery optimization
  if (isInDozeMode) {
    // Queue for later processing
    pendingBackgroundTasks.push(message);
    return;
  }

  try {
    // Process data message and update local storage
    if (message.data.messageId) {
      await syncNotificationData(message);
    }

    // For longer operations, we would use foreground service
    // but for notification data sync, this is sufficient
  } catch (error) {
    captureCategorizedErrorSync(error, {
      operation: 'android_background_message',
    });
  }
}

async function syncNotificationData(message: BackgroundMessage): Promise<void> {
  try {
    // Store notification in local database
    await saveNotifications([
      {
        id: message.data.messageId || message.messageId || `bg_${Date.now()}`,
        type: message.data.type || 'system_update',
        title: '', // Would come from full message payload
        body: '', // Would come from full message payload
        data: message.data,
        deepLink: null,
        createdAt: new Date(),
        messageId: message.data.messageId || message.messageId,
      },
    ]);
  } catch (error) {
    captureCategorizedErrorSync(error, {
      operation: 'sync_notification_data',
      messageId: message.data.messageId,
    });
  }
}
