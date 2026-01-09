/**
 * Edge Case Guidance
 *
 * Centralized user guidance for unusual data states and resolution paths
 * Requirement 19.5: Provide clear guidance for resolution of unusual data states
 */

import type { HarvestStage } from '@/types';

export interface GuidanceMessage {
  title: string;
  description: string;
  actions: GuidanceAction[];
  severity: 'info' | 'warning' | 'error';
  learnMoreUrl?: string;
}

export interface GuidanceAction {
  label: string;
  actionType: 'navigate' | 'fix' | 'override' | 'dismiss';
  targetScreen?: string;
  handler?: () => void;
}

/**
 * Get guidance for overlapping harvests scenario
 * Requirement 19.1, 19.5
 */
export function getOverlappingHarvestsGuidance(
  _plantName: string,
  _overlappingCount: number
): GuidanceMessage {
  return {
    title: 'harvest.edge_case.overlapping_harvests.title',
    description: 'harvest.edge_case.overlapping_harvests.description',
    severity: 'warning',
    actions: [
      {
        label: 'harvest.edge_case.overlapping_harvests.view_existing',
        actionType: 'navigate',
        targetScreen: 'harvest/history',
      },
      {
        label: 'harvest.edge_case.overlapping_harvests.close_other',
        actionType: 'fix',
      },
      {
        label: 'harvest.edge_case.overlapping_harvests.override',
        actionType: 'override',
      },
    ],
  };
}

/**
 * Get guidance for missing dry weight at finalization
 * Requirement 19.3, 19.5
 */
export function getMissingDryWeightGuidance(): GuidanceMessage {
  return {
    title: 'harvest.edge_case.missing_dry_weight.title',
    description: 'harvest.edge_case.missing_dry_weight.description',
    severity: 'error',
    actions: [
      {
        label: 'harvest.edge_case.missing_dry_weight.add_weight',
        actionType: 'fix',
        targetScreen: 'harvest/edit',
      },
      {
        label: 'harvest.edge_case.missing_dry_weight.dismiss',
        actionType: 'dismiss',
      },
    ],
  };
}

/**
 * Get guidance for unusual stage duration
 * Requirement 19.2, 19.5
 */
export function getUnusualDurationGuidance(params: {
  stage: HarvestStage;
  actualDays: number;
  recommendedMin: number;
  recommendedMax: number;
}): GuidanceMessage {
  const { stage, actualDays, recommendedMin } = params;
  const isTooShort = actualDays < recommendedMin;

  return {
    title: isTooShort
      ? 'harvest.edge_case.duration_too_short.title'
      : 'harvest.edge_case.duration_too_long.title',
    description: isTooShort
      ? 'harvest.edge_case.duration_too_short.description'
      : 'harvest.edge_case.duration_too_long.description',
    severity: isTooShort ? 'warning' : 'info',
    actions: [
      {
        label: 'harvest.edge_case.duration.continue',
        actionType: 'override',
      },
      {
        label: 'harvest.edge_case.duration.adjust_date',
        actionType: 'fix',
        targetScreen: 'harvest/edit',
      },
      {
        label: 'harvest.edge_case.duration.dismiss',
        actionType: 'dismiss',
      },
    ],
    learnMoreUrl: `/learn/stages/${stage}`,
  };
}

/**
 * Get guidance for significant clock skew
 * Requirement 19.4, 19.5
 */
export function getClockSkewGuidance(_skewMinutes: number): GuidanceMessage {
  return {
    title: 'harvest.edge_case.clock_skew.title',
    description: 'harvest.edge_case.clock_skew.description',
    severity: 'warning',
    actions: [
      {
        label: 'harvest.edge_case.clock_skew.sync_time',
        actionType: 'fix',
      },
      {
        label: 'harvest.edge_case.clock_skew.ignore',
        actionType: 'dismiss',
      },
    ],
  };
}

/**
 * Get guidance for stage completed before started
 * Requirement 19.2, 19.5
 */
