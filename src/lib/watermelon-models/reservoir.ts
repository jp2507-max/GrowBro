import { Model, type Relation } from '@nozbe/watermelondb';
import { date, field, relation, text } from '@nozbe/watermelondb/decorators';

import type { SourceWaterProfileModel } from './source-water-profile';

/**
 * WatermelonDB model for nutrient reservoirs
 *
 * Tracks reservoir configuration with target pH/EC ranges.
 * Links to source water profile for baseline measurements.
 *
 * Requirements: 8.1
 */
export class ReservoirModel extends Model {
  static table = 'reservoirs_v2';

  @text('name') name!: string;

  /** Reservoir volume in liters */
  @field('volume_l') volumeL!: number;

  /** Growing medium: soil | coco | hydro */
  @text('medium') medium!: string;

  /** Target pH minimum */
  @field('target_ph_min') targetPhMin!: number;

  /** Target pH maximum */
  @field('target_ph_max') targetPhMax!: number;

  /** Target EC minimum at 25°C (mS/cm) */
  @field('target_ec_min_25c') targetEcMin25c!: number;

  /** Target EC maximum at 25°C (mS/cm) */
  @field('target_ec_max_25c') targetEcMax25c!: number;

  /** PPM scale preference: '500' or '700' */
  @text('ppm_scale') ppmScale!: string;

  @text('source_water_profile_id') sourceWaterProfileId?: string | null;

  /** Optional playbook binding for medium-specific guidance */
  @text('playbook_binding') playbookBinding?: string;

  @text('user_id') userId?: string;

  /** Sync: server revision number for conflict resolution */
  @field('server_revision') serverRevision?: number;

  /** Sync: server timestamp in milliseconds for LWW */
  @field('server_updated_at_ms') serverUpdatedAtMs?: number;

  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
  @date('deleted_at') deletedAt?: Date;

  // Relations
  @relation('source_water_profiles', 'source_water_profile_id')
  sourceWaterProfile?: Relation<SourceWaterProfileModel>;
}
