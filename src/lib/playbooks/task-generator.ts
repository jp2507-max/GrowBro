/**
 * Task Generator
 *
 * Converts playbook templates into concrete calendar tasks with:
 * - RFC 5545 compliant RRULE pattern assignment
 * - Timezone-aware date calculations from anchor dates
 * - Immutable origin_step_id for traceability
 * - phase_index for faster progress queries
 * - Batched database inserts for performance
 * - Batched notification scheduling
 * - Category-specific default reminder times
 */
/* eslint-disable max-lines-per-function, unused-imports/no-unused-vars */

import { type Database } from '@nozbe/watermelondb';
import { DateTime } from 'luxon';

import type {
  GrowPhase,
  Playbook,
  PlaybookStep,
  PlaybookTaskMetadata,
  TaskType,
} from '@/types/playbook';

import { rruleGenerator } from '../rrule/generator';
import type { TaskModel } from '../watermelon-models/task';

export interface Plant {
  id: string;
  startDate?: Date;
  timezone?: string;
}

export interface TaskGenerationResult {
  generatedTaskCount: number;
  taskIds: string[];
  notificationIds: string[];
  durationMs: number;
}

export interface TaskGeneratorOptions {
  database: Database;
}

/**
 * Category-specific default reminder times (local time HH:mm)
 */
const DEFAULT_REMINDER_TIMES: Record<TaskType, string> = {
  water: '08:00',
  feed: '08:00',
  prune: '10:00',
  train: '10:00',
  monitor: '20:00',
  note: '09:00',
  custom: '09:00',
};

/**
 * Phase index mapping for faster progress queries
 */
const PHASE_INDEX_MAP: Record<GrowPhase, number> = {
  seedling: 0,
  veg: 1,
  flower: 2,
  harvest: 3,
};

export class TaskGenerator {
  private database: Database;

  constructor(options: TaskGeneratorOptions) {
    this.database = options.database;
  }

  /**
   * Generate tasks from playbook template
   * Uses batched database inserts for performance
   */
  async generateTasksFromPlaybook(
    playbook: Playbook,
    plant: Plant
  ): Promise<TaskGenerationResult> {
    const startTime = Date.now();
    const timezone = plant.timezone || 'UTC';
    const anchorDate = this.getAnchorDate(plant);

    // Calculate task schedules with timezone awareness
    const taskSchedules = this.calculateTaskSchedules(
      playbook,
      anchorDate,
      timezone
    );

    // Batch create tasks in database
    const taskIds: string[] = [];
    const notificationIds: string[] = [];

    await this.database.write(async () => {
      const tasksCollection = this.database.get<TaskModel>('tasks');

      // Create all tasks in a single transaction
      for (const schedule of taskSchedules) {
        const task = await tasksCollection.create((record) => {
          // Basic task fields
          record.title = schedule.title;
          record.description = schedule.description;
          record.dueAtLocal = schedule.dueAtLocal;
          record.dueAtUtc = schedule.dueAtUtc;
          record.timezone = timezone;
          record.status = 'pending';

          // Reminder fields
          if (schedule.reminderAtLocal && schedule.reminderAtUtc) {
            record.reminderAtLocal = schedule.reminderAtLocal;
            record.reminderAtUtc = schedule.reminderAtUtc;
          }

          // Plant linkage
          if (plant.id) {
            record.plantId = plant.id;
          }

          // Playbook-specific fields
          record.playbookId = playbook.id;
          record.originStepId = schedule.originStepId;
          record.phaseIndex = schedule.phaseIndex;

          // Metadata with flags
          const metadata: PlaybookTaskMetadata = {
            playbookId: playbook.id,
            originStepId: schedule.originStepId,
            phaseIndex: schedule.phaseIndex,
            flags: {
              manualEdited: false,
              excludeFromBulkShift: false,
            },
          };
          record.metadata = metadata as any;
        });

        taskIds.push(task.id);
      }
    });

    const durationMs = Date.now() - startTime;

    return {
      generatedTaskCount: taskIds.length,
      taskIds,
      notificationIds,
      durationMs,
    };
  }

