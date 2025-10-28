/**
 * Result Aggregation Module
 *
 * Implements multi-photo result aggregation with confidence calibration
 * and OOD detection for ML inference results.
 *
 * Requirements:
 * - 2.2: Return top-1 predicted class with confidence percentage
 * - 2.3: Handle confidence below 70% with Unknown/OOD class
 * - 2.4: Multi-photo aggregation with majority vote and tie-breaking
 * - Design: Majority vote → highest confidence → Unknown if all <0.70
 */

import type {
  AggregationMethod,
  AssessmentClassRecord,
  PerImageResult,
  QualityResult,
} from '@/types/assessment';

import { getAssessmentClass, getUnknownClass } from './assessment-classes';
import { calibrateMultiplePredictions } from './confidence-calibration';

export type AggregationInput = {
  id: string;
  uri: string;
  classId: string;
  rawConfidence: number;
  quality: QualityResult;
};

export type AggregatedResult = {
  topClass: AssessmentClassRecord;
  rawConfidence: number;
  calibratedConfidence: number;
  aggregationMethod: AggregationMethod;
  isOod: boolean;
  perImage: PerImageResult[];
};

/**
 * Aggregate multiple image inference results into a single assessment result
 *
 * Aggregation rules:
 * 1. Majority vote on class predictions
 * 2. If tie, use highest calibrated confidence
 * 3. If all predictions below 0.70 threshold, return Unknown/OOD
 *
 * @param results - Array of per-image inference results
 * @returns Aggregated assessment result with calibrated confidence
 */
export function aggregateResults(
  results: AggregationInput[]
): AggregatedResult {
  if (results.length === 0) {
    throw new Error('Cannot aggregate empty results array');
  }

  // Prepare predictions for calibration
  const predictions = results.map((r) => ({
    classId: r.classId,
    rawConfidence: r.rawConfidence,
  }));

  // Apply confidence calibration and aggregation
  const calibrated = calibrateMultiplePredictions(predictions);

  // Check if result should be marked as OOD
  const isOod = !calibrated.isConfident;

  // Get the final class (use Unknown if OOD)
  const finalClassId = isOod ? 'unknown' : (calibrated.classId ?? 'unknown');
  const topClass = getAssessmentClass(finalClassId);

  // Build per-image results with calibrated data
  const perImage: PerImageResult[] = results.map((r, i) => ({
    id: r.id,
    uri: r.uri,
    classId: r.classId,
    conf: calibrated.perPrediction[i]?.calibratedConfidence ?? r.rawConfidence,
    quality: r.quality,
  }));

  return {
    topClass,
    rawConfidence: calibrated.rawConfidence,
    calibratedConfidence: calibrated.calibratedConfidence,
    aggregationMethod: calibrated.aggregationMethod,
    isOod,
    perImage,
  };
}

/**
 * Check if aggregated result should trigger community CTA
 *
 * Community CTA is triggered when:
 * - Calibrated confidence is below threshold (isOod = true)
 * - Class is explicitly marked as Unknown/OOD
 *
 * @param result - Aggregated assessment result
 * @returns True if community CTA should be shown
 */
export function shouldShowCommunityCTA(result: AggregatedResult): boolean {
  return result.isOod || result.topClass.isOod;
}

/**
 * Get confidence level label for UI display
 *
 * @param calibratedConfidence - Calibrated confidence score (0-1)
 * @returns Confidence level label
 */
export function getConfidenceLevel(
  calibratedConfidence: number
): 'high' | 'medium' | 'low' {
  if (calibratedConfidence >= 0.85) {
    return 'high';
  }
  if (calibratedConfidence >= 0.7) {
    return 'medium';
  }
  return 'low';
}

/**
 * Validate aggregation input
 *
 * @param results - Array of results to validate
 * @returns True if valid, throws error otherwise
 */
export function validateAggregationInput(results: AggregationInput[]): boolean {
  if (results.length === 0) {
    throw new Error('Results array cannot be empty');
  }

  for (const result of results) {
    if (!result.id || typeof result.id !== 'string') {
      throw new Error('Each result must have a valid id');
    }
    if (!result.uri || typeof result.uri !== 'string') {
      throw new Error('Each result must have a valid uri');
    }
    if (!result.classId || typeof result.classId !== 'string') {
      throw new Error('Each result must have a valid classId');
    }
    if (
      typeof result.rawConfidence !== 'number' ||
      result.rawConfidence < 0 ||
      result.rawConfidence > 1
    ) {
      throw new Error('rawConfidence must be a number between 0 and 1');
    }
    if (!result.quality || typeof result.quality.score !== 'number') {
      throw new Error('Each result must have a valid quality object');
    }
  }

  return true;
}

/**
 * Create a mock aggregation result for testing
 *
 * @param overrides - Partial overrides for the mock result
 * @returns Mock aggregated result
 */
export function createMockAggregatedResult(
  overrides?: Partial<AggregatedResult>
): AggregatedResult {
  const unknownClass = getUnknownClass();

  return {
    topClass: unknownClass,
    rawConfidence: 0.5,
    calibratedConfidence: 0.6,
    aggregationMethod: 'majority-vote',
    isOod: true,
    perImage: [],
    ...overrides,
  };
}
