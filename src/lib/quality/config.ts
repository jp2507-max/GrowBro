import { storage } from '@/lib/storage';

import type { QualityThresholds } from './types';

const STORAGE_KEY = 'quality.thresholds.v1';

const DEFAULT_THRESHOLDS: QualityThresholds = {
  blur: {
    minVariance: 100,
    severeVariance: 60,
    weight: 0.35,
  },
  exposure: {
    underExposureMaxRatio: 0.18,
    overExposureMaxRatio: 0.18,
    acceptableRange: [0.25, 0.75],
    weight: 0.25,
  },
  whiteBalance: {
    maxDeviation: 0.15,
    severeDeviation: 0.25,
    weight: 0.2,
  },
  composition: {
    minPlantCoverage: 0.38,
    minCenterCoverage: 0.22,
    weight: 0.2,
  },
  acceptableScore: 75,
  borderlineScore: 60,
};

export function getQualityThresholds(): QualityThresholds {
  try {
    const cached = storage.getString(STORAGE_KEY);
    if (!cached) {
      return DEFAULT_THRESHOLDS;
    }

    const parsed = JSON.parse(cached) as QualityThresholds;
    return {
      ...DEFAULT_THRESHOLDS,
      ...parsed,
      blur: { ...DEFAULT_THRESHOLDS.blur, ...parsed.blur },
      exposure: { ...DEFAULT_THRESHOLDS.exposure, ...parsed.exposure },
      whiteBalance: {
        ...DEFAULT_THRESHOLDS.whiteBalance,
        ...parsed.whiteBalance,
      },
      composition: {
        ...DEFAULT_THRESHOLDS.composition,
        ...parsed.composition,
      },
    } satisfies QualityThresholds;
  } catch (error) {
    console.warn('[QualityConfig] Failed to read thresholds:', error);
  }

  return DEFAULT_THRESHOLDS;
}

export function setQualityThresholds(thresholds: QualityThresholds): void {
  try {
    storage.set(STORAGE_KEY, JSON.stringify(thresholds));
  } catch (error) {
    console.warn('[QualityConfig] Failed to persist thresholds:', error);
  }
}
