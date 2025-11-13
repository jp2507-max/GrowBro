/**
 * Schedule Shifter
 *
 * Handles atomic schedule shifting with:
 * - Preview generation
 * - Atomic task updates
 * - Undo descriptor creation
 * - Outbox-based notification rescheduling
 * - Manual edit protection
 */
/* eslint-disable max-lines-per-function */

import { type Database, Q } from '@nozbe/watermelondb';
import { randomUUID } from 'expo-crypto';
import { DateTime } from 'luxon';

import type { ScheduleShiftPreview } from '@/types/playbook';

import type { AnalyticsClient } from '../analytics';
import type { OutboxNotificationActionModel } from '../watermelon-models/outbox-notification-action';
import type { TaskModel } from '../watermelon-models/task';
import type { UndoDescriptorModel } from '../watermelon-models/undo-descriptor';

export interface ScheduleShifterOptions {
  database: Database;
  analytics: AnalyticsClient;
}

export interface ShiftOptions {
  includeCompleted?: boolean;
  includeManuallyEdited?: boolean;
}

/**
 * Prior field values for schedule shift undo operations
 */
interface ScheduleShiftPriorValues extends Record<string, unknown> {
  shiftId: string;
  plantId: string;
  tasks: Record<
    string,
    {
      dueAtLocal: string;
      dueAtUtc: string;
      reminderAtLocal?: string;
      reminderAtUtc?: string;
      notificationId?: string;
    }
  >;
}

/**
 * Type guard to safely narrow priorFieldValues to ScheduleShiftPriorValues
 */
function isScheduleShiftPriorValues(
  priorValues: Record<string, unknown>
): priorValues is ScheduleShiftPriorValues {
  if (typeof priorValues !== 'object' || priorValues === null) {
    return false;
  }

  const data = priorValues as Record<string, unknown>;

  // Check top-level properties
  if (typeof data.shiftId !== 'string' || typeof data.plantId !== 'string') {
    return false;
  }

  // Check tasks object
  if (typeof data.tasks !== 'object' || data.tasks === null) {
    return false;
  }

  const tasks = data.tasks as Record<string, unknown>;

  // Check that all task entries have the expected shape
  for (const taskId in tasks) {
    if (typeof taskId !== 'string') continue;

    const taskData = tasks[taskId];
    if (typeof taskData !== 'object' || taskData === null) {
      return false;
    }

    const task = taskData as Record<string, unknown>;

    // Check each property exists and has correct type
    const hasDueAtLocal =
      'dueAtLocal' in task && typeof task.dueAtLocal === 'string';
    const hasDueAtUtc = 'dueAtUtc' in task && typeof task.dueAtUtc === 'string';
    const hasReminderAtLocal =
      !('reminderAtLocal' in task) ||
      task.reminderAtLocal === undefined ||
      task.reminderAtLocal === null ||
      typeof task.reminderAtLocal === 'string';
    const hasReminderAtUtc =
      !('reminderAtUtc' in task) ||
      task.reminderAtUtc === undefined ||
      task.reminderAtUtc === null ||
      typeof task.reminderAtUtc === 'string';
    const hasNotificationId =
      !('notificationId' in task) ||
      task.notificationId === undefined ||
      task.notificationId === null ||
      typeof task.notificationId === 'string';

    if (
      !hasDueAtLocal ||
      !hasDueAtUtc ||
      !hasReminderAtLocal ||
      !hasReminderAtUtc ||
      !hasNotificationId
    ) {
      return false;
    }
  }

  return true;
}

const UNDO_WINDOW_MS = 30 * 1000; // 30 seconds

export class ScheduleShifter {
  private database: Database;
  private analytics: AnalyticsClient;
  private activeShifts = new Map<string, ScheduleShiftPreview>();

  constructor(options: ScheduleShifterOptions) {
    this.database = options.database;
    this.analytics = options.analytics;
  }

