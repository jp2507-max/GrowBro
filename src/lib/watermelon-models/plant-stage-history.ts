import { Model, type Relation } from '@nozbe/watermelondb';
import {
  date,
  field,
  json,
  relation,
  text,
} from '@nozbe/watermelondb/decorators';

import type { PlantModel } from './plant';

/**
 * Plant stage history model
 *
 * Records stage transitions with timestamps and metadata.
 */
export class PlantStageHistoryModel extends Model {
  static table = 'plant_stage_history';

  @text('plant_id') plantId!: string;
  @text('from_stage') fromStage?: string;
  @text('to_stage') toStage?: string;
  @text('trigger') trigger!: string;
  @text('reason') reason?: string;
  @field('occurred_at') occurredAt!: number;

  @json(
    'metadata_json',
    (raw) => (raw as Record<string, unknown> | null) ?? null
  )
  metadata?: Record<string, unknown> | null;

  @text('user_id') userId?: string;

  @field('server_revision') serverRevision?: number;
  @field('server_updated_at_ms') serverUpdatedAtMs?: number;

  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
  @date('deleted_at') deletedAt?: Date;

  @relation('plants', 'plant_id')
  plant?: Relation<PlantModel>;
}
