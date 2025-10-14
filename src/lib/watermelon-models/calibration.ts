import { Model } from '@nozbe/watermelondb';
import { date, field, json, text } from '@nozbe/watermelondb/decorators';

import type { CalibrationPoint } from '@/lib/nutrient-engine/types';

/**
 * WatermelonDB model for meter calibrations
 *
 * Tracks pH and EC meter calibration data with quality tracking.
 * Supports one-point, two-point, and three-point calibration methods.
 *
 * Requirements: 8.4
 */
export class CalibrationModel extends Model {
  static table = 'calibrations';

  @text('meter_id') meterId!: string;

  /** Calibration type: 'ph' or 'ec' */
  @text('type') type!: string;

  /** JSON array of calibration points */
  @json('points_json', (raw) => raw as CalibrationPoint[])
  points!: CalibrationPoint[];

  /** Calibration slope value */
  @field('slope') slope!: number;

  /** Calibration offset value */
  @field('offset') offset!: number;

  /** Temperature at calibration (°C) */
  @field('temp_c') tempC!: number;

  /** Calibration method: one_point | two_point | three_point */
  @text('method') method?: string;

  /** Validity period in days */
  @field('valid_days') validDays?: number;

  /** Calibration timestamp (epoch ms) */
  @field('performed_at') performedAt!: number;

  /** Expiration timestamp (epoch ms, computed from performed_at + valid_days) */
  @field('expires_at') expiresAt!: number;

  /** Whether calibration is currently valid */
  @field('is_valid') isValid!: boolean;

  @text('user_id') userId?: string;

  /** Sync: server revision number for conflict resolution */
  @field('server_revision') serverRevision?: number;

  /** Sync: server timestamp in milliseconds for LWW */
  @field('server_updated_at_ms') serverUpdatedAtMs?: number;

  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
  @date('deleted_at') deletedAt?: Date;
}