  /**
   * Generate shift preview
   */
  async generatePreview(
    plantId: string,
    daysDelta: number,
    options: ShiftOptions = {}
  ): Promise<ScheduleShiftPreview> {
    const shiftId = randomUUID();
    const includeCompleted = options.includeCompleted ?? false;
    const includeManuallyEdited = options.includeManuallyEdited ?? false;

    // Build query for affected tasks
    const queryConditions = [
      Q.where('plant_id', plantId),
      Q.where('deleted_at', null),
    ];

    // Default: only future, non-completed tasks
    if (!includeCompleted) {
      queryConditions.push(Q.where('status', Q.notEq('completed')));
    }

    const tasks = await this.database
      .get<TaskModel>('tasks')
      .query(...queryConditions)
      .fetch();

    // Filter out manually edited tasks unless explicitly included
    const affectedTasks = tasks.filter((task) => {
      const metadata = task.metadata;
      const flags = metadata?.flags as Record<string, unknown> | undefined;
      const isManuallyEdited = flags?.manualEdited === true;
      return includeManuallyEdited || !isManuallyEdited;
    });

    if (affectedTasks.length === 0) {
      const preview: ScheduleShiftPreview = {
        shiftId,
        plantId,
        daysDelta,
        affectedTaskCount: 0,
        firstNewDate: null,
        lastNewDate: null,
        collisionWarnings: [],
        manuallyEditedCount: 0,
        phaseBreakdown: [],
        options,
      };
      this.activeShifts.set(shiftId, preview);
      return preview;
    }

    // Calculate new dates
    const taskChanges = affectedTasks.map((task) => {
      const currentDate = DateTime.fromISO(task.dueAtUtc, { zone: 'utc' });
      const newDate = currentDate.plus({ days: daysDelta });

      return {
        taskId: task.id,
        currentDate: currentDate.toJSDate(),
        newDate: newDate.toJSDate(),
        title: task.title,
        phaseIndex: task.phaseIndex ?? 0,
      };
    });

    // Sort by new date to find first/last
    taskChanges.sort((a, b) => a.newDate.getTime() - b.newDate.getTime());

    const firstNewDate = taskChanges[0].newDate.toISOString();
    const lastNewDate =
      taskChanges[taskChanges.length - 1].newDate.toISOString();

    // Count manually edited tasks that were excluded
    const manuallyEditedCount = tasks.length - affectedTasks.length;

    // Group by phase for breakdown
    const phaseMap = new Map<number, { taskCount: number; netDelta: number }>();
    taskChanges.forEach((change) => {
      const existing = phaseMap.get(change.phaseIndex);
      if (!existing) {
        phaseMap.set(change.phaseIndex, { taskCount: 1, netDelta: daysDelta });
      } else {
        existing.taskCount += 1;
      }
    });

    const phaseBreakdown = Array.from(phaseMap.entries()).map(
      ([phaseIndex, data]) => ({
        phaseIndex,
        taskCount: data.taskCount,
        netDelta: data.netDelta,
      })
    );

    // Detect collision warnings
    const collisionWarnings: string[] = [];
    if (manuallyEditedCount > 0 && !includeManuallyEdited) {
      collisionWarnings.push(
        `${manuallyEditedCount} manually edited task(s) will not be shifted. Enable "Include manually edited" to shift them.`
      );
    }

    const preview: ScheduleShiftPreview = {
      shiftId,
      plantId,
      daysDelta,
      affectedTaskCount: affectedTasks.length,
      firstNewDate,
      lastNewDate,
      collisionWarnings,
      manuallyEditedCount,
      phaseBreakdown,
      options,
    };

    // Store preview for confirmation
    this.activeShifts.set(shiftId, preview);

    // Emit analytics
    this.analytics.track('shift_preview', {
      plantId,
      daysDelta,
      affectedTaskCount: affectedTasks.length,
      manuallyEditedCount,
    });

    return preview;
  }

