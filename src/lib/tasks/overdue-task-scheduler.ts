import { type Database } from '@nozbe/watermelondb';
import { DateTime } from 'luxon';

import { TaskNotificationManager } from '@/lib/tasks/task-notification-manager';
import type { TaskModel } from '@/lib/watermelon-models/task';

/**
 * Manages daily reminder notifications for overdue tasks.
 * Queries tasks that are past their due date and haven't been completed,
 * then schedules reminder notifications to help users catch up.
 */
export class OverdueTaskScheduler {
  private database: Database;
  private scheduledOverdueIds: Set<string>;

  constructor(database: Database) {
    this.database = database;
    this.scheduledOverdueIds = new Set();
  }

  /**
   * Queries and schedules reminders for all overdue tasks
   * Should be called on app foreground or daily background job
   * @returns Promise resolving to count of reminders scheduled
   */
  async scheduleOverdueReminders(): Promise<number> {
    const overdueTasks = await this.queryOverdueTasks();
    let scheduledCount = 0;

    for (const task of overdueTasks) {
      // Skip if we've already scheduled a reminder for this overdue task
      if (this.scheduledOverdueIds.has(task.id)) {
        continue;
      }

      // Schedule a daily reminder notification
      const result = await this.scheduleDailyReminder(task);

      if (result) {
        this.scheduledOverdueIds.add(task.id);
        scheduledCount++;
      }
    }

    return scheduledCount;
  }

  /**
   * Cancels overdue reminder for a task
   * Should be called when task is completed or deleted
   * @param taskId Task identifier
   */
  async cancelOverdueReminder(taskId: string): Promise<void> {
    this.scheduledOverdueIds.delete(taskId);
    await TaskNotificationManager.cancelReminderForTask(taskId);
  }

  /**
   * Clears all tracked overdue reminders
   * Useful for testing or when resetting notification state
   */
  clearTrackedReminders(): void {
    this.scheduledOverdueIds.clear();
  }

  /**
   * Queries database for tasks that are overdue and not completed
   */
  private async queryOverdueTasks(): Promise<TaskModel[]> {
    const collection = this.database.get<TaskModel>('tasks');
    const now = DateTime.utc();

    const tasks = await collection
      .query(
        // @ts-expect-error WatermelonDB query operators

        collection.where('deleted_at', null),
        // @ts-expect-error WatermelonDB query operators

        collection.where('status', 'pending'),
        // @ts-expect-error WatermelonDB query operators

        collection.where('due_at_utc', collection.lt(now.toISO()))
      )
      .fetch();

    return tasks;
  }

  /**
   * Schedules a daily reminder for an overdue task
   * Reminder fires at 9 AM local time the next day
   */
  private async scheduleDailyReminder(task: TaskModel): Promise<string | null> {
    // Schedule reminder for 9 AM tomorrow in user's timezone
    const reminderTime = DateTime.local()
      .plus({ days: 1 })
      .set({ hour: 9, minute: 0, second: 0, millisecond: 0 });

    try {
      const notificationId =
        await TaskNotificationManager.scheduleReminderForTask({
          ...task,
          reminderAtUtc: reminderTime.toUTC().toISO(),
        } as TaskModel);

      return notificationId;
    } catch (error) {
      console.error(
        `Failed to schedule overdue reminder for task ${task.id}:`,
        error
      );
      return null;
    }
  }
}
