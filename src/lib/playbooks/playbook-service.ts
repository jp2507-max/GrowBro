/**
 * Playbook Service
 *
 * Manages playbook selection, application, and template management with:
 * - Playbook preview generation
 * - One-active-playbook-per-plant constraint enforcement
 * - Idempotent playbook application
 * - Performance tracking and analytics
 * - Guided plant creation flow
 */

import { type Database, Q } from '@nozbe/watermelondb';
import { randomUUID } from 'expo-crypto';

import type {
  AdjustmentContext,
  AISuggestion,
  Playbook,
  PlaybookApplicationResult,
  PlaybookPreview,
  ScheduleShiftPreview,
} from '@/types/playbook';

import type { AnalyticsClient } from '../analytics';
import { getPlaybookNotificationScheduler } from '../notifications/playbook-notification-scheduler';
import type { PlaybookModel } from '../watermelon-models/playbook';
import type { PlaybookApplicationModel } from '../watermelon-models/playbook-application';
import { type TaskModel } from '../watermelon-models/task';
import { ScheduleShifter } from './schedule-shifter';
import { TaskGenerator } from './task-generator';

export interface PlaybookServiceOptions {
  database: Database;
  analytics: AnalyticsClient;
}

export interface ApplyPlaybookOptions {
  idempotencyKey?: string;
  allowMultiple?: boolean;
}

export class PlaybookService {
  private database: Database;
  private analytics: AnalyticsClient;
  private taskGenerator: TaskGenerator;
  private scheduleShifter: ScheduleShifter;
  private notificationScheduler: ReturnType<
    typeof getPlaybookNotificationScheduler
  >;

  constructor(options: PlaybookServiceOptions) {
    this.database = options.database;
    this.analytics = options.analytics;
    this.taskGenerator = new TaskGenerator({ database: options.database });
    this.scheduleShifter = new ScheduleShifter({
      database: options.database,
      analytics: options.analytics,
    });
    this.notificationScheduler = getPlaybookNotificationScheduler();
  }

  /**
   * Get all available playbooks
   */
  async getAvailablePlaybooks(): Promise<Playbook[]> {
    const playbookModels = await this.database
      .get<PlaybookModel>('playbooks')
      .query(Q.where('deleted_at', null))
      .fetch();

    return playbookModels.map((model) => model.toPlaybook());
  }

  /**
   * Get playbook preview with total weeks, phase durations, and task count
   */
  async getPlaybookPreview(playbookId: string): Promise<PlaybookPreview> {
    const playbookModel = await this.database
      .get<PlaybookModel>('playbooks')
      .find(playbookId);

    const playbook = playbookModel.toPlaybook();
    const phaseBreakdown = this.calculatePhaseBreakdown(playbook);
    const totalDays = phaseBreakdown.reduce(
      (sum, phase) => sum + phase.durationDays,
      0
    );
    const totalWeeks = Math.ceil(totalDays / 7);
    const totalTasks = playbook.steps.length;

    return {
      playbookId: playbook.id,
      name: playbook.name,
      setup: playbook.setup,
      totalWeeks,
      totalTasks,
      phaseBreakdown,
    };
  }

  /**
   * Calculate phase breakdown from playbook steps
   */
  private calculatePhaseBreakdown(playbook: Playbook) {
    const phaseMap = new Map<
      string,
      { phase: string; maxDay: number; taskCount: number }
    >();

    playbook.steps.forEach((step) => {
      const existing = phaseMap.get(step.phase);
      if (!existing) {
        phaseMap.set(step.phase, {
          phase: step.phase,
          maxDay: step.relativeDay + (step.durationDays || 1),
          taskCount: 1,
        });
      } else {
        existing.maxDay = Math.max(
          existing.maxDay,
          step.relativeDay + (step.durationDays || 1)
        );
        existing.taskCount += 1;
      }
    });

    return playbook.phaseOrder.map((phase) => {
      const phaseData = phaseMap.get(phase);
      return {
        phase,
        durationDays: phaseData?.maxDay || 0,
        taskCount: phaseData?.taskCount || 0,
      };
    });
  }