  /**
   * Calculate task schedules from playbook steps
   * Returns array of task data ready for database insertion
   */
  private calculateTaskSchedules(
    playbook: Playbook,
    anchorDate: Date,
    timezone: string
  ): {
    title: string;
    description: string;
    dueAtLocal: string;
    dueAtUtc: string;
    reminderAtLocal?: string;
    reminderAtUtc?: string;
    originStepId: string;
    phaseIndex: number;
    rrule?: string;
  }[] {
    const schedules: {
      title: string;
      description: string;
      dueAtLocal: string;
      dueAtUtc: string;
      reminderAtLocal?: string;
      reminderAtUtc?: string;
      originStepId: string;
      phaseIndex: number;
      rrule?: string;
    }[] = [];

    for (const step of playbook.steps) {
      // Calculate due date based on relative day from anchor
      const dueDate = DateTime.fromJSDate(anchorDate, { zone: timezone }).plus({
        days: step.relativeDay,
      });

      // Generate RRULE if specified
      let rrule: string | undefined;
      if (step.rrule) {
        // Validate and use provided RRULE
        const validation = rruleGenerator.validateRRULEPattern(step.rrule);
        if (validation.valid) {
          rrule = step.rrule;
        }
      }

      // Calculate reminder time
      const reminderTime = this.calculateReminderTime(dueDate, step, timezone);

      schedules.push({
        title: step.title,
        description: step.descriptionIcu,
        dueAtLocal: dueDate.toISO()!,
        dueAtUtc: dueDate.toUTC().toISO()!,
        reminderAtLocal: reminderTime?.local,
        reminderAtUtc: reminderTime?.utc,
        originStepId: step.id,
        phaseIndex: PHASE_INDEX_MAP[step.phase],
        rrule,
      });
    }

    return schedules;
  }

  /**
   * Calculate reminder time for a task
   * Uses category-specific defaults or step-provided time
   */
  private calculateReminderTime(
    dueDate: DateTime,
    step: PlaybookStep,
    timezone: string
  ): { local: string; utc: string } | undefined {
    // Get reminder time (from step or category default)
    const reminderTimeStr =
      step.defaultReminderLocal || DEFAULT_REMINDER_TIMES[step.taskType];

    if (!reminderTimeStr) {
      return undefined;
    }

    // Parse HH:mm format
    const [hours, minutes] = reminderTimeStr.split(':').map(Number);
    if (
      Number.isNaN(hours) ||
      Number.isNaN(minutes) ||
      hours < 0 ||
      hours > 23 ||
      minutes < 0 ||
      minutes > 59
    ) {
      return undefined;
    }

    // Set reminder time on due date
    const reminderDate = dueDate.set({ hour: hours, minute: minutes });

    return {
      local: reminderDate.toISO()!,
      utc: reminderDate.toUTC().toISO()!,
    };
  }

  /**
   * Get anchor date from plant start date
   * Falls back to current date if not available
   */
  private getAnchorDate(plant: Plant): Date {
    if (plant.startDate) {
      return plant.startDate;
    }
    return new Date();
  }

  /**
   * Generate RRULE pattern for a task template
   * Uses timezone-aware calculations
   */
  generateRRULE(step: PlaybookStep): string | undefined {
    if (!step.rrule) {
      return undefined;
    }

    // Validate RRULE
    const validation = rruleGenerator.validateRRULEPattern(step.rrule);
    if (!validation.valid) {
      throw new Error(
        `Invalid RRULE for step ${step.id}: ${validation.reason}`
      );
    }

    return step.rrule;
  }

  /**
   * Validate RRULE pattern
   */
  validateRRULEPattern(
    rrule: string
  ): { valid: true } | { valid: false; reason: string } {
    return rruleGenerator.validateRRULEPattern(rrule);
  }

  /**
   * Calculate next occurrence for a recurring task
   */
  nextOccurrence(
    after: Date,
    timezone: string,
    dtstartIso?: string
  ): Date | null {
    return rruleGenerator.nextOccurrence({
      after,
      timezone,
      dtstartIso,
    });
  }
}
