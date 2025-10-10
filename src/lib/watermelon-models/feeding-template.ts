import { Model } from '@nozbe/watermelondb';
import { date, field, json, text } from '@nozbe/watermelondb/decorators';

import type { FeedingPhase } from '@/lib/nutrient-engine/types';

/**
 * WatermelonDB model for feeding templates
 *
 * Stores feeding schedules based on growing medium and plant phase.
 * Uses JSON serialization for phases array and target ranges.
 *
 * Requirements: 8.1
 */
export class FeedingTemplateModel extends Model {
  static table = 'feeding_templates';

  @text('name') name!: string;
  @text('medium') medium!: string;

  /** JSON serialized array of FeedingPhase objects */
  @json('phases_json', (raw) => raw as FeedingPhase[])
  phases!: FeedingPhase[];

  /** JSON serialized target ranges object */
  @json('target_ranges_json', (raw) => raw as Record<string, unknown>)
  targetRanges!: Record<string, unknown>;

  @field('is_custom') isCustom!: boolean;

  @text('user_id') userId?: string;

  /** Sync: server revision number for conflict resolution */
  @field('server_revision') serverRevision?: number;

  /** Sync: server timestamp in milliseconds for LWW */
  @field('server_updated_at_ms') serverUpdatedAtMs?: number;

  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
  @date('deleted_at') deletedAt?: Date;
}
