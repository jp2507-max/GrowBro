/**
 * Stage Configuration and Timing Guidance
 *
 * Provides metadata and timing recommendations for harvest stages
 * Requirement 2.3: Target duration guidance
 */

import { translate } from '@/lib/i18n';
import type { HarvestStage, StageConfig } from '@/types/harvest';
import { HarvestStages } from '@/types/harvest';

/**
 * Stage configurations with timing guidance
 * Durations in days
 */
export const STAGE_CONFIGS: Record<HarvestStage, StageConfig> = {
  [HarvestStages.HARVEST]: {
    stage: HarvestStages.HARVEST as HarvestStage,
    name: 'Harvest',
    description: 'Initial harvest stage - record weights and begin drying',
    target_duration_days: 0,
    min_duration_days: 0,
    max_duration_days: 1,
    required_fields: [],
    optional_fields: ['wet_weight_g', 'notes', 'photos'],
    canAdvance: true,
  },
  [HarvestStages.DRYING]: {
    stage: HarvestStages.DRYING as HarvestStage,
    name: 'Drying',
    description: 'Dry harvested material in controlled environment',
    target_duration_days: 10,
    min_duration_days: 7,
    max_duration_days: 14,
    required_fields: [],
    optional_fields: ['dry_weight_g', 'notes', 'photos'],
    canAdvance: true,
  },
  [HarvestStages.CURING]: {
    stage: HarvestStages.CURING as HarvestStage,
    name: 'Curing',
    description: 'Cure dried material to optimize flavor and quality',
    target_duration_days: 30,
    min_duration_days: 14,
    max_duration_days: 60,
    required_fields: ['dry_weight_g'],
    optional_fields: ['notes', 'photos'],
    canAdvance: true,
  },
  [HarvestStages.INVENTORY]: {
    stage: HarvestStages.INVENTORY as HarvestStage,
    name: 'Inventory',
    description: 'Final inventory record with complete harvest data',
    target_duration_days: 0,
    min_duration_days: 0,
    max_duration_days: 0,
    required_fields: ['final_weight_g'],
    optional_fields: [],
    canAdvance: false,
  },
};

/**
 * Get stage configuration
 */
export function getStageConfig(stage: HarvestStage): StageConfig {
  return STAGE_CONFIGS[stage];
}

/**
 * Get ordered list of all stages
 */
export function getAllStages(): HarvestStage[] {
  return [
    HarvestStages.HARVEST,
    HarvestStages.DRYING,
    HarvestStages.CURING,
    HarvestStages.INVENTORY,
  ];
}

/**
 * Get stage index (0-based)
 */
export function getStageIndex(stage: HarvestStage): number {
  return getAllStages().indexOf(stage);
}

/**
 * Check if stage duration is within recommended range
 */
export function isWithinRecommendedDuration(
  stage: HarvestStage,
  elapsedDays: number
): boolean {
  const config = getStageConfig(stage);
  return (
    elapsedDays >= config.min_duration_days &&
    elapsedDays <= config.max_duration_days
  );
}

/**
 * Check if stage duration exceeds maximum recommended
 */
export function exceedsMaxDuration(
  stage: HarvestStage,
  elapsedDays: number
): boolean {
  const config = getStageConfig(stage);
  return elapsedDays > config.max_duration_days;
}

/**
 * Format duration for display
 * Returns human-readable duration string
 */
export function formatDuration(days: number): string {
  if (days < 1) {
    const hours = Math.floor(days * 24);
    return hours === 1
      ? translate('harvest.duration.hour', { count: 1 })
      : translate('harvest.duration.hours', { count: hours });
  }
  return days === 1
    ? translate('harvest.duration.day', { count: 1 })
    : translate('harvest.duration.days', { count: days });
}

/**
 * Calculate elapsed days from server timestamp
 */
export function calculateElapsedDays(
  stageStartedAt: Date,
  currentTime: Date = new Date()
): number {
  const elapsedMs = currentTime.getTime() - stageStartedAt.getTime();
  return Math.floor(elapsedMs / (1000 * 60 * 60 * 24));
}

/**
 * Calculate elapsed time with precision (days, hours, minutes)
 */
export function calculateElapsedTime(
  stageStartedAt: Date,
  currentTime: Date = new Date()
): {
  days: number;
  hours: number;
  minutes: number;
  totalDays: number;
} {
  const elapsedMs = currentTime.getTime() - stageStartedAt.getTime();
  const totalDays = elapsedMs / (1000 * 60 * 60 * 24);

  const days = Math.floor(totalDays);
  const hours = Math.floor((totalDays - days) * 24);
  const minutes = Math.floor(((totalDays - days) * 24 - hours) * 60);

  return { days, hours, minutes, totalDays };
}
