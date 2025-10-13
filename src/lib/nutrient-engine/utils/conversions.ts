/**
 * Utility functions for EC/pH conversions and temperature compensation
 *
 * This module provides core conversion utilities for the nutrient engine:
 * - Temperature compensation for EC readings
 * - EC to PPM conversion with scale support
 * - Quality flag computation
 * - Confidence score calculation
 */

import type { Calibration, PhEcReading, QualityFlag } from '../types';
import { QualityFlag as QualityFlagEnum } from '../types';

/**
 * Minimal type for quality computation containing only required fields
 */
type QualityReading = Pick<PhEcReading, 'atcOn' | 'tempC'>;

/**
 * Temperature compensation coefficient (% per °C)
 * Typical range: 1.9-2.0% per °C
 * Default: 2.0% per °C
 */
const DEFAULT_BETA = 0.02;

/**
 * Temperature threshold for quality flag (°C)
 * Readings above this temperature are flagged as TEMP_HIGH
 */
const TEMP_HIGH_THRESHOLD = 28;

/**
 * Normalize EC reading to 25°C reference temperature
 *
 * Uses linear temperature compensation model:
 * EC@25°C = EC@T / (1 + β × (T - 25))
 *
 * Where:
 * - EC@T is the raw EC reading at temperature T
 * - β is the temperature coefficient (default 0.02 = 2%/°C)
 * - T is the measurement temperature in °C
 *
 * @param ecRaw - Raw EC reading in mS/cm
 * @param tempC - Measurement temperature in Celsius
 * @param beta - Temperature compensation coefficient (default 0.02)
 * @returns EC normalized to 25°C in mS/cm
 *
 * @example
 * // Reading at 20°C
 * const ec25 = toEC25(1.5, 20); // Returns ~1.64 mS/cm
 *
 * @example
 * // Reading at 30°C
 * const ec25 = toEC25(1.5, 30); // Returns ~1.36 mS/cm
 */
export function toEC25(
  ecRaw: number,
  tempC: number,
  beta: number = DEFAULT_BETA
): number {
  // Validate inputs
  if (ecRaw < 0 || ecRaw > 10) {
    throw new Error(
      `EC reading ${ecRaw} mS/cm is outside valid range 0.00-10.00 mS/cm`
    );
  }

  if (tempC < 5 || tempC > 40) {
    throw new Error(
      `Temperature reading ${tempC}°C is outside valid range 5.00-40.00°C`
    );
  }

  if (beta < 0 || beta > 0.05) {
    throw new Error(
      `Temperature coefficient ${beta} is outside valid range 0.00-0.05`
    );
  }

  // Calculate temperature compensation factor
  const compensationFactor = 1 + beta * (tempC - 25);

  // Apply compensation
  const ec25c = ecRaw / compensationFactor;

  // Validate result
  if (ec25c < 0 || ec25c > 10) {
    throw new Error(
      'Temperature compensation resulted in invalid EC value outside 0.00-10.00 mS/cm range'
    );
  }

  return ec25c;
}

/**
 * Convert EC (mS/cm) to PPM using specified scale
 *
 * Two common scales:
 * - 500 scale (NaCl/TDS): 1.0 mS/cm = 500 ppm
 * - 700 scale (442/KCl): 1.0 mS/cm = 700 ppm
 *
 * Note: This is a view-only conversion. EC@25°C is the canonical storage unit.
 * Always display PPM with explicit scale label: "1000 ppm [500]"
 *
 * @param ecMsCm - EC value in mS/cm (typically EC@25°C)
 * @param scale - PPM scale ('500' or '700')
 * @returns PPM value rounded to nearest integer
 *
 * @example
 * // 500 scale (NaCl/TDS)
 * const ppm = ecToPpm(2.0, '500'); // Returns 1000 ppm
 *
 * @example
 * // 700 scale (442/KCl)
 * const ppm = ecToPpm(2.0, '700'); // Returns 1400 ppm
 */
export function ecToPpm(ecMsCm: number, scale: '500' | '700'): number {
  // Validate EC input
  if (ecMsCm < 0 || ecMsCm > 10) {
    throw new Error(
      `EC value ${ecMsCm} mS/cm is outside valid range 0.00-10.00 mS/cm`
    );
  }

  // Convert based on scale
  const multiplier = scale === '500' ? 500 : 700;
  return Math.round(ecMsCm * multiplier);
}

