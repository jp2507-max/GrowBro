/**
 * Calibration service for meter calibration management
 *
 * Provides functions to record, validate, query, and manage meter calibrations.
 * Integrates with WatermelonDB for persistence and offline support.
 *
 * Requirements: 2.7, 2.9, 8.4
 */

import type { Database } from '@nozbe/watermelondb';
import { Q } from '@nozbe/watermelondb';

import { database } from '@/lib/watermelon';
import type { CalibrationModel } from '@/lib/watermelon-models/calibration';

import type {
  Calibration,
  CalibrationMethod,
  CalibrationPoint,
  CalibrationStatus,
  CalibrationType,
} from '../types';
import {
  calculateDaysUntilExpiry,
  calculateExpirationTimestamp,
  calculateOffset,
  calculateSlope,
  getCalibrationQualityStatus,
  validateCalibrationPoint,
  validateSlope,
} from '../utils/calibration-calculations';

// ============================================================================
// Constants
// ============================================================================

/**
 * Default validity periods for calibrations (in days)
 */
const DEFAULT_VALID_DAYS: Record<CalibrationType, number> = {
  ph: 30, // pH calibrations valid for 30 days
  ec: 90, // EC calibrations valid for 90 days
};

/**
 * Standard calibration buffer values
 */
export const STANDARD_BUFFERS = {
  pH: {
    pH4: 4.01,
    pH7: 7.0,
    pH10: 10.01,
  },
  EC: {
    low: 1.413, // 1.413 mS/cm
    high: 12.88, // 12.88 mS/cm
  },
} as const;

// ============================================================================
// Calibration Recording
// ============================================================================

/**
 * Records a new calibration for a meter
 * Validates points, calculates slope/offset, and persists to database
 *
 * @param data - Calibration data
 * @param userId - Optional user ID
 * @returns Promise<CalibrationModel>
 */
export async function recordCalibration(
  data: {
    meterId: string;
    type: CalibrationType;
    points: CalibrationPoint[];
    tempC: number;
    method: CalibrationMethod;
    validDays?: number;
  },
  userId?: string
): Promise<CalibrationModel> {
  const db = database;

  // Validate calibration points
  validateCalibrationPoints(data.points, data.type);

  // Calculate slope and offset
  const { slope, offset } = calculateCalibrationValues(data);

  // Validate slope
  validateSlopeValue(slope, data.type);

  // Calculate expiration
  const validDays = data.validDays ?? DEFAULT_VALID_DAYS[data.type];
  const performedAt = Date.now();
  const expiresAt = calculateExpirationTimestamp(performedAt, validDays);

  // Create calibration record
  return createCalibrationRecord({
    db,
    data,
    slope,
    offset,
    validDays,
    performedAt,
    expiresAt,
    userId,
  });
}

// ============================================================================
// Calibration Validation
// ============================================================================

/**
 * Validates calibration status for a meter
 * Returns calibration status with expiry information
 *
 * @param meterId - Meter ID to check
 * @param type - Calibration type (ph or ec)
 * @returns Promise<CalibrationStatus>
 */
export async function validateCalibration(
  meterId: string,
  type: CalibrationType
): Promise<CalibrationStatus> {
  const activeCalibration = await getActiveCalibration(meterId, type);

  if (!activeCalibration) {
    return {
      isValid: false,
      daysUntilExpiry: -999,
      lastCalibrationDate: 0,
      needsCalibration: true,
    };
  }

  const daysUntilExpiry = calculateDaysUntilExpiry(activeCalibration.expiresAt);
  const status = getCalibrationQualityStatus(daysUntilExpiry);

  return {
    isValid: status === 'valid',
    daysUntilExpiry,
    lastCalibrationDate: activeCalibration.performedAt,
    needsCalibration: status === 'expired' || status === 'warning',
  };
}

/**
 * Checks if a meter needs recalibration
 *
 * @param meterId - Meter ID
 * @param type - Calibration type
 * @returns Promise<boolean>
 */
