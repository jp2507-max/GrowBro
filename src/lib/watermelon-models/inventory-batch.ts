import { Model, type Relation } from '@nozbe/watermelondb';
import {
  date,
  field,
  readonly,
  relation,
  text,
} from '@nozbe/watermelondb/decorators';

import type { InventoryItemModel } from './inventory-item';
// import type { InventoryMovementModel } from './inventory-movement';

/**
 * WatermelonDB model for inventory batches
 *
 * Tracks individual lots/batches with expiration dates and costs.
 * Used for FEFO (First-Expire-First-Out) picking and FIFO cost valuation.
 *
 * Requirements:
 * - 2.1: Batch with lot number, expiration date, quantity, cost
 * - 2.2: FEFO ordering for picking (expires_on sorting)
 * - 10.1: Offline-first local storage with WatermelonDB
 */
export class InventoryBatchModel extends Model {
  static table = 'inventory_batches';

  /** Foreign key to inventory_items */
  @text('item_id') itemId!: string;

  /** Lot number / batch identifier */
  @text('lot_number') lotNumber!: string;

  /** Expiration date (optional, ISO date string) */
  @date('expires_on') expiresOn?: Date;

  /** Current quantity available in this batch */
  @field('quantity') quantity!: number;

  /**
   * Cost per unit in minor currency units (cents)
   * Stored as integer to avoid float drift
   * Requirements: 9.1 (integer minor units)
   */
  @field('cost_per_unit_minor') costPerUnitMinor!: number;

  /** Timestamp when batch was received */
  @date('received_at') receivedAt!: Date;

  /** User ID for RLS (synced from server) */
  @text('user_id') userId?: string;

  /** Sync: server revision number for conflict resolution */
  @field('server_revision') serverRevision?: number;

  /** Sync: server timestamp in milliseconds for LWW */
  @field('server_updated_at_ms') serverUpdatedAtMs?: number;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  /** Soft delete timestamp for sync tombstones */
  @date('deleted_at') deletedAt?: Date;

  /** Relation: parent item */
  @relation('inventory_items', 'item_id') item!: Relation<InventoryItemModel>;

  /** Relation: movements from this batch */
  // @children('inventory_movements') movements!: Query<InventoryMovementModel>;
}
