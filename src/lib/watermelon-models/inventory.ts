import { Model } from '@nozbe/watermelondb';
import { date, field, text } from '@nozbe/watermelondb/decorators';

/**
 * WatermelonDB model for inventory tracking
 *
 * Final inventory records created when curing stage completes.
 * One inventory record per harvest (enforced by UNIQUE constraint).
 *
 * Requirements: 11.1 (integer grams), 11.3 (validation)
 */
export class InventoryModel extends Model {
  static table = 'inventory';

  @text('plant_id') plantId!: string;
  @text('harvest_id') harvestId!: string;
  @text('user_id') userId?: string;

  /** Final weight in integer grams (Requirement 11.1, 11.3) */
  @field('final_weight_g') finalWeightG!: number;

  /** Date harvest was completed (ISO date string) */
  @text('harvest_date') harvestDate!: string;

  /** Total duration from harvest start to inventory creation (days) */
  @field('total_duration_days') totalDurationDays!: number;

  /** Sync: server revision number for conflict resolution */
  @field('server_revision') serverRevision?: number;

  /** Sync: server timestamp in milliseconds for LWW */
  @field('server_updated_at_ms') serverUpdatedAtMs?: number;

  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
  @date('deleted_at') deletedAt?: Date;
}
