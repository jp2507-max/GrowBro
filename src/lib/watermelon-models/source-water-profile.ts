import { Model } from '@nozbe/watermelondb';
import { date, field, text } from '@nozbe/watermelondb/decorators';

/**
 * WatermelonDB model for source water profiles
 *
 * Captures baseline water quality parameters for pH drift warnings
 * and accurate nutrient calculations.
 *
 * Requirements: 8.1
 */
export class SourceWaterProfileModel extends Model {
  static table = 'source_water_profiles_v2';

  @text('name') name!: string;

  /** Baseline EC at 25°C (mS/cm) */
  @field('baseline_ec_25c') baselineEc25c!: number;

  /** Alkalinity in mg/L as CaCO₃ (triggers pH drift warning if >~100) */
  @field('alkalinity_mg_per_l_caco3') alkalinityMgPerLCaCO3!: number;

  /** Water hardness in mg/L */
  @field('hardness_mg_per_l') hardnessMgPerL!: number;

  /** Last water testing date (epoch ms) */
  @field('last_tested_at') lastTestedAt!: number;

  @text('user_id') userId?: string;

  /** Sync: server revision number for conflict resolution */
  @field('server_revision') serverRevision?: number;

  /** Sync: server timestamp in milliseconds for LWW */
  @field('server_updated_at_ms') serverUpdatedAtMs?: number;

  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
  @date('deleted_at') deletedAt?: Date;
}