export async function needsRecalibration(
  meterId: string,
  type: CalibrationType
): Promise<boolean> {
  const status = await validateCalibration(meterId, type);
  return status.needsCalibration;
}

// ============================================================================
// Calibration Queries
// ============================================================================

/**
 * Gets the most recent active calibration for a meter
 *
 * @param meterId - Meter ID
 * @param type - Calibration type
 * @returns Promise<CalibrationModel | null>
 */
export async function getActiveCalibration(
  meterId: string,
  type: CalibrationType
): Promise<CalibrationModel | null> {
  const db = database;

  const calibrations = await db
    .get<CalibrationModel>('calibrations')
    .query(
      Q.where('meter_id', meterId),
      Q.where('type', type),
      Q.where('is_valid', true),
      Q.sortBy('performed_at', Q.desc)
    )
    .fetch();

  return calibrations.length > 0 ? calibrations[0] : null;
}

/**
 * Gets calibration history for a meter
 *
 * @param meterId - Meter ID
 * @param type - Optional calibration type filter
 * @param limit - Maximum number of records to return
 * @returns Promise<CalibrationModel[]>
 */
export async function getCalibrationHistory(
  meterId: string,
  type?: CalibrationType,
  limit: number = 10
): Promise<CalibrationModel[]> {
  const db = database;

  const queries = [
    Q.where('meter_id', meterId),
    Q.sortBy('performed_at', Q.desc),
    Q.take(limit),
  ];

  if (type) {
    queries.splice(1, 0, Q.where('type', type));
  }

  return db
    .get<CalibrationModel>('calibrations')
    .query(...queries)
    .fetch();
}

/**
 * Gets all calibrations expiring within a specified number of days
 * Used for reminder notifications
 *
 * @param days - Number of days to look ahead
 * @returns Promise<CalibrationModel[]>
 */
export async function getExpiringSoonCalibrations(
  days: number = 7
): Promise<CalibrationModel[]> {
  const db = database;
  const now = Date.now();
  const futureThreshold = now + days * 24 * 60 * 60 * 1000;

  return db
    .get<CalibrationModel>('calibrations')
    .query(
      Q.where('is_valid', true),
      Q.where('expires_at', Q.gte(now)),
      Q.where('expires_at', Q.lte(futureThreshold)),
      Q.sortBy('expires_at', Q.asc)
    )
    .fetch();
}

/**
 * Gets all expired calibrations that need attention
 *
 * @returns Promise<CalibrationModel[]>
 */
export async function getExpiredCalibrations(): Promise<CalibrationModel[]> {
  const db = database;
  const now = Date.now();

  return db
    .get<CalibrationModel>('calibrations')
    .query(
      Q.where('is_valid', true),
      Q.where('expires_at', Q.lt(now)),
      Q.sortBy('expires_at', Q.desc)
    )
    .fetch();
}

// ============================================================================
// Calibration Management
// ============================================================================

/**
 * Invalidates a calibration (marks as no longer valid)
 *
 * @param calibrationId - Calibration ID
 * @returns Promise<CalibrationModel>
 */
export async function invalidateCalibration(
  calibrationId: string
): Promise<CalibrationModel> {
  const db = database;
  const calibration = await db
    .get<CalibrationModel>('calibrations')
    .find(calibrationId);

  return db.write(async () => {
    return calibration.update((cal) => {
      cal.isValid = false;
    });
  });
}

/**
 * Observes active calibration for a meter (reactive query)
 * Use this in React components with useObservable
 *
 * @param meterId - Meter ID
 * @param type - Calibration type
 * @param db - Optional database instance
 */
export function observeActiveCalibration(
  meterId: string,
  type: CalibrationType,
  db?: Database
): any {
  const db2 = db || database;

  return db2
    .get<CalibrationModel>('calibrations')
    .query(
      Q.where('meter_id', meterId),
      Q.where('type', type),
      Q.where('is_valid', true),
      Q.sortBy('performed_at', Q.desc),
      Q.take(1)
    )
    .observe();
}