  /**
   * Validate one-active-playbook-per-plant constraint
   *
   * Ensures only one playbook can be active (pending) at a time per plant.
   * Completed or failed applications do not block new playbook applications.
   */
  async validateOneActivePlaybookPerPlant(
    plantId: string,
    _playbookId: string
  ): Promise<boolean> {
    const pendingApplications = await this.database
      .get<PlaybookApplicationModel>('playbook_applications')
      .query(Q.where('plant_id', plantId), Q.where('status', 'pending'))
      .fetch();

    // Block if there are any pending applications for this plant
    return pendingApplications.length === 0;
  }

  /**
   * Check for existing application with idempotency key
   */
  private async checkExistingApplication(
    idempotencyKey: string
  ): Promise<PlaybookApplicationResult | null> {
    const existingApplication = await this.database
      .get<PlaybookApplicationModel>('playbook_applications')
      .query(Q.where('idempotency_key', idempotencyKey))
      .fetch();

    if (existingApplication.length > 0) {
      const existing = existingApplication[0];
      if (existing.status === 'completed') {
        return {
          appliedTaskCount: existing.taskCount,
          durationMs: existing.durationMs,
          jobId: existing.jobId,
          playbookId: existing.playbookId,
          plantId: existing.plantId,
        };
      }
    }

    return null;
  }

  /**
   * Create playbook application record
   */
  private async createApplicationRecord(params: {
    playbookId: string;
    plantId: string;
    jobId: string;
    idempotencyKey: string;
  }): Promise<PlaybookApplicationModel> {
    let applicationModel: PlaybookApplicationModel;
    await this.database.write(async () => {
      applicationModel = await this.database
        .get<PlaybookApplicationModel>('playbook_applications')
        .create((record) => {
          record.playbookId = params.playbookId;
          record.plantId = params.plantId;
          record.appliedAt = new Date();
          record.taskCount = 0;
          record.durationMs = 0;
          record.jobId = params.jobId;
          record.idempotencyKey = params.idempotencyKey;
          record.status = 'pending';
        });
    });
    return applicationModel!;
  }

  /**
   * Complete playbook application
   */
  private async completeApplication(params: {
    applicationModel: PlaybookApplicationModel;
    playbook: Playbook;
    startTime: number;
    jobId: string;
    plantId: string;
    taskCount: number;
  }): Promise<PlaybookApplicationResult> {
    const durationMs = Date.now() - params.startTime;

    await this.database.write(async () => {
      await params.applicationModel.update((record) => {
        record.durationMs = durationMs;
        record.status = 'completed';
      });
    });

    this.analytics.track('playbook_apply', {
      playbookId: params.playbook.id,
      setupType: params.playbook.setup,
      strainType: params.playbook.metadata?.strainTypes?.join(','),
    });

    return {
      appliedTaskCount: params.taskCount,
      durationMs,
      jobId: params.jobId,
      playbookId: params.playbook.id,
      plantId: params.plantId,
    };
  }

  /**
   * Apply playbook to plant with idempotency and constraint checking
   */
  async applyPlaybookToPlant(
    playbookId: string,
    plantId: string,
    options: ApplyPlaybookOptions = {}
  ): Promise<PlaybookApplicationResult> {
    const startTime = Date.now();
    const jobId = randomUUID();
    const idempotencyKey = options.idempotencyKey || randomUUID();

    if (options.idempotencyKey) {
      const existing = await this.checkExistingApplication(
        options.idempotencyKey
      );
      if (existing) return existing;
    }

    if (!options.allowMultiple) {
      const isValid = await this.validateOneActivePlaybookPerPlant(
        plantId,
        playbookId
      );
      if (!isValid) {
        throw new Error(
          'Plant already has an active playbook. Set allowMultiple=true to bypass this constraint.'
        );
      }
    }

    const playbookModel = await this.database
      .get<PlaybookModel>('playbooks')
      .find(playbookId);
    const playbook = playbookModel.toPlaybook();

    const applicationModel = await this.createApplicationRecord({
      playbookId,
      plantId,
      jobId,
      idempotencyKey,
    });

    try {
      const taskCount = await this.generateAndScheduleTasks(
        playbook,
        plantId,
        applicationModel
      );

      return await this.completeApplication({
        applicationModel,
        playbook,
        startTime,
        jobId,
        plantId,
        taskCount,
      });
    } catch (error) {
      await this.markApplicationFailed(applicationModel);
      throw error;
    }
  }

