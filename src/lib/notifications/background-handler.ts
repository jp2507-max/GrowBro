/**
 * Background Notification Handler with Platform-Specific SLAs
 *
 * CRITICAL Platform Constraints & Realistic SLAs:
 *
 * iOS Background Processing:
 * - Silent push (content-available: 1) is BEST-EFFORT ONLY
 * - Execution time limit: <30 seconds per background session
 * - Throttled by: app usage patterns, battery level, Low Power Mode
 * - Background App Refresh setting must be enabled
 * - Force-quit apps do NOT receive background notifications
 * - NO GUARANTEED EXECUTION - treat as hints for data sync
 *
 * Android Background Processing:
 * - Data messages can trigger background sync
 * - Doze mode severely limits background operations
 * - Battery optimization settings affect reliability
 * - WorkManager provides deferred sync guarantee (not immediate)
 * - Foreground service required for operations >30s
 *
 * Realistic SLA:
 * - Background updates: Best-effort, NO guaranteed delivery or timing
 * - Foreground reconciliation: Source of truth when app opens
 * - Critical notifications: Use visible notifications (not silent)
 * - Data consistency: Always reconcile on app resume/foreground
 *
 * Implementation Strategy:
 * 1. Use silent push as HINT for background sync
 * 2. Queue failed operations for foreground retry
 * 3. Always reconcile data on app open (notification-sync.ts)
 * 4. Set realistic user expectations (no immediate background sync)
 *
 * @see https://developer.apple.com/documentation/usernotifications/handling_notifications_and_notification-related_actions
 * @see https://developer.android.com/training/monitoring-device-state/doze-standby
 */
import { Platform } from 'react-native';

import { saveNotifications } from '@/lib/notifications/notification-storage';
import { captureCategorizedErrorSync } from '@/lib/sentry-utils';

type BackgroundNotificationData = {
  type?: string;
  messageId?: string;
  postId?: string;
  userId?: string;
  action?: string;
  title?: string;
  body?: string;
};

type BackgroundMessage = {
  data: BackgroundNotificationData;
  messageId?: string;
  notification?: {
    title?: string;
    body?: string;
  };
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

    const tasks = [...pendingBackgroundTasks];
    pendingBackgroundTasks.length = 0; // Clear queue

    const results = await Promise.allSettled(
      tasks.map((task) =>
        BackgroundNotificationHandler.handleBackgroundMessage(task)
      )
    );

    const failedTasks: BackgroundMessage[] = [];
    const errors: Error[] = [];

    results.forEach((result, index) => {
      const task = tasks[index];
      const taskId = task.data.messageId || task.messageId || `task_${index}`;

      if (result.status === 'rejected') {
        const error = result.reason;
        errors.push(error);

        captureCategorizedErrorSync(error, {
          operation: 'process_pending_background_tasks',
          taskId,
          context: 'Individual background task failed, re-queueing for retry',
        });

        // Re-queue failed tasks for retry
        failedTasks.push(task);
      }
      // fulfilled results are treated as successful - no additional handling needed
    });

    // Re-queue failed tasks back to pending queue for retry
    if (failedTasks.length > 0) {
      pendingBackgroundTasks.push(...failedTasks);
    }

    // If all tasks failed, throw an aggregated error to surface the issue
    if (errors.length === tasks.length && errors.length > 0) {
      const aggregatedError = new Error(
        `All ${errors.length} background tasks failed. First error: ${errors[0].message}`
      ) as Error & { originalErrors: Error[] };
      aggregatedError.originalErrors = errors;
      throw aggregatedError;
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
    // Extract title and body from message data, with fallbacks
    const title =
      message.data.title ||
      message.notification?.title ||
      'Background notification';
    const body = message.data.body || message.notification?.body || '';

    // Store notification in local database
    await saveNotifications([
      {
        id: message.data.messageId || message.messageId || `bg_${Date.now()}`,
        type: message.data.type || 'system.update',
        title,
        body,
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