export function getInvalidTimestampOrderGuidance(): GuidanceMessage {
  return {
    title: 'harvest.edge_case.invalid_timestamps.title',
    description: 'harvest.edge_case.invalid_timestamps.description',
    severity: 'error',
    actions: [
      {
        label: 'harvest.edge_case.invalid_timestamps.fix_dates',
        actionType: 'fix',
        targetScreen: 'harvest/edit',
      },
      {
        label: 'harvest.edge_case.invalid_timestamps.dismiss',
        actionType: 'dismiss',
      },
    ],
  };
}

/**
 * Get guidance for dry weight exceeding wet weight
 * Requirement 11.3, 19.5
 */
export function getInvalidWeightRatioGuidance(): GuidanceMessage {
  return {
    title: 'harvest.edge_case.invalid_weight_ratio.title',
    description: 'harvest.edge_case.invalid_weight_ratio.description',
    severity: 'error',
    actions: [
      {
        label: 'harvest.edge_case.invalid_weight_ratio.fix_weights',
        actionType: 'fix',
        targetScreen: 'harvest/edit',
      },
      {
        label: 'harvest.edge_case.invalid_weight_ratio.dismiss',
        actionType: 'dismiss',
      },
    ],
  };
}

/**
 * Get guidance for sync conflicts
 * Requirement 12.5, 19.5
 */
export function getSyncConflictGuidance(): GuidanceMessage {
  return {
    title: 'harvest.edge_case.sync_conflict.title',
    description: 'harvest.edge_case.sync_conflict.description',
    severity: 'info',
    actions: [
      {
        label: 'harvest.edge_case.sync_conflict.view_changes',
        actionType: 'navigate',
        targetScreen: 'harvest/details',
      },
      {
        label: 'harvest.edge_case.sync_conflict.dismiss',
        actionType: 'dismiss',
      },
    ],
  };
}

/**
 * Get guidance for photo storage full
 * Requirement 13.4, 19.5
 */
export function getStorageFullGuidance(
  _usedMB: number,
  _totalMB: number
): GuidanceMessage {
  return {
    title: 'harvest.edge_case.storage_full.title',
    description: 'harvest.edge_case.storage_full.description',
    severity: 'warning',
    actions: [
      {
        label: 'harvest.edge_case.storage_full.free_space',
        actionType: 'navigate',
        targetScreen: 'settings/storage',
      },
      {
        label: 'harvest.edge_case.storage_full.continue_without',
        actionType: 'override',
      },
      {
        label: 'harvest.edge_case.storage_full.dismiss',
        actionType: 'dismiss',
      },
    ],
  };
}

/**
 * Get comprehensive validation summary for harvest state
 * Requirement 19.5
 *
 * @param harvestState Current harvest state
 * @param harvestState.clockSkew Clock skew in milliseconds (will be converted to minutes for display)
 * @returns Array of guidance messages for all detected issues
 */
export function getHarvestValidationGuidance(harvestState: {
  hasOverlap?: boolean;
  missingDryWeight?: boolean;
  durationIssue?: {
    stage: HarvestStage;
    days: number;
    min: number;
    max: number;
  };
  clockSkew?: number; // milliseconds
  invalidOrder?: boolean;
  invalidWeightRatio?: boolean;
  syncConflict?: boolean;
}): GuidanceMessage[] {
  const guidance: GuidanceMessage[] = [];

  if (harvestState.hasOverlap) {
    guidance.push(getOverlappingHarvestsGuidance('Unknown Plant', 1));
  }

  if (harvestState.missingDryWeight) {
    guidance.push(getMissingDryWeightGuidance());
  }

  if (harvestState.durationIssue) {
    const { stage, days, min, max } = harvestState.durationIssue;
    guidance.push(
      getUnusualDurationGuidance({
        stage,
        actualDays: days,
        recommendedMin: min,
        recommendedMax: max,
      })
    );
  }

  if (harvestState.clockSkew) {
    guidance.push(
      getClockSkewGuidance(Math.round(harvestState.clockSkew / 60000))
    );
  }

  if (harvestState.invalidOrder) {
    guidance.push(getInvalidTimestampOrderGuidance());
  }

  if (harvestState.invalidWeightRatio) {
    guidance.push(getInvalidWeightRatioGuidance());
  }

  if (harvestState.syncConflict) {
    guidance.push(getSyncConflictGuidance());
  }

  return guidance;
}
