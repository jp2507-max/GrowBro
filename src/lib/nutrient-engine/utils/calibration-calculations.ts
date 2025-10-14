/**
 * Calibration calculation utilities
 *
 * Provides functions for calculating slope, offset, and quality metrics
 * for pH and EC meter calibrations using one/two/three-point methods.
 *
 * Requirements: 2.9, 8.4
 */

import type { CalibrationPoint } from '../types';

/**
 * Calculates linear regression slope from two or three calibration points
 * Uses least squares method for best fit line
 *
 * @param points - Array of calibration points (min 2 points)
 * @returns Slope value
 */
export function calculateSlope(points: CalibrationPoint[]): number {
  if (points.length < 2) {
    throw new Error('At least 2 points required for slope calculation');
  }

  const n = points.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  for (const point of points) {
    sumX += point.expected;
    sumY += point.measured;
    sumXY += point.expected * point.measured;
    sumX2 += point.expected * point.expected;
  }

  // Slope = (n*Σ(xy) - Σx*Σy) / (n*Σ(x²) - (Σx)²)
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

  return slope;
}

/**
 * Calculates offset for calibration
 * For single point: offset = expected - measured
 * For multi-point: offset = mean(y) - slope * mean(x)
 *
 * @param point - Single point for one-point calibration
 * @param slope - Slope value for two/three-point calibration
 * @param points - All points for multi-point offset calculation
 * @returns Offset value
 */
export function calculateOffset(
  point?: CalibrationPoint,
  slope?: number,
  points?: CalibrationPoint[]
): number {
  // Single point calibration
  if (point && !slope && !points) {
    return point.expected - point.measured;
  }

  // Multi-point calibration
  if (slope !== undefined && points && points.length >= 2) {
    const meanX =
      points.reduce((sum, p) => sum + p.expected, 0) / points.length;
    const meanY =
      points.reduce((sum, p) => sum + p.measured, 0) / points.length;

    // offset = mean(y) - slope * mean(x)
    return meanY - slope * meanX;
  }

  throw new Error(
    'Invalid parameters: provide either single point or slope with points array'
  );
}

/**
 * Validates calibration point values are within acceptable ranges
 *
 * @param point - Calibration point to validate
 * @param type - Calibration type ('ph' or 'ec')
 * @returns Validation result with error message if invalid
 */
export function validateCalibrationPoint(
  point: CalibrationPoint,
  type: 'ph' | 'ec'
): { valid: boolean; error?: string } {
  if (type === 'ph') {
    // pH validation: 0-14 range
    if (point.expected < 0 || point.expected > 14) {
      return {
        valid: false,
        error: `pH expected value ${point.expected} is outside valid range 0.00–14.00`,
      };
    }
    if (point.measured < 0 || point.measured > 14) {
      return {
        valid: false,
        error: `pH measured value ${point.measured} is outside valid range 0.00–14.00`,
      };
    }
  } else if (type === 'ec') {
    // EC validation: 0-20 mS/cm range (wider for calibration standards)
    if (point.expected < 0 || point.expected > 20) {
      return {
        valid: false,
        error: `EC expected value ${point.expected} mS/cm is outside valid range 0.00–20.00 mS/cm`,
      };
    }
    if (point.measured < 0 || point.measured > 20) {
      return {
        valid: false,
        error: `EC measured value ${point.measured} mS/cm is outside valid range 0.00–20.00 mS/cm`,
      };
    }
  }

  // Stabilization time should be reasonable (0-300 seconds)
  if (point.stabilizationTime < 0 || point.stabilizationTime > 300) {
    return {
      valid: false,
      error: `Stabilization time ${point.stabilizationTime}s is outside reasonable range 0–300s`,
    };
  }

  return { valid: true };
}

/**
 * Validates slope value is within acceptable range
 * For pH: should be close to -59.16 mV/pH (Nernstian slope at 25°C)
 * For EC: should be close to 1.0 (linear relationship)
 *
 * @param slope - Slope value to validate
 * @param type - Calibration type
 * @returns Validation result
 */
export function validateSlope(
  slope: number,
  type: 'ph' | 'ec'
): { valid: boolean; warning?: string } {
  if (type === 'ph') {
    // pH slope should be 85-105% of ideal (-59.16 mV/pH at 25°C)
    // For calibration, we use ratio: ideal slope is ~1.0
    const minSlope = 0.85;
    const maxSlope = 1.05;

    if (slope < minSlope || slope > maxSlope) {
      return {
        valid: false,
        warning: `pH slope ${slope.toFixed(3)} is outside acceptable range ${minSlope}–${maxSlope}. Electrode may be degraded.`,
      };
    }

    if (slope < 0.9 || slope > 1.02) {
      return {
        valid: true,
        warning: `pH slope ${slope.toFixed(3)} is acceptable but not optimal. Consider electrode maintenance.`,
      };
    }
  } else if (type === 'ec') {
    // EC slope should be very close to 1.0
    const minSlope = 0.9;
    const maxSlope = 1.1;

    if (slope < minSlope || slope > maxSlope) {
      return {
        valid: false,
        warning: `EC slope ${slope.toFixed(3)} is outside acceptable range ${minSlope}–${maxSlope}. Probe may need replacement.`,
      };
    }

    if (slope < 0.95 || slope > 1.05) {
      return {
        valid: true,
        warning: `EC slope ${slope.toFixed(3)} is acceptable but not optimal. Check probe condition.`,
      };
    }
  }

  return { valid: true };
}

/**
 * Calculates expiration timestamp from performed date and validity period
 *
 * @param performedAt - Calibration timestamp (epoch ms)
 * @param validDays - Validity period in days
 * @returns Expiration timestamp (epoch ms)
 */
export function calculateExpirationTimestamp(
  performedAt: number,
  validDays: number
): number {
  return performedAt + validDays * 24 * 60 * 60 * 1000;
}

/**
 * Calculates days until calibration expires
 *
 * @param expiresAt - Expiration timestamp (epoch ms)
 * @param now - Current timestamp (epoch ms), defaults to Date.now()
 * @returns Days until expiry (negative if expired)
 */
export function calculateDaysUntilExpiry(
  expiresAt: number,
  now: number = Date.now()
): number {
  const msUntilExpiry = expiresAt - now;
  return Math.floor(msUntilExpiry / (24 * 60 * 60 * 1000));
}

/**
 * Determines calibration quality status based on age
 *
 * @param daysUntilExpiry - Days until calibration expires
 * @returns Quality status: 'valid' | 'warning' | 'expired'
 */
export function getCalibrationQualityStatus(
  daysUntilExpiry: number
): 'valid' | 'warning' | 'expired' {
  if (daysUntilExpiry <= 0) {
    return 'expired';
  }
  if (daysUntilExpiry <= 30) {
    return 'warning';
  }
  return 'valid';
}

/**
 * Calculates confidence multiplier based on calibration age
 * Used in reading quality assessment
 *
 * @param daysUntilExpiry - Days until calibration expires (not age)
 * @returns Confidence multiplier (0-1)
 */
export function calculateCalibrationConfidenceMultiplier(
  daysUntilExpiry: number
): number {
  if (daysUntilExpiry <= 0) {
    // Expired calibration
    return 0.5;
  }
  if (daysUntilExpiry < 30) {
    // Warning range (1-29 days)
    return 0.7;
  }
  // Valid range (30+ days)
  return 1.0;
}