/**
 * Observes calibrations expiring soon (reactive query)
 *
 * @param days - Days ahead to check
 * @param db - Optional database instance
 */
export function observeExpiringSoonCalibrations(
  days: number = 7,
  db?: Database
): any {
  const db2 = db || database;
  const now = Date.now();
  const futureThreshold = now + days * 24 * 60 * 60 * 1000;

  return db2
    .get<CalibrationModel>('calibrations')
    .query(
      Q.where('is_valid', true),
      Q.where('expires_at', Q.gte(now)),
      Q.where('expires_at', Q.lte(futureThreshold)),
      Q.sortBy('expires_at', Q.asc)
    )
    .observe();
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Validates all calibration points
 */
function validateCalibrationPoints(
  points: CalibrationPoint[],
  type: CalibrationType
): void {
  for (const point of points) {
    const validation = validateCalibrationPoint(point, type);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
  }
}

/**
 * Calculates slope and offset based on calibration method
 */
function calculateCalibrationValues(data: {
  points: CalibrationPoint[];
  method: CalibrationMethod;
}): { slope: number; offset: number } {
  let slope: number;
  let offset: number;

  if (data.method === 'one_point') {
    if (data.points.length !== 1) {
      throw new Error('One-point calibration requires exactly 1 point');
    }
    slope = 1.0; // No slope adjustment for single point
    offset = calculateOffset(data.points[0]);
  } else if (data.method === 'two_point') {
    if (data.points.length !== 2) {
      throw new Error('Two-point calibration requires exactly 2 points');
    }
    slope = calculateSlope(data.points);
    offset = calculateOffset(undefined, slope, data.points);
  } else if (data.method === 'three_point') {
    if (data.points.length !== 3) {
      throw new Error('Three-point calibration requires exactly 3 points');
    }
    slope = calculateSlope(data.points);
    offset = calculateOffset(undefined, slope, data.points);
  } else {
    throw new Error(`Invalid calibration method: ${data.method}`);
  }

  return { slope, offset };
}

/**
 * Validates slope value
 */
function validateSlopeValue(slope: number, type: CalibrationType): void {
  const slopeValidation = validateSlope(slope, type);
  if (!slopeValidation.valid) {
    throw new Error(slopeValidation.warning || 'Invalid slope');
  }
}

/**
 * Creates the calibration record in the database
 */
async function createCalibrationRecord(options: {
  db: Database;
  data: {
    meterId: string;
    type: CalibrationType;
    points: CalibrationPoint[];
    tempC: number;
    method: CalibrationMethod;
  };
  slope: number;
  offset: number;
  validDays: number;
  performedAt: number;
  expiresAt: number;
  userId?: string;
}): Promise<CalibrationModel> {
  const { db, data, slope, offset, validDays, performedAt, expiresAt, userId } =
    options;

  return db.write(async () => {
    return db.get<CalibrationModel>('calibrations').create((calibration) => {
      calibration.meterId = data.meterId;
      calibration.type = data.type;
      calibration.points = data.points;
      calibration.slope = slope;
      calibration.offset = offset;
      calibration.tempC = data.tempC;
      calibration.method = data.method;
      calibration.validDays = validDays;
      calibration.performedAt = performedAt;
      calibration.expiresAt = expiresAt;
      calibration.isValid = true;
      if (userId) {
        calibration.userId = userId;
      }
    });
  });
}

/**
 * Converts CalibrationModel to Calibration type
 */
export function modelToCalibration(model: CalibrationModel): Calibration {
  return {
    id: model.id,
    meterId: model.meterId,
    type: model.type as CalibrationType,
    points: model.points,
    slope: model.slope,
    offset: model.offset,
    tempC: model.tempC,
    method: model.method as CalibrationMethod | undefined,
    validDays: model.validDays,
    performedAt: model.performedAt,
    expiresAt: model.expiresAt,
    isValid: model.isValid,
    createdAt: model.createdAt.getTime(),
    updatedAt: model.updatedAt.getTime(),
  };
}
