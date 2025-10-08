import { Model } from '@nozbe/watermelondb';
import { date, field, json, text } from '@nozbe/watermelondb/decorators';

import type { HarvestStage } from '@/types';

/**
 * WatermelonDB model for harvest tracking
 *
 * Tracks post-harvest workflow through stages:
 * harvest → drying → curing → inventory
 *
 * Requirements: 11.1 (integer grams), 11.3 (validation)
 */
export class HarvestModel extends Model {
  static table = 'harvests';

  @text('plant_id') plantId!: string;
  @text('user_id') userId?: string;
  @text('stage') stage!: HarvestStage;

  /** Weight in integer grams (Requirement 11.1) */
  @field('wet_weight_g') wetWeightG?: number;

  /** Weight in integer grams (Requirement 11.1) */
  @field('dry_weight_g') dryWeightG?: number;

  /** Weight in integer grams (Requirement 11.1) */
  @field('trimmings_weight_g') trimmingsWeightG?: number;

  @text('notes') notes!: string;

  /** Server-authoritative UTC timestamp */
  @date('stage_started_at') stageStartedAt!: Date;

  /** Server-authoritative UTC timestamp */
  @date('stage_completed_at') stageCompletedAt?: Date;

  /** File URIs for photos with variant metadata (stored as JSON array) */
  @json(
    'photos',
    (raw) => raw as { variant: string; localUri: string; remotePath?: string }[]
  )
  photos!: { variant: string; localUri: string; remotePath?: string }[];

  /** Notification ID for target duration reminder */
  @text('notification_id') notificationId?: string;

  /** Notification ID for overdue/max duration reminder */
  @text('overdue_notification_id') overdueNotificationId?: string;

  /** Sync: server revision number for conflict resolution */
  @field('server_revision') serverRevision?: number;

  /** Sync: server timestamp in milliseconds for LWW */
  @field('server_updated_at_ms') serverUpdatedAtMs?: number;

  /** Sync: flag indicating conflict detected during sync */
  @field('conflict_seen') conflictSeen!: boolean;

  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
  @date('deleted_at') deletedAt?: Date;
}
