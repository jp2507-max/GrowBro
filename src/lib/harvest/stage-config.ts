/**
 * Stage Configuration and Timing Guidance
 *
 * Provides metadata and timing recommendations for harvest stages
 * Requirement 2.3: Target duration guidance
 */

import type { StageConfig } from '@/types/harvest';
import { HarvestStage } from '@/types/harvest';

/**
 * Stage configurations with timing guidance
 * Durations in days
 */
export const STAGE_CONFIGS: Record<HarvestStage, StageConfig> = {
  [HarvestStage.HARVEST]: {
    stage: HarvestStage.HARVEST,
    name: 'Harvest',
    description: 'Initial harvest stage - record weights and begin drying',
    target_duration_days: 0,
    min_duration_days: 0,
    max_duration_days: 1,
    required_fields: [],
    optional_fields: ['wet_weight_g', 'notes', 'photos'],
  },
  [HarvestStage.DRYING]: {
    stage: HarvestStage.DRYING,
    name: 'Drying',
    description: 'Dry harvested material in controlled environment',
    target_duration_days: 10,
    min_duration_days: 7,
    max_duration_days: 14,
    required_fields: [],
    optional_fields: ['dry_weight_g', 'notes', 'photos'],
  },
  [HarvestStage.CURING]: {
    stage: HarvestStage.CURING,
    name: 'Curing',
    description: 'Cure dried material to optimize flavor and quality',
    target_duration_days: 30,
    min_duration_days: 14,
    max_duration_days: 60,
    required_fields: ['dry_weight_g'],
    optional_fields: ['notes', 'photos'],
  },
  [HarvestStage.INVENTORY]: {
    stage: HarvestStage.INVENTORY,
    name: 'Inventory',
    description: 'Final inventory record with complete harvest data',
    target_duration_days: 0,
    min_duration_days: 0,
    max_duration_days: 0,
    required_fields: ['final_weight_g'],
    optional_fields: [],
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
    HarvestStage.HARVEST,
    HarvestStage.DRYING,
    HarvestStage.CURING,
    HarvestStage.INVENTORY,
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
    return hours === 1 ? '1 hour' : `${hours} hours`;
  }
  return days === 1 ? '1 day' : `${days} days`;
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