  /**
   * Generate shift preview showing affected tasks and date changes
   */
  async shiftPlaybookSchedule(
    plantId: string,
    daysDelta: number,
    flags?: {
      includeCompleted?: boolean;
      includeManuallyEdited?: boolean;
    }
  ): Promise<ScheduleShiftPreview> {
    return this.scheduleShifter.generatePreview(plantId, daysDelta, flags);
  }

  /**
   * Confirm and apply schedule shift with atomic operations and undo support
   */
  async confirmScheduleShift(_plantId: string, shiftId: string): Promise<void> {
    await this.scheduleShifter.applyShift(shiftId);
  }

  /**
   * Undo schedule shift within 30-second window
   */
  async undoScheduleShift(plantId: string, shiftId: string): Promise<void> {
    await this.scheduleShifter.undoShift(plantId, shiftId);
  }

  async suggestScheduleAdjustments(
    _plantId: string,
    _context: AdjustmentContext
  ): Promise<AISuggestion[]> {
    throw new Error('Not implemented yet - will be implemented in task 9');
  }

  async applyAISuggestion(
    _plantId: string,
    _suggestionId: string
  ): Promise<void> {
    throw new Error('Not implemented yet - will be implemented in task 9');
  }

  /**
   * Generate tasks and schedule notifications
   */
  private async generateAndScheduleTasks(
    playbook: Playbook,
    plantId: string,
    applicationModel: PlaybookApplicationModel
  ): Promise<number> {
    const plant = await this.getPlantInfo(plantId);
    const taskResult = await this.taskGenerator.generateTasksFromPlaybook(
      playbook,
      plant
    );

    await this.scheduleTaskNotifications(taskResult.taskIds);

    await this.database.write(async () => {
      await applicationModel.update((record) => {
        record.taskCount = taskResult.generatedTaskCount;
      });
    });

    return taskResult.generatedTaskCount;
  }

  /**
   * Mark application as failed
   */
  private async markApplicationFailed(
    applicationModel: PlaybookApplicationModel
  ): Promise<void> {
    await this.database.write(async () => {
      await applicationModel.update((record) => {
        record.status = 'failed';
      });
    });
  }

  /**
   * Get plant information for task generation
   */
  private async getPlantInfo(plantId: string): Promise<{
    id: string;
    startDate?: Date;
    timezone?: string;
  }> {
    return {
      id: plantId,
      startDate: new Date(),
      timezone: 'UTC',
    };
  }

  /**
   * Schedule notifications for generated tasks in batches
   * Keeps UI thread responsive by batching notification scheduling
   */
  private async scheduleTaskNotifications(taskIds: string[]): Promise<void> {
    const BATCH_SIZE = 10;
    const tasks = await this.database
      .get<TaskModel>('tasks')
      .query(Q.where('id', Q.oneOf(taskIds)))
      .fetch();

    // Process in batches to avoid blocking UI thread
    for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
      const batch = tasks.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (task) => {
          // Only schedule if task has a reminder
          if (task.reminderAtUtc || task.reminderAtLocal) {
            try {
              const result =
                await this.notificationScheduler.scheduleTaskReminder({
                  id: task.id,
                  title: task.title,
                  description: task.description,
                  reminderAtUtc: task.reminderAtUtc,
                  reminderAtLocal: task.reminderAtLocal,
                  timezone: task.timezone,
                  notificationId: task.notificationId,
                });

              // Update task with notification ID
              await this.database.write(async () => {
                await task.update((record) => {
                  record.notificationId = result.notificationId;
                });
              });
            } catch (error) {
              // Log error but don't fail the entire operation
              console.error(
                `Failed to schedule notification for task ${task.id}:`,
                error
              );
            }
          }
        })
      );
    }
  }
}
