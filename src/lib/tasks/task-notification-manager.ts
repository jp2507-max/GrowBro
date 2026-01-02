import { DateTime } from 'luxon';

import { LocalNotificationService } from '@/lib/notifications/local-service';
import { getItem, removeItem, setItem } from '@/lib/storage';
import type { TaskModel } from '@/lib/watermelon-models/task';

const TASK_NOTIFICATION_STORAGE_KEY =
  '@growbro/notifications/task-reminder-ids';

type TaskNotificationMap = Record<string, string>;

/**
 * Manages notification scheduling for cultivation task reminders.
 * Integrates with LocalNotificationService to schedule/cancel notifications
 * when tasks are created, updated, or completed.
 */
export class TaskNotificationManager {
  /**
   * Generates a stable notification identifier from task ID
   * Format: task_<uuid> to avoid collisions with other notification types
   */
  private static getNotificationId(taskId: string): string {
    return `task_${taskId}`;
  }

  private static loadNotificationMap(): TaskNotificationMap {
    return getItem<TaskNotificationMap>(TASK_NOTIFICATION_STORAGE_KEY) ?? {};
  }

  private static saveNotificationMap(map: TaskNotificationMap): void {
    if (Object.keys(map).length === 0) {
      removeItem(TASK_NOTIFICATION_STORAGE_KEY);
      return;
    }
    setItem(TASK_NOTIFICATION_STORAGE_KEY, map);
  }

  /**
   * Schedules a local notification reminder for a task
   * @param task TaskModel with reminder fields set
   * @returns Promise resolving to notification ID if scheduled, null otherwise
   */
  static async scheduleReminderForTask(
    task: TaskModel
  ): Promise<string | null> {
    // Only schedule if reminder time is set
    if (!task.reminderAtUtc) {
      return null;
    }

    // Parse reminder time
    const reminderTime = DateTime.fromISO(task.reminderAtUtc, { zone: 'utc' });

    // Don't schedule if reminder is in the past
    if (reminderTime < DateTime.utc()) {
      return null;
    }

    try {
      const notificationId =
        await LocalNotificationService.scheduleExactNotification({
          idTag: this.getNotificationId(task.id),
          title: task.title || 'Task Reminder',
          body: task.description || 'You have a task due soon',
          data: {
            type: 'cultivation.reminder',
            taskId: task.id,
            deepLink: `growbro://calendar?taskId=${task.id}`,
          },
          triggerDate: reminderTime.toJSDate(),
          androidChannelKey: 'cultivation.reminders',
          threadId: `task_${task.id}`,
        });

      const map = this.loadNotificationMap();
      map[task.id] = notificationId;
      this.saveNotificationMap(map);

      return notificationId;
    } catch (error) {
      console.error(
        `Failed to schedule notification for task ${task.id}:`,
        error
      );
      return null;
    }
  }

  /**
   * Cancels a scheduled reminder for a task
   * @param taskId Task identifier
   * @returns Promise resolving when cancellation completes
   */
  static async cancelReminderForTask(taskId: string): Promise<void> {
    const map = this.loadNotificationMap();
    const notificationId = map[taskId];
    if (!notificationId) return;
    try {
      await LocalNotificationService.cancelScheduledNotification(
        notificationId
      );
    } catch (error) {
      console.error(`Failed to cancel notification for task ${taskId}:`, error);
    } finally {
      delete map[taskId];
      this.saveNotificationMap(map);
    }
  }

  /**
   * Reschedules a reminder when task is updated
   * Cancels existing reminder and schedules new one
   * @param task Updated TaskModel
   * @returns Promise resolving to new notification ID if rescheduled
   */
  static async rescheduleReminderForTask(
    task: TaskModel
  ): Promise<string | null> {
    // Cancel existing reminder first
    await this.cancelReminderForTask(task.id);

    // Schedule new reminder
    return await this.scheduleReminderForTask(task);
  }

  /**
   * Batch cancels reminders for multiple tasks
   * Useful when completing or deleting multiple tasks at once
   * @param taskIds Array of task identifiers
   * @returns Promise resolving when all cancellations complete
   */
  static async cancelRemindersForTasks(taskIds: string[]): Promise<void> {
    await Promise.all(taskIds.map((id) => this.cancelReminderForTask(id)));
  }
}
