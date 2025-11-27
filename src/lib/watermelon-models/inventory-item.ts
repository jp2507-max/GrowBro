import { Model } from '@nozbe/watermelondb';
import { date, field, readonly, text } from '@nozbe/watermelondb/decorators';

// import type { InventoryBatchModel } from './inventory-batch';
// import type { InventoryMovementModel } from './inventory-movement';

/**
 * WatermelonDB model for inventory items
 *
 * Tracks consumable supplies (nutrients, seeds, growing media, etc.)
 * with support for simple or batched tracking modes.
 *
 * Requirements:
 * - 1.2: Item name, category, unit, tracking_mode, min_stock
 * - 10.1: Offline-first local storage with WatermelonDB
 */
export class InventoryItemModel extends Model {
  static table = 'inventory_items';

  @text('name') name!: string;
  @text('category') category!: string;
  @text('unit_of_measure') unitOfMeasure!: string;

  /** Tracking mode: 'simple' (aggregate) or 'batched' (lot/expiry tracking) */
  @text('tracking_mode') trackingMode!: 'simple' | 'batched';

  @field('is_consumable') isConsumable!: boolean;

  /** Minimum stock threshold for low-stock warnings */
  @field('min_stock') minStock!: number;

  /** Pack size / reorder multiple for calculating optimal order quantities */
  @field('reorder_multiple') reorderMultiple!: number;

  /** Lead time in days for reorder calculations */
  @field('lead_time_days') leadTimeDays?: number;

  /** Stock Keeping Unit (optional identifier) */
  @text('sku') sku?: string;

  /** Barcode (optional identifier) */
  @text('barcode') barcode?: string;

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

  /** Denormalized current stock level for quick low-stock checks */
  @field('current_stock') currentStock?: number;

  /** Relation: batches associated with this item */
  // @children('inventory_batches') batches!: Query<InventoryBatchModel>;

  /** Relation: all movements for this item */
  // @children('inventory_movements') movements!: Query<InventoryMovementModel>;
}