  /**
   * Apply schedule shift atomically with undo support
   */
  async applyShift(shiftId: string): Promise<void> {
    const startTime = Date.now();
    const preview = this.activeShifts.get(shiftId);

    if (!preview) {
      throw new Error('Shift preview not found. Generate preview first.');
    }

    if (preview.affectedTaskCount === 0) {
      throw new Error('No tasks to shift');
    }

    const { plantId, daysDelta, options } = preview;
    const includeCompleted = options.includeCompleted ?? false;
    const includeManuallyEdited = options.includeManuallyEdited ?? false;

    // Get affected tasks using same logic as generatePreview
    const queryConditions = [
      Q.where('plant_id', plantId),
      Q.where('deleted_at', null),
    ];

    // Default: only future, non-completed tasks
    if (!includeCompleted) {
      queryConditions.push(Q.where('status', Q.notEq('completed')));
    }

    const tasks = await this.database
      .get<TaskModel>('tasks')
      .query(...queryConditions)
      .fetch();

    // Filter out manually edited tasks unless explicitly included
    const affectedTasks = tasks.filter((task) => {
      const metadata = task.metadata;
      const flags = metadata?.flags as Record<string, unknown> | undefined;
      const isManuallyEdited = flags?.manualEdited === true;
      return includeManuallyEdited || !isManuallyEdited;
    });

    // Capture prior state for undo
    const priorFieldValues: ScheduleShiftPriorValues = {
      shiftId,
      plantId,
      tasks: {},
    };

    affectedTasks.forEach((task) => {
      priorFieldValues.tasks[task.id] = {
        dueAtLocal: task.dueAtLocal,
        dueAtUtc: task.dueAtUtc,
        reminderAtLocal: task.reminderAtLocal,
        reminderAtUtc: task.reminderAtUtc,
        notificationId: task.notificationId,
      };
    });

    // Apply shift atomically
    await this.database.write(async () => {
      // Create undo descriptor first
      const now = Date.now();
      await this.database
        .get<UndoDescriptorModel>('undo_descriptors')
        .create((record) => {
          record.createdAt = new Date(now);
          record.operationType = 'schedule_shift';
          record.affectedTaskIds = affectedTasks.map((t) => t.id);
          record.priorFieldValues = priorFieldValues;
          record.timestamp = now;
          record.expiresAt = now + UNDO_WINDOW_MS;
        });

      // Update tasks
      for (const task of affectedTasks) {
        const currentDueUtc = DateTime.fromISO(task.dueAtUtc, { zone: 'utc' });
        const newDueUtc = currentDueUtc.plus({ days: daysDelta });
        const newDueLocal = newDueUtc.setZone(task.timezone);

        let newReminderUtc: DateTime | undefined;
        let newReminderLocal: DateTime | undefined;

        if (task.reminderAtUtc) {
          const currentReminderUtc = DateTime.fromISO(task.reminderAtUtc, {
            zone: 'utc',
          });
          newReminderUtc = currentReminderUtc.plus({ days: daysDelta });
          newReminderLocal = newReminderUtc.setZone(task.timezone);
        }

        await task.update((record) => {
          record.dueAtUtc = newDueUtc.toISO()!;
          record.dueAtLocal = newDueLocal.toISO()!;

          if (newReminderUtc && newReminderLocal) {
            record.reminderAtUtc = newReminderUtc.toISO()!;
            record.reminderAtLocal = newReminderLocal.toISO()!;
          }
        });

        // Queue notification rescheduling via outbox
        if (task.notificationId && newReminderUtc) {
          // Cancel old notification
          await this.database
            .get<OutboxNotificationActionModel>('outbox_notification_actions')
            .create((record) => {
              record.actionType = 'cancel';
              record.payload = {
                notificationId: task.notificationId!,
                taskId: task.id,
              };
              record.businessKey = `cancel-${task.id}-${task.notificationId}`;
              record.ttl = 3600000; // 1 hour
              record.expiresAt = Date.now() + 3600000;
              record.nextAttemptAt = Date.now();
              record.attemptedCount = 0;
              record.status = 'pending';
            });

          // Schedule new notification
          const newNotificationId = randomUUID();
          await this.database
            .get<OutboxNotificationActionModel>('outbox_notification_actions')
            .create((record) => {
              record.actionType = 'schedule';
              record.payload = {
                notificationId: newNotificationId,
                taskId: task.id,
                triggerTime: newReminderUtc!.toISO()!,
                title: task.title,
                body: task.description || '',
                data: { taskId: task.id },
              };
              record.businessKey = `schedule-${task.id}-${newNotificationId}`;
              record.ttl = 3600000; // 1 hour
              record.expiresAt = Date.now() + 3600000;
              record.nextAttemptAt = Date.now();
              record.attemptedCount = 0;
              record.status = 'pending';
            });

          // Update task with new notification ID
          await task.update((record) => {
            record.notificationId = newNotificationId;
          });
        }
      }
    });

    const durationMs = Date.now() - startTime;

    // Emit analytics
    this.analytics.track('shift_apply', {
      plantId,
      shiftId,
      daysDelta,
      affectedTaskCount: affectedTasks.length,
      durationMs,
    });

    // Clean up preview
    this.activeShifts.delete(shiftId);
  }

