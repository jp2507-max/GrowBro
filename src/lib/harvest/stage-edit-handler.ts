/**
 * Stage Edit Handler
 *
 * Handles back-dated stage edits with duration recomputation and notification rescheduling
 * Requirement 19.2: Recompute derived durations consistently when historical stages are edited
 */

import {
  cancelStageReminders,
  scheduleOverdueReminder,
  scheduleStageReminder,
} from '@/lib/harvest/harvest-notification-service';
import {
  calculateElapsedDays,
  getStageConfig,
} from '@/lib/harvest/stage-config';
import { database } from '@/lib/watermelon';
import type { HarvestModel } from '@/lib/watermelon-models/harvest';
import { type HarvestStage } from '@/types/harvest';

export interface StageEditInput {
  harvestId: string;
  stageStartedAt?: Date;
  stageCompletedAt?: Date;
  notes?: string;
}

export interface StageEditResult {
  success: boolean;
  harvest: HarvestModel | null;
  durationRecomputed: boolean;
  notificationsRescheduled: boolean;
  error?: string;
}

/**
 * Calculate total duration from harvest start to completion
 *
 * @param harvest Harvest model
 * @returns Total duration in days
 */
export function calculateTotalDuration(harvest: HarvestModel): number {
  if (!harvest.stageCompletedAt) {
    // If not completed, calculate from start to now
    return calculateElapsedDays(harvest.stageStartedAt, new Date());
  }

  return calculateElapsedDays(harvest.stageStartedAt, harvest.stageCompletedAt);
}

/**
 * Validate stage edit timestamps
 * Requirement 19.2
 *
 * @param input Stage edit input
 * @returns Validation result
 */
function validateStageEdit(input: StageEditInput): {
  valid: boolean;
  error?: string;
} {
  // Validate started_at is before completed_at if both provided
  if (input.stageStartedAt && input.stageCompletedAt) {
    if (input.stageStartedAt >= input.stageCompletedAt) {
      return {
        valid: false,
        error: 'Stage start date must be before completion date',
      };
    }
  }

  // Validate timestamps are not in the future
  const now = new Date();
  if (input.stageStartedAt && input.stageStartedAt > now) {
    return {
      valid: false,
      error: 'Stage start date cannot be in the future',
    };
  }

  if (input.stageCompletedAt && input.stageCompletedAt > now) {
    return {
      valid: false,
      error: 'Stage completion date cannot be in the future',
    };
  }

  return { valid: true };
}

/**
 * Reschedule notifications after timestamp change
 */
async function rescheduleNotifications(
  harvestId: string,
  stage: HarvestStage,
  stageStartedAt: Date
): Promise<boolean> {
  await cancelStageReminders(harvestId);

  const targetResult = await scheduleStageReminder(
    harvestId,
    stage,
    stageStartedAt
  );

  if (targetResult.scheduled) {
    await scheduleOverdueReminder(harvestId, stage, stageStartedAt);
    return true;
  }

  return false;
}

/**
 * Update harvest with back-dated stage edits
 * Requirement 19.2
 *
 * @param input Stage edit parameters
 * @returns Edit result with recomputed data
 */
export async function updateStageTimestamps(
  input: StageEditInput
): Promise<StageEditResult> {
  const validation = validateStageEdit(input);
  if (!validation.valid) {
    return {
      success: false,
      harvest: null,
      durationRecomputed: false,
      notificationsRescheduled: false,
      error: validation.error,
    };
  }

  try {
    const harvestsCollection = database.get<HarvestModel>('harvests');
    const harvest = await harvestsCollection.find(input.harvestId);

    const hasTimestampChange =
      input.stageStartedAt &&
      input.stageStartedAt.getTime() !== harvest.stageStartedAt.getTime();

    const updated = await database.write(async () => {
      return await harvest.update((record) => {
        if (input.stageStartedAt) record.stageStartedAt = input.stageStartedAt;
        if (input.stageCompletedAt !== undefined)
          record.stageCompletedAt = input.stageCompletedAt;
        if (input.notes !== undefined) record.notes = input.notes;
      });
    });

    const notificationsRescheduled = updated.stageCompletedAt
      ? (await cancelStageReminders(input.harvestId), true)
      : hasTimestampChange && !updated.stageCompletedAt
        ? await rescheduleNotifications(
            input.harvestId,
            updated.stage as HarvestStage,
            updated.stageStartedAt
          )
        : false;

    return {
      success: true,
      harvest: updated,
      durationRecomputed: true,
      notificationsRescheduled,
    };
  } catch (error) {
    console.error(
      '[StageEditHandler] Failed to update stage timestamps:',
      error
    );
    return {
      success: false,
      harvest: null,
      durationRecomputed: false,
      notificationsRescheduled: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Validate that stage duration is within acceptable bounds
 * Requirement 19.2
 *
 * @param harvest Harvest model
 * @returns Validation with warnings if duration is unusual
 */
export function validateStageDuration(harvest: HarvestModel): {
  valid: boolean;
  warnings: string[];
} {
  const config = getStageConfig(harvest.stage as HarvestStage);
  const elapsed = harvest.stageCompletedAt
    ? calculateElapsedDays(harvest.stageStartedAt, harvest.stageCompletedAt)
    : calculateElapsedDays(harvest.stageStartedAt, new Date());

  const warnings: string[] = [];

  // Check if duration is below minimum
  if (elapsed < config.min_duration_days) {
    warnings.push(
      `Duration (${elapsed}d) is below recommended minimum (${config.min_duration_days}d)`
    );
  }

  // Check if duration exceeds maximum
  if (elapsed > config.max_duration_days) {
    warnings.push(
      `Duration (${elapsed}d) exceeds recommended maximum (${config.max_duration_days}d)`
    );
  }

  return {
    valid: true, // Always valid, just with warnings
    warnings,
  };
}
