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
 * Plant event model
 *
 * Stores discrete plant-related signals (sprout, node count, etc.).
 */
export class PlantEventModel extends Model {
  static table = 'plant_events';

  @text('plant_id') plantId!: string;
  @text('kind') kind!: string;
  @field('occurred_at') occurredAt!: number;

  @json(
    'payload_json',
    (raw) => (raw as Record<string, unknown> | null) ?? null
  )
  payload?: Record<string, unknown> | null;

  @text('user_id') userId?: string;

  @field('server_revision') serverRevision?: number;
  @field('server_updated_at_ms') serverUpdatedAtMs?: number;

  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
  @date('deleted_at') deletedAt?: Date;

  @relation('plants', 'plant_id')
  plant?: Relation<PlantModel>;
}
