import { Model, type Relation } from '@nozbe/watermelondb';
import {
  date,
  field,
  readonly,
  relation,
  text,
} from '@nozbe/watermelondb/decorators';

import type { InventoryBatchModel } from './inventory-batch';
import type { InventoryItemModel } from './inventory-item';

/**
 * WatermelonDB model for inventory movements
 *
 * Immutable audit trail of all inventory changes.
 * Types: receipt (positive), consumption (negative), adjustment (either)
 *
 * Requirements:
 * - 1.4: Immutable movement record with type, timestamp, reason
 * - 3.3: Atomic transaction handling
 * - 10.6: Idempotency support with external_key
 *
 * IMPORTANT: This table is append-only. No UPDATE or DELETE operations.
 * Corrections must create new adjustment movements with negative delta.
 */
export class InventoryMovementModel extends Model {
  static table = 'inventory_movements';

  /** Foreign key to inventory_items */
  @text('item_id') itemId!: string;

  /** Foreign key to inventory_batches (optional for simple tracking) */
  @text('batch_id') batchId?: string;

  /**
   * Movement type determines sign of quantity_delta:
   * - receipt: positive (adding stock)
   * - consumption: negative (removing stock)
   * - adjustment: either (corrections)
   */
  @text('type') type!: 'receipt' | 'consumption' | 'adjustment';

  /**
   * Quantity change (signed number)
   * - receipt: > 0
   * - consumption: < 0
   * - adjustment: != 0
   */
  @field('quantity_delta') quantityDelta!: number;

  /**
   * Cost per unit in minor currency units (cents)
   * Stored as integer to avoid float drift
   * Optional only for adjustments
   * Requirements: 9.1 (integer minor units), 2.3 (FIFO costing)
   */
  @field('cost_per_unit_minor') costPerUnitMinor?: number;

  /** Human-readable reason for the movement */
  @text('reason') reason!: string;

  /** Foreign key to tasks table (for auto-deductions) */
  @text('task_id') taskId?: string;

  /**
   * External key for idempotency
   * Requirements: 10.6 (prevent duplicate movements on retry)
   */
  @text('external_key') externalKey?: string;

  /** User ID for RLS (synced from server) */
  @text('user_id') userId?: string;

  /**
   * Created timestamp (immutable)
   * This is the authoritative timestamp for audit trails
   */
  @readonly @date('created_at') createdAt!: Date;

  /** Relation: parent item */
  @relation('inventory_items', 'item_id') item!: Relation<InventoryItemModel>;

  /** Relation: source batch (optional) */
  @relation('inventory_batches', 'batch_id')
  sourceBatch?: Relation<InventoryBatchModel>;
}
