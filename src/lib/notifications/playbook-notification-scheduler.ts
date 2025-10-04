import { Platform } from 'react-native';

import { registerAndroidChannels } from '@/lib/notifications/android-channels';
import { AndroidExactAlarmCoordinator } from '@/lib/notifications/android-exact-alarm-service';
import { LocalNotificationService } from '@/lib/notifications/local-service';
import { PermissionManager } from '@/lib/permissions/permission-manager';
import { captureCategorizedErrorSync } from '@/lib/sentry-utils';

type Task = {
  id: string;
  title: string;
  description?: string;
  reminderAtUtc?: string;
  reminderAtLocal?: string;
  timezone?: string;
  notificationId?: string;
};

type ScheduleResult = {
  notificationId: string;
  exact: boolean;
  fallbackUsed: boolean;
};

type DeliveryStats = {
  totalScheduled: number;
  totalDelivered: number;
  totalFailed: number;
  deliveryRate: number;
  averageDelayMs: number;
};

/**
 * PlaybookNotificationScheduler handles notification scheduling for playbook tasks
 * with Android/iOS compatibility, Doze mode handling, and delivery tracking.
 *
 * Key features:
 * - Defaults to inexact alarms (Android 12+)
 * - Exact alarm opt-in for critical reminders
 * - Rehydrates notifications on app startup
 * - Tracks delivery metrics for ≥95% success rate
 */
export class PlaybookNotificationScheduler {
  private deliveryTracking = new Map<
    string,
    {
      scheduledAt: number;
      triggerAt: number;
      delivered: boolean;
      deliveredAt?: number;
    }
  >();

  /**
   * Ensures notification channels are created on Android.
   * Should be called on app startup after permission is granted.
   */
  async ensureChannels(): Promise<void> {
    if (Platform.OS !== 'android') return;

    try {
      await registerAndroidChannels();
    } catch (error) {
      captureCategorizedErrorSync(error, {
        category: 'notification',
        operation: 'ensure_channels',
        message: 'Failed to ensure Android notification channels',
      });
      throw error;
    }
  }

  /**
   * Checks if exact alarms can be used on Android 14+.
   * Returns false on iOS or Android < 14.
   */
  async canUseExactAlarms(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;

    const version = Number(Platform.Version);
    if (Number.isNaN(version) || version < 31) {
      return false;
    }

    return PermissionManager.needsExactAlarms();
  }

  /**
   * Schedules a task reminder notification.
   * Defaults to inexact alarms with exact alarm opt-in for critical tasks.
   *
   * @param task - Task with reminder information
   * @param options - Scheduling options
   * @returns Schedule result with notification ID and alarm type
   */
  async scheduleTaskReminder(
    task: Task,
    options: {
      useExactAlarm?: boolean;
      priority?: 'normal' | 'high';
    } = {}
  ): Promise<ScheduleResult> {
    const reminderTimestamp = task.reminderAtUtc || task.reminderAtLocal;
    if (!reminderTimestamp) {
      throw new Error(`Task ${task.id} has no reminder timestamp`);
    }

    const triggerDate = new Date(reminderTimestamp);
    if (triggerDate.getTime() <= Date.now()) {
      throw new Error(`Task ${task.id} reminder is in the past`);
    }

    // Check if we should attempt exact alarm
    const shouldUseExact = options.useExactAlarm && Platform.OS === 'android';
    let notificationId: string;
    let exact = false;
    let fallbackUsed = false;

    if (shouldUseExact) {
      const result = await AndroidExactAlarmCoordinator.ensurePermission({
        taskId: task.id,
        triggerAt: triggerDate,
      });

      if (result.granted) {
        // Permission granted, schedule exact alarm
        notificationId = await this.scheduleExactNotification(
          task,
          triggerDate
        );
        exact = true;
      } else if (result.fallbackId) {
        // Permission denied, fallback already scheduled
        notificationId = result.fallbackId;
        fallbackUsed = true;
      } else {
        // Permission denied, schedule inexact
        notificationId = await this.scheduleInexactNotification(
          task,
          triggerDate
        );
        fallbackUsed = true;
      }
    } else {
      // Default to inexact alarm
      notificationId = await this.scheduleInexactNotification(
        task,
        triggerDate
      );
    }

    // Track for delivery metrics
    this.deliveryTracking.set(notificationId, {
      scheduledAt: Date.now(),
      triggerAt: triggerDate.getTime(),
      delivered: false,
    });

    return { notificationId, exact, fallbackUsed };
  }

  /**
   * Cancels a scheduled task reminder.
   */
  async cancelTaskReminder(notificationId: string): Promise<void> {
    if (!notificationId) return;

    try {
      await LocalNotificationService.cancelScheduledNotification(
        notificationId
      );
      this.deliveryTracking.delete(notificationId);
    } catch (error) {
      captureCategorizedErrorSync(error, {
        category: 'notification',
        operation: 'cancel_reminder',
        notificationId,
      });
    }
  }