  /**
   * Undo schedule shift within 30-second window
   */
  async undoShift(plantId: string, shiftId: string): Promise<void> {
    const now = Date.now();

    // Find undo descriptor
    const undoDescriptors = await this.database
      .get<UndoDescriptorModel>('undo_descriptors')
      .query(
        Q.where('operation_type', 'schedule_shift'),
        Q.where('expires_at', Q.gt(now))
      )
      .fetch();

    const undoDescriptor = undoDescriptors.find((d) => {
      if (!isScheduleShiftPriorValues(d.priorFieldValues)) {
        return false;
      }
      return (
        d.priorFieldValues.shiftId === shiftId &&
        d.priorFieldValues.plantId === plantId
      );
    });

    if (!undoDescriptor) {
      throw new Error('Undo window expired or shift not found');
    }

    const affectedTaskIds = undoDescriptor.affectedTaskIds;
    const priorValues = undoDescriptor.priorFieldValues;

    // Validate prior values structure
    if (!isScheduleShiftPriorValues(priorValues)) {
      throw new Error('Invalid undo descriptor data structure');
    }

    // Restore tasks atomically
    await this.database.write(async () => {
      const tasks = await this.database
        .get<TaskModel>('tasks')
        .query(Q.where('id', Q.oneOf(affectedTaskIds)))
        .fetch();

      for (const task of tasks) {
        const priorTaskData = priorValues.tasks[task.id];
        if (priorTaskData) {
          await task.update((record) => {
            record.dueAtLocal = priorTaskData.dueAtLocal;
            record.dueAtUtc = priorTaskData.dueAtUtc;
            record.reminderAtLocal = priorTaskData.reminderAtLocal;
            record.reminderAtUtc = priorTaskData.reminderAtUtc;
            record.notificationId = priorTaskData.notificationId;
          });

          // Queue notification restoration via outbox
          if (priorTaskData.notificationId && priorTaskData.reminderAtUtc) {
            // Cancel current notification
            if (task.notificationId) {
              await this.database
                .get<OutboxNotificationActionModel>(
                  'outbox_notification_actions'
                )
                .create((record) => {
                  record.actionType = 'cancel';
                  record.payload = {
                    notificationId: task.notificationId!,
                    taskId: task.id,
                  };
                  record.businessKey = `undo-cancel-${task.id}-${task.notificationId}`;
                  record.ttl = 3600000;
                  record.expiresAt = Date.now() + 3600000;
                  record.nextAttemptAt = Date.now();
                  record.attemptedCount = 0;
                  record.status = 'pending';
                });
            }

            // Restore original notification
            await this.database
              .get<OutboxNotificationActionModel>('outbox_notification_actions')
              .create((record) => {
                record.actionType = 'schedule';
                record.payload = {
                  notificationId: priorTaskData.notificationId || '',
                  taskId: task.id,
                  triggerTime: priorTaskData.reminderAtUtc as string,
                  title: task.title,
                  body: task.description || '',
                  data: { taskId: task.id },
                };
                record.businessKey = `undo-schedule-${task.id}-${priorTaskData.notificationId}`;
                record.ttl = 3600000;
                record.expiresAt = Date.now() + 3600000;
                record.nextAttemptAt = Date.now();
                record.attemptedCount = 0;
                record.status = 'pending';
              });
          }
        }
      }

      // Mark undo descriptor as consumed
      await undoDescriptor.destroyPermanently();
    });

    this.analytics.track('shift_undo', {
      plantId,
      shiftId,
      affectedTaskCount: affectedTaskIds.length,
    });
  }

  /**
   * Clean up expired undo descriptors
   */
  async cleanupExpiredUndos(): Promise<void> {
    const now = Date.now();
    const expired = await this.database
      .get<UndoDescriptorModel>('undo_descriptors')
      .query(Q.where('expires_at', Q.lte(now)))
      .fetch();

    if (expired.length > 0) {
      await this.database.write(async () => {
        for (const descriptor of expired) {
          await descriptor.destroyPermanently();
        }
      });
    }
  }
}