/**
 * Compute quality flags for a pH/EC reading
 *
 * Quality flags indicate potential issues with reading accuracy:
 * - NO_ATC: Automatic temperature compensation was not enabled on meter
 * - CAL_STALE: Meter calibration has expired
 * - TEMP_HIGH: Temperature is above recommended threshold (≥28°C)
 * - OUTLIER: Reading is statistically anomalous (future implementation)
 *
 * @param reading - pH/EC reading to evaluate
 * @param calibration - Optional calibration record for the meter
 * @returns Array of quality flags
 *
 * @example
 * const flags = computeQualityFlags(reading, calibration);
 * // Returns ['NO_ATC', 'TEMP_HIGH'] if ATC off and temp > 28°C
 */
export function computeQualityFlags(
  reading: PhEcReading,
  calibration?: Calibration
): QualityFlag[];
export function computeQualityFlags(
  reading: QualityReading,
  calibration?: Calibration
): QualityFlag[];
export function computeQualityFlags(
  reading: PhEcReading | QualityReading,
  calibration?: Calibration
): QualityFlag[] {
  const flags: QualityFlag[] = [];

  // Check if ATC was disabled
  if (!reading.atcOn) {
    flags.push(QualityFlagEnum.NO_ATC);
  }

  // Check calibration status
  if (calibration) {
    const now = Date.now();
    if (calibration.expiresAt < now || !calibration.isValid) {
      flags.push(QualityFlagEnum.CAL_STALE);
    }
  }

  // Check temperature threshold
  if (reading.tempC >= TEMP_HIGH_THRESHOLD) {
    flags.push(QualityFlagEnum.TEMP_HIGH);
  }

  // TODO: Implement outlier detection based on historical readings
  // This would require statistical analysis of recent readings

  return flags;
}

/**
 * Calculate confidence score for a pH/EC reading
 *
 * Confidence score is a numeric value (0-1) derived from quality factors:
 * - Calibration age: expired calibration reduces score by 30%
 * - Temperature: readings above 28°C reduce score by 20%
 * - ATC status: no ATC reduces score by 10%
 *
 * Multiple factors compound multiplicatively.
 *
 * @param reading - pH/EC reading to evaluate
 * @param calibration - Optional calibration record for the meter
 * @returns Confidence score between 0 and 1
 *
 * @example
 * const score = calculateConfidenceScore(reading, calibration);
 * // Returns 0.7 if calibration expired
 * // Returns 0.56 if calibration expired AND temp high (0.7 × 0.8)
 */
export function calculateConfidenceScore(
  reading: PhEcReading,
  calibration?: Calibration
): number;
export function calculateConfidenceScore(
  reading: QualityReading,
  calibration?: Calibration
): number;
export function calculateConfidenceScore(
  reading: PhEcReading | QualityReading,
  calibration?: Calibration
): number {
  let score = 1.0;

  // Reduce score based on calibration age
  if (calibration) {
    const now = Date.now();
    if (calibration.expiresAt < now || !calibration.isValid) {
      score *= 0.7; // 30% reduction for stale calibration
    }
  }

  // Reduce score for high temperature
  if (reading.tempC > TEMP_HIGH_THRESHOLD) {
    score *= 0.8; // 20% reduction for high temp
  }

  // Reduce score if no ATC
  if (!reading.atcOn) {
    score *= 0.9; // 10% reduction for no ATC
  }

  // Ensure score stays within bounds
  return Math.max(0, Math.min(1, score));
}

/**
 * Format PPM value with scale label for display
 *
 * @param ppm - PPM value
 * @param scale - PPM scale ('500' or '700')
 * @returns Formatted string like "1000 ppm [500]"
 *
 * @example
 * const display = formatPpmWithScale(1000, '500');
 * // Returns "1000 ppm [500]"
 */
export function formatPpmWithScale(ppm: number, scale: '500' | '700'): string {
  return `${ppm} ppm [${scale}]`;
}

/**
 * Format EC and PPM values for display
 *
 * @param ecMsCm - EC value in mS/cm
 * @param scale - PPM scale ('500' or '700')
 * @param tempC - Temperature in Celsius
 * @returns Formatted string like "2.0 mS/cm @25°C • 1000 ppm [500] • 22.4°C"
 *
 * @example
 * const display = formatEcPpmDisplay(2.0, '500', 22.4);
 * // Returns "2.0 mS/cm @25°C • 1000 ppm [500] • 22.4°C"
 */
export function formatEcPpmDisplay(
  ecMsCm: number,
  scale: '500' | '700',
  tempC: number
): string {
  const ppm = ecToPpm(ecMsCm, scale);
  return `${ecMsCm.toFixed(1)} mS/cm @25°C • ${formatPpmWithScale(ppm, scale)} • ${tempC.toFixed(1)}°C`;
}
