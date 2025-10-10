import { Model, type Relation } from '@nozbe/watermelondb';
import { date, field, relation, text } from '@nozbe/watermelondb/decorators';

import type { ReservoirModel } from './reservoir';

/**
 * WatermelonDB model for reservoir events
 *
 * Tracks reservoir changes for chart annotations and undo support.
 * Events: FILL, DILUTE, ADD_NUTRIENT, PH_UP, PH_DOWN, CHANGE
 *
 * Requirements: 2.5
 */
export class ReservoirEventModel extends Model {
  static table = 'reservoir_events';

  @text('reservoir_id') reservoirId!: string;

  /** Event type: FILL | DILUTE | ADD_NUTRIENT | PH_UP | PH_DOWN | CHANGE */
  @text('kind') kind!: string;

  /** Change in EC at 25°C (mS/cm), positive or negative */
  @field('delta_ec_25c') deltaEc25c?: number;

  /** Change in pH, positive or negative */
  @field('delta_ph') deltaPh?: number;

  @text('note') note?: string;

  @text('user_id') userId?: string;

  /** Sync: server revision number for conflict resolution */
  @field('server_revision') serverRevision?: number;

  /** Sync: server timestamp in milliseconds for LWW */
  @field('server_updated_at_ms') serverUpdatedAtMs?: number;

  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
  @date('deleted_at') deletedAt?: Date;

  // Relations
  @relation('reservoirs', 'reservoir_id') reservoir!: Relation<ReservoirModel>;
}
