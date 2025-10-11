/**
 * Calendar Integration Service
 *
 * Handles feeding schedule integration with calendar task system.
 * Generates calendar tasks from feeding events with unit-resolved instructions.
 *
 * Requirements: 5.1, 5.2, 5.4
 */

import type { Database } from '@nozbe/watermelondb';
import { DateTime } from 'luxon';

import type { CreateTaskInput } from '@/lib/task-manager';
import { createTask } from '@/lib/task-manager';
import { TaskNotificationManager } from '@/lib/tasks/task-notification-manager';
import type { TaskModel } from '@/lib/watermelon-models/task';
import type { Task } from '@/types/calendar';

import type { FeedingSchedule } from './schedule-service';
import { createCalendarTaskFromEvent } from './schedule-service';

/**
 * Result of feeding task generation
 */
export type FeedingTaskGenerationResult = {
  tasksCreated: number;
  taskIds: string[];
  notificationsScheduled: number;
  errors: { eventId: string; error: string }[];
};

/**
 * Options for feeding task generation
 */
export type FeedingTaskGenerationOptions = {
  ppmScale: '500' | '700'; // User's preferred PPM scale
  scheduleReminders?: boolean; // Default true
  timezone: string; // IANA timezone
};

/**
 * Generate calendar tasks from feeding schedule
 *
 * Creates one task per feeding event with:
 * - Unit-resolved nutrient instructions (EC @25°C primary, PPM with scale)
 * - pH/EC measurement reminders
 * - Formatted dose guidance
 * - Notification scheduling
 *
 * @param database - WatermelonDB instance
 * @param schedule - Feeding schedule with events
 * @param options - Generation options
 * @returns Generation result with task IDs and stats
 */
