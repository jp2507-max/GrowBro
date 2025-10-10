import { Model, type Relation } from '@nozbe/watermelondb';
import {
  date,
  field,
  json,
  relation,
  text,
} from '@nozbe/watermelondb/decorators';

import type { QualityFlag } from '@/lib/nutrient-engine/types';

import type { ReservoirModel } from './reservoir';

/**
 * WatermelonDB model for pH/EC readings
 *
 * Stores pH and EC measurements with temperature compensation.
 * Tracks both raw and temperature-compensated EC values.
 * Quality flags computed at runtime, stored as JSON array.
 *
 * Requirements: 2.5, 6.2
 */
export class PhEcReadingModel extends Model {
  static table = 'ph_ec_readings';

  @text('plant_id') plantId?: string;
  @text('reservoir_id') reservoirId?: string;

  /** Measurement timestamp in epoch ms */
  @field('measured_at') measuredAt!: number;

  @field('ph') ph!: number;

  /** Raw EC reading before temperature compensation (mS/cm) */
  @field('ec_raw') ecRaw!: number;

  /** Temperature-compensated EC normalized to 25°C (mS/cm) */
  @field('ec_25c') ec25c!: number;

  /** Temperature at measurement time (°C) */
  @field('temp_c') tempC!: number;

  /** Whether meter provided automatic temperature compensation */
  @field('atc_on') atcOn!: boolean;

  /** PPM scale used: '500' or '700' */
  @text('ppm_scale') ppmScale!: string;

  @text('meter_id') meterId?: string;
  @text('note') note?: string;

  /** JSON array of quality flags: 'NO_ATC' | 'CAL_STALE' | 'TEMP_HIGH' | 'OUTLIER' */
  @json('quality_flags_json', (raw) => (raw as QualityFlag[]) || [])
  qualityFlags!: QualityFlag[];

  @text('user_id') userId?: string;

  /** Sync: server revision number for conflict resolution */
  @field('server_revision') serverRevision?: number;

  /** Sync: server timestamp in milliseconds for LWW */
  @field('server_updated_at_ms') serverUpdatedAtMs?: number;

  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
  @date('deleted_at') deletedAt?: Date;

  // Relations
  @relation('reservoirs', 'reservoir_id') reservoir?: Relation<ReservoirModel>;
}