  /**
   * Reschedules a task reminder (cancel + schedule).
   */
  async rescheduleTaskReminder(
    task: Task,
    options?: { useExactAlarm?: boolean; priority?: 'normal' | 'high' }
  ): Promise<ScheduleResult> {
    if (task.notificationId) {
      await this.cancelTaskReminder(task.notificationId);
    }
    return this.scheduleTaskReminder(task, options);
  }

  /**
   * Rehydrates notifications on app startup.
   * Reschedules any future notifications found in the database.
   */
  async rehydrateNotifications(tasks: Task[]): Promise<void> {
    const now = Date.now();
    const futureReminders = tasks.filter((task) => {
      const reminderTimestamp = task.reminderAtUtc || task.reminderAtLocal;
      if (!reminderTimestamp) return false;
      return new Date(reminderTimestamp).getTime() > now;
    });

    const results = await Promise.allSettled(
      futureReminders.map((task) => this.scheduleTaskReminder(task))
    );

    // Update task notification IDs with newly scheduled notification IDs
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        futureReminders[index].notificationId = result.value.notificationId;
      }
    });

    const failures = results.filter((r) => r.status === 'rejected');
    if (failures.length > 0) {
      captureCategorizedErrorSync(
        new Error('Notification rehydration failures'),
        {
          category: 'notification',
          operation: 'rehydrate',
          failureCount: failures.length,
          totalCount: futureReminders.length,
        }
      );
    }
  }

  /**
   * Handles notification delivery event.
   * Updates delivery tracking for metrics.
   */
  handleNotificationDelivered(notificationId: string): void {
    const tracking = this.deliveryTracking.get(notificationId);
    if (tracking) {
      tracking.delivered = true;
      tracking.deliveredAt = Date.now();
    }
  }

  /**
   * Verifies if a notification was delivered successfully.
   */
  async verifyDelivery(notificationId: string): Promise<boolean> {
    const tracking = this.deliveryTracking.get(notificationId);
    if (!tracking) return false;

    // Check if delivered within ±5 minutes of trigger time
    if (tracking.delivered && tracking.deliveredAt) {
      const delay = Math.abs(tracking.deliveredAt - tracking.triggerAt);
      const fiveMinutes = 5 * 60 * 1000;
      return delay <= fiveMinutes;
    }

    return false;
  }

  /**
   * Gets delivery statistics for monitoring.
   * Target: ≥95% delivery rate within ±5 minutes.
   */
  getDeliveryStats(): DeliveryStats {
    const stats = Array.from(this.deliveryTracking.values());
    const totalScheduled = stats.length;
    const delivered = stats.filter((s) => s.delivered);
    const totalDelivered = delivered.length;

    // Calculate delivery rate within ±5 minutes
    const fiveMinutes = 5 * 60 * 1000;
    const onTime = delivered.filter((s) => {
      if (!s.deliveredAt) return false;
      const delay = Math.abs(s.deliveredAt - s.triggerAt);
      return delay <= fiveMinutes;
    });

    const deliveryRate =
      totalScheduled > 0 ? onTime.length / totalScheduled : 0;

    // Calculate average delay
    const delays = delivered
      .filter((s) => s.deliveredAt)
      .map((s) => Math.abs(s.deliveredAt! - s.triggerAt));
    const averageDelayMs =
      delays.length > 0
        ? delays.reduce((sum, d) => sum + d, 0) / delays.length
        : 0;

    return {
      totalScheduled,
      totalDelivered,
      totalFailed: totalScheduled - totalDelivered,
      deliveryRate,
      averageDelayMs,
    };
  }

  /**
   * Clears delivery tracking data.
   * Should be called periodically to prevent memory growth.
   */
  clearDeliveryTracking(): void {
    this.deliveryTracking.clear();
  }

  // Private helper methods

  private async scheduleExactNotification(
    task: Task,
    triggerDate: Date
  ): Promise<string> {
    return LocalNotificationService.scheduleExactNotification({
      title: task.title,
      body: task.description || '',
      data: { taskId: task.id, type: 'playbook_reminder' },
      triggerDate,
      androidChannelKey: 'cultivation.reminders',
      threadId: `task-${task.id}`,
    });
  }

  private async scheduleInexactNotification(
    task: Task,
    triggerDate: Date
  ): Promise<string> {
    // Use the same scheduling method but without exact alarm permission
    return LocalNotificationService.scheduleExactNotification({
      title: task.title,
      body: task.description || '',
      data: { taskId: task.id, type: 'playbook_reminder' },
      triggerDate,
      androidChannelKey: 'cultivation.reminders',
      threadId: `task-${task.id}`,
    });
  }
}

// Singleton instance
let schedulerInstance: PlaybookNotificationScheduler | null = null;

export function getPlaybookNotificationScheduler(): PlaybookNotificationScheduler {
  if (!schedulerInstance) {
    schedulerInstance = new PlaybookNotificationScheduler();
  }
  return schedulerInstance;
}
