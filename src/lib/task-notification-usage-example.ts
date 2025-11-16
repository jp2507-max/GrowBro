import { InvalidTaskTimestampError } from './notification-errors';
import { TaskNotificationService } from './task-notifications';

interface Task {
  id: string;
  plantId?: string;
  title: string;
  description: string;
  reminderAtUtc?: Date | string | null;
  reminderAtLocal?: Date | string | null;
  dueAtUtc?: Date | string | null;
  dueAtLocal?: Date | string | null;
  recurrenceRule?: string;
}

/**
 * Example usage showing how to handle InvalidTaskTimestampError predictably
 */
export class TaskScheduler {
  private notificationService = new TaskNotificationService();

  async scheduleTaskWithErrorHandling(
    task: Task
  ): Promise<{ success: boolean; notificationId?: string; error?: string }> {
    try {
      const notificationId =
        await this.notificationService.scheduleTaskReminder(task);
      return { success: true, notificationId };
    } catch (error) {
      if (error instanceof InvalidTaskTimestampError) {
        // Handle timestamp validation errors specifically
        console.error('Task timestamp validation failed:', error.message);
        return {
          success: false,
          error: `Cannot schedule reminder: ${error.message}`,
        };
      }

      // Handle other types of errors
      console.error('Unexpected error scheduling task reminder:', error);
      return {
        success: false,
        error: 'Failed to schedule reminder due to unexpected error',
      };
    }
  }

  /**
   * Batch schedule multiple tasks with individual error handling
   */
  async scheduleMultipleTasks(tasks: Task[]): Promise<
    {
      taskId: string;
      success: boolean;
      notificationId?: string;
      error?: string;
    }[]
  > {
    const results = [];

    for (const task of tasks) {
      const result = await this.scheduleTaskWithErrorHandling(task);
      results.push({
        taskId: task.id,
        ...result,
      });
    }

    return results;
  }
}
