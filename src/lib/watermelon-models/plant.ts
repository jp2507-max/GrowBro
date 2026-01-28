import { Model } from '@nozbe/watermelondb';
import { date, field, json, text } from '@nozbe/watermelondb/decorators';

// NOTE: When adding new table models, update the VALID_TABLE_NAMES Set in:
// src/lib/database/unsafe-sql-utils.ts
// This ensures runSql() validation includes all available tables.

export type PlantMetadataLocal = Record<string, unknown>;

export class PlantModel extends Model {
  static table = 'plants';

  @text('user_id') userId?: string | null;
  @text('name') name!: string;
  @text('stage') stage?: string | null;
  @text('strain') strain?: string | null;
  @text('photoperiod_type') photoperiodType?: string | null;
  @text('environment') environment?: string | null;
  @text('genetic_lean') geneticLean?: string | null;
  @text('planted_at') plantedAt?: string | null;
  @text('stage_entered_at') stageEnteredAt?: string | null;
  @text('expected_harvest_at') expectedHarvestAt?: string | null;
  @text('last_watered_at') lastWateredAt?: string | null;
  @text('last_fed_at') lastFedAt?: string | null;
  @text('health') health?: string | null;
  @text('image_url') imageUrl?: string | null;
  @text('notes') notes?: string | null;
  @json('metadata', (raw) => raw as PlantMetadataLocal)
  metadata?: PlantMetadataLocal | null;
  @text('remote_image_path') remoteImagePath?: string | null;
  @field('server_revision') serverRevision?: number;
  @field('server_updated_at_ms') serverUpdatedAtMs?: number;
  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
  @date('deleted_at') deletedAt?: Date;
}