// eslint-disable-next-line max-lines-per-function
export async function generateFeedingTasks(
  database: Database,
  schedule: FeedingSchedule,
  options: FeedingTaskGenerationOptions
): Promise<FeedingTaskGenerationResult> {
  const { ppmScale, scheduleReminders = true, timezone } = options;

  const result: FeedingTaskGenerationResult = {
    tasksCreated: 0,
    taskIds: [],
    notificationsScheduled: 0,
    errors: [],
  };

  // Generate tasks sequentially to avoid race conditions
  for (const event of schedule.events) {
    try {
      // Convert feeding event to calendar task data
      const taskData = createCalendarTaskFromEvent(event, ppmScale);

      // Calculate reminder time (30 minutes before due time)
      const dueDateTime = DateTime.fromMillis(taskData.dueDate, {
        zone: timezone,
      });
      const reminderDateTime = dueDateTime.minus({ minutes: 30 });

      // Create task input
      const taskInput: CreateTaskInput = {
        title: taskData.title,
        description: taskData.description,
        timezone,
        dueAtLocal: dueDateTime.toISO() || undefined,
        dueAtUtc: dueDateTime.toUTC().toISO() || undefined,
        reminderAtLocal: reminderDateTime.toISO() || undefined,
        reminderAtUtc: reminderDateTime.toUTC().toISO() || undefined,
        plantId: taskData.plantId,
        metadata: {
          ...taskData.metadata,
          type: 'feeding',
          source: 'nutrient-engine',
          scheduleId: schedule.id,
          templateId: schedule.templateId,
        },
      };

      // Create task
      const task = await createTask(taskInput);
      result.tasksCreated++;
      result.taskIds.push(task.id);

      // Schedule reminder notification if enabled
      if (scheduleReminders && task.reminderAtUtc) {
        try {
          // Get task model from database for notification scheduling
          const taskModel = await database
            .get<TaskModel>('tasks')
            .find(task.id);

          await TaskNotificationManager.scheduleReminderForTask(taskModel);
          result.notificationsScheduled++;
        } catch (notificationError) {
          // Log but don't fail if notification scheduling fails
          console.warn(
            `Failed to schedule notification for task ${task.id}:`,
            notificationError
          );
        }
      }
    } catch (error) {
      result.errors.push({
        eventId: event.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return result;
}

/**
 * Log feeding event completion
 *
 * Updates schedule state when feeding task is completed.
 * Stores completion timestamp and actual measurements if provided.
 *
 * @param eventId - Completed event ID
 * @param schedule - Associated feeding schedule
 * @param measurements - Optional pH/EC measurements taken during feeding
 * @returns Updated schedule
 */
export async function logFeedingCompletion(
  eventId: string,
  schedule: FeedingSchedule,
  measurements?: {
    ph?: number;
    ec25c?: number;
    tempC?: number;
  }
): Promise<FeedingSchedule>;

/**
 * Log feeding event completion from task
 *
 * Updates schedule state when feeding task is completed.
 * Extracts eventId from task metadata and stores completion data.
 *
 * @param task - Completed task with eventId in metadata
 * @param schedule - Associated feeding schedule
 * @param measurements - Optional pH/EC measurements taken during feeding
 * @returns Updated schedule
 */
export async function logFeedingCompletion(
  task: Task,
  schedule: FeedingSchedule,
  measurements?: {
    ph?: number;
    ec25c?: number;
    tempC?: number;
  }
): Promise<FeedingSchedule>;

export async function logFeedingCompletion(
  eventIdOrTask: string | Task,
  schedule: FeedingSchedule,
  measurements?: {
    ph?: number;
    ec25c?: number;
    tempC?: number;
  }
): Promise<FeedingSchedule> {
  // Extract eventId from task metadata or use directly
  const eventId =
    typeof eventIdOrTask === 'string'
      ? eventIdOrTask
      : (eventIdOrTask.metadata?.eventId as string);

  if (!eventId) {
    throw new Error('Event ID not found in task metadata or not provided');
  }

  // Find the event associated with this eventId
  const eventIndex = schedule.events.findIndex((e) => e.id === eventId);

  if (eventIndex === -1) {
    throw new Error(`Event ${eventId} not found in schedule ${schedule.id}`);
  }

  // Update event with completion data
  const updatedEvents = [...schedule.events];
  const completedEvent = {
    ...updatedEvents[eventIndex],
    completedAt: Date.now(),
    measurements,
  };

  updatedEvents[eventIndex] = completedEvent;

  // Return updated schedule
  return {
    ...schedule,
    events: updatedEvents,
    updatedAt: Date.now(),
  };
}

/**
 * Cancel feeding task notifications
 *
 * Cancels scheduled notifications when feeding tasks are deleted or rescheduled.
 *
 * @param database - WatermelonDB instance
 * @param taskIds - Task IDs to cancel notifications for
 * @returns Number of notifications cancelled
 */
export async function cancelScheduledNotifications(
  database: Database,
  taskIds: string[]
): Promise<number> {
  let cancelledCount = 0;

  for (const taskId of taskIds) {
    try {
      await TaskNotificationManager.cancelReminderForTask(taskId);
      cancelledCount++;
    } catch (error) {
      // Log but continue cancelling other notifications
      console.warn(`Failed to cancel notification for task ${taskId}:`, error);
    }
  }

  return cancelledCount;
}

/**
 * Reschedule feeding task notifications
 *
 * Reschedules notifications when feeding tasks are rescheduled.
 *
 * @param database - WatermelonDB instance
 * @param taskIds - Task IDs to reschedule notifications for
 * @returns Number of notifications rescheduled
 */
export async function rescheduleFeedingTaskNotifications(
  database: Database,
  taskIds: string[]
): Promise<number> {
  let rescheduledCount = 0;

  const tasksCollection = database.get<TaskModel>('tasks');

  for (const taskId of taskIds) {
    try {
      const taskModel = await tasksCollection.find(taskId);
      await TaskNotificationManager.rescheduleReminderForTask(taskModel);
      rescheduledCount++;
    } catch (error) {
      // Log but continue rescheduling other notifications
      console.warn(
        `Failed to reschedule notification for task ${taskId}:`,
        error
      );
    }
  }

  return rescheduledCount;
}
