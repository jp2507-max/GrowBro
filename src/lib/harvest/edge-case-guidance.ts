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
    title: 'harvest.edgeCase.overlappingHarvests.title',
    description: 'harvest.edgeCase.overlappingHarvests.description',
    severity: 'warning',
    actions: [
      {
        label: 'harvest.edgeCase.overlappingHarvests.viewExisting',
        actionType: 'navigate',
        targetScreen: 'harvest/history',
      },
      {
        label: 'harvest.edgeCase.overlappingHarvests.closeOther',
        actionType: 'fix',
      },
      {
        label: 'harvest.edgeCase.overlappingHarvests.override',
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
    title: 'harvest.edgeCase.missingDryWeight.title',
    description: 'harvest.edgeCase.missingDryWeight.description',
    severity: 'error',
    actions: [
      {
        label: 'harvest.edgeCase.missingDryWeight.addWeight',
        actionType: 'fix',
        targetScreen: 'harvest/edit',
      },
      {
        label: 'harvest.edgeCase.missingDryWeight.dismiss',
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
      ? 'harvest.edgeCase.durationTooShort.title'
      : 'harvest.edgeCase.durationTooLong.title',
    description: isTooShort
      ? 'harvest.edgeCase.durationTooShort.description'
      : 'harvest.edgeCase.durationTooLong.description',
    severity: isTooShort ? 'warning' : 'info',
    actions: [
      {
        label: 'harvest.edgeCase.duration.continue',
        actionType: 'override',
      },
      {
        label: 'harvest.edgeCase.duration.adjustDate',
        actionType: 'fix',
        targetScreen: 'harvest/edit',
      },
      {
        label: 'harvest.edgeCase.duration.dismiss',
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
    title: 'harvest.edgeCase.clockSkew.title',
    description: 'harvest.edgeCase.clockSkew.description',
    severity: 'warning',
    actions: [
      {
        label: 'harvest.edgeCase.clockSkew.syncTime',
        actionType: 'fix',
      },
      {
        label: 'harvest.edgeCase.clockSkew.ignore',
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
    title: 'harvest.edgeCase.invalidTimestamps.title',
    description: 'harvest.edgeCase.invalidTimestamps.description',
    severity: 'error',
    actions: [
      {
        label: 'harvest.edgeCase.invalidTimestamps.fixDates',
        actionType: 'fix',
        targetScreen: 'harvest/edit',
      },
      {
        label: 'harvest.edgeCase.invalidTimestamps.dismiss',
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
    title: 'harvest.edgeCase.invalidWeightRatio.title',
    description: 'harvest.edgeCase.invalidWeightRatio.description',
    severity: 'error',
    actions: [
      {
        label: 'harvest.edgeCase.invalidWeightRatio.fixWeights',
        actionType: 'fix',
        targetScreen: 'harvest/edit',
      },
      {
        label: 'harvest.edgeCase.invalidWeightRatio.dismiss',
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
    title: 'harvest.edgeCase.syncConflict.title',
    description: 'harvest.edgeCase.syncConflict.description',
    severity: 'info',
    actions: [
      {
        label: 'harvest.edgeCase.syncConflict.viewChanges',
        actionType: 'navigate',
        targetScreen: 'harvest/details',
      },
      {
        label: 'harvest.edgeCase.syncConflict.dismiss',
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
    title: 'harvest.edgeCase.storageFull.title',
    description: 'harvest.edgeCase.storageFull.description',
    severity: 'warning',
    actions: [
      {
        label: 'harvest.edgeCase.storageFull.freeSpace',
        actionType: 'navigate',
        targetScreen: 'settings/storage',
      },
      {
        label: 'harvest.edgeCase.storageFull.continueWithout',
        actionType: 'override',
      },
      {
        label: 'harvest.edgeCase.storageFull.dismiss',
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
