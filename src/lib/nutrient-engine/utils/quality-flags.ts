/**
 * Quality flag utilities for pH/EC readings
 *
 * Provides functions to calculate quality flags and confidence scores
 * based on calibration status, temperature, ATC, and other factors.
 *
 * Requirements: 2.7
 */

import type { Calibration, PhEcReading, QualityFlag } from '../types';
import {
  calculateDaysUntilExpiry,
  getCalibrationQualityStatus,
} from './calibration-calculations';

/**
 * Calculates quality flags for a pH/EC reading
 * Flags indicate potential quality issues that users should be aware of
 *
 * @param reading - The pH/EC reading to assess
 * @param calibration - Optional calibration data for the meter
 * @returns Array of quality flags
 */
export function calculateQualityFlags(
  reading: PhEcReading,
  calibration?: Calibration | null
): QualityFlag[] {
  const flags: QualityFlag[] = [];

  // Check for missing ATC (automatic temperature compensation)
  if (!reading.atcOn) {
    flags.push('NO_ATC');
  }

  // Check for high temperature (≥28°C affects accuracy)
  if (reading.tempC >= 28) {
    flags.push('TEMP_HIGH');
  }

  // Check calibration status if available
  if (calibration) {
    const daysUntilExpiry = calculateDaysUntilExpiry(calibration.expiresAt);
    const status = getCalibrationQualityStatus(daysUntilExpiry);

    // Add CAL_STALE flag for warning or expired calibrations
    if (status === 'warning' || status === 'expired') {
      flags.push('CAL_STALE');
    }
  }

  return flags;
}

/**
 * Calculates confidence score for a reading based on quality factors
 * Score ranges from 0 (no confidence) to 1 (full confidence)
 *
 * @param reading - The pH/EC reading to assess
 * @param calibration - Optional calibration data
 * @returns Confidence score (0-1)
 */
export function calculateConfidenceScore(
  reading: PhEcReading,
  calibration?: Calibration | null
): number {
  let score = 1.0;

  // Reduce score based on calibration age
  if (calibration) {
    const daysUntilExpiry = calculateDaysUntilExpiry(calibration.expiresAt);

    if (daysUntilExpiry < 0) {
      // Expired calibration - significant reduction
      score *= 0.5;
    } else if (daysUntilExpiry <= 30) {
      // Warning range - moderate reduction
      score *= 0.7;
    }
  }

  // Reduce score for high temperature
  if (reading.tempC >= 28) {
    score *= 0.8;
  }

  // Reduce score if no ATC
  if (!reading.atcOn) {
    score *= 0.9;
  }

  return Math.max(0, Math.min(1, score));
}

/**
 * Gets user-friendly description of quality flag
 *
 * @param flag - Quality flag
 * @returns Human-readable description
 */
export function getQualityFlagDescription(flag: QualityFlag): string {
  const descriptions: Record<QualityFlag, string> = {
    NO_ATC:
      'No automatic temperature compensation - reading may be less accurate',
    CAL_STALE:
      'Meter calibration is stale - consider recalibrating for best accuracy',
    TEMP_HIGH:
      'Temperature ≥28°C - higher temperatures can affect measurement accuracy',
    OUTLIER: 'Reading differs significantly from recent measurements',
  };

  return descriptions[flag];
}

/**
 * Gets severity level for quality flag
 *
 * @param flag - Quality flag
 * @returns Severity: 'info' | 'warning' | 'critical'
 */
export function getQualityFlagSeverity(
  flag: QualityFlag
): 'info' | 'warning' | 'critical' {
  const severities: Record<QualityFlag, 'info' | 'warning' | 'critical'> = {
    NO_ATC: 'info',
    CAL_STALE: 'warning',
    TEMP_HIGH: 'warning',
    OUTLIER: 'warning',
  };

  return severities[flag];
}

/**
 * Checks if reading has any critical quality issues
 *
 * @param flags - Array of quality flags
 * @returns True if any critical issues present
 */
export function hasCriticalQualityIssues(flags: QualityFlag[]): boolean {
  return flags.some((flag) => getQualityFlagSeverity(flag) === 'critical');
}

/**
 * Gets overall quality assessment message
 *
 * @param confidenceScore - Confidence score (0-1)
 * @param flags - Quality flags
 * @returns Assessment message
 */
export function getQualityAssessmentMessage(
  confidenceScore: number,
  flags: QualityFlag[]
): string {
  if (confidenceScore >= 0.9 && flags.length === 0) {
    return 'Excellent measurement quality';
  }

  if (confidenceScore >= 0.7) {
    return 'Good measurement quality with minor considerations';
  }

  if (confidenceScore >= 0.5) {
    return 'Fair measurement quality - check calibration and conditions';
  }

  return 'Low measurement quality - recalibration strongly recommended';
}
