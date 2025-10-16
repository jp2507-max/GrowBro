/**
 * Inventory Undo Service
 *
 * Implements 15-second undo window for destructive inventory actions.
 * Uses server-side validation to ensure changes haven't been modified.
 *
 * Requirements:
 * - 11.4: Undo affordances (15 second window) for destructive actions
 *
 * Supported actions:
 * - DELETE_BATCH: Restore deleted batch with all original data
 * - ADJUST_INVENTORY: Reverse inventory adjustment movement
 * - DELETE_ITEM: Restore deleted item (only if no dependent batches/movements)
 */

import type { Database } from '@nozbe/watermelondb';

import { logUndoAction } from '@/lib/inventory/sentry-breadcrumbs';
import type { InventoryBatchModel } from '@/lib/watermelon-models/inventory-batch';
import type { InventoryItemModel } from '@/lib/watermelon-models/inventory-item';
import type { InventoryMovementModel } from '@/lib/watermelon-models/inventory-movement';
import type { UndoInfo } from '@/types/inventory-errors';

/**
 * Undo window in milliseconds (15 seconds)
 */
const UNDO_WINDOW_MS = 15 * 1000;

/**
 * Pending undo information stored in memory
 * In production, this could be persisted to AsyncStorage for app restarts
 */
const pendingUndos = new Map<string, UndoInfo>();

/**
 * Check if undo is still available
 */
export function isUndoAvailable(undoId: string): boolean {
  const undoInfo = pendingUndos.get(undoId);
  if (!undoInfo) return false;

  const now = new Date();
  return now < undoInfo.expiresAt;
}

/**
 * Get undo information
 */
export function getUndoInfo(undoId: string): UndoInfo | null {
  const undoInfo = pendingUndos.get(undoId);
  if (!undoInfo) return null;

  // Check if expired
  if (!isUndoAvailable(undoId)) {
    pendingUndos.delete(undoId);
    return null;
  }

  return undoInfo;
}

/**
 * Register a destructive action for undo
 */
export function registerUndo(
  action: UndoInfo['action'],
  undoData: Record<string, unknown>,
  onUndo: () => Promise<void>
): UndoInfo {
  const now = new Date();
  const undoId = `${action}-${now.getTime()}-${Math.random().toString(36).slice(2, 9)}`;

  const undoInfo: UndoInfo = {
    action,
    performedAt: now,
    expiresAt: new Date(now.getTime() + UNDO_WINDOW_MS),
    undoData,
    onUndo,
  };

  pendingUndos.set(undoId, undoInfo);

  // Auto-cleanup after expiry
  setTimeout(() => {
    pendingUndos.delete(undoId);
  }, UNDO_WINDOW_MS + 1000);

  return undoInfo;
}

/**
 * Execute undo action
 */
export async function executeUndo(undoId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const undoInfo = getUndoInfo(undoId);

  if (!undoInfo) {
    return {
      success: false,
      error: 'Undo window expired or action not found',
    };
  }

  try {
    await undoInfo.onUndo();

    // Remove from pending after successful undo
    pendingUndos.delete(undoId);

    // Log successful undo
    logUndoAction(undoInfo.action, true, {
      undoId,
      performedAt: undoInfo.performedAt.toISOString(),
    });

    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    // Log failed undo
    logUndoAction(undoInfo.action, false, {
      undoId,
      error: errorMessage,
    });

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Undo batch deletion
 */
export async function undoDeleteBatch(
  database: Database,
  batchId: string,
  _originalData: {
    itemId: string;
    lotNumber: string;
    expiresOn?: Date;
    quantity: number;
    costPerUnitMinor: number;
    receivedAt: Date;
  }
): Promise<void> {
  await database.write(async () => {
    // Check if batch was actually deleted (soft delete check)
    const batch = await database
      .get<InventoryBatchModel>('inventory_batches')
      .find(batchId);

    if (!(batch._raw as any).deleted_at) {
      throw new Error('Batch was not deleted');
    }

    // Restore batch by clearing deleted_at
    await batch.update((b: any) => {
      b.deletedAt = null;
    });
  });
}

/**
 * Undo inventory adjustment
 *
 * Creates a reversal movement to undo the adjustment
 */
export async function undoAdjustment(options: {
  database: Database;
  movementId: string;
  originalQuantityDelta: number;
  itemId: string;
  batchId?: string;
}): Promise<void> {
  const { database, movementId, originalQuantityDelta, itemId, batchId } =
    options;
  await database.write(async () => {
    // Verify original movement exists and is an adjustment
    const originalMovement = await database
      .get<InventoryMovementModel>('inventory_movements')
      .find(movementId);

    if (originalMovement.type !== 'adjustment') {
      throw new Error('Can only undo adjustment movements');
    }

    // Create reversal movement
    const { createMovementWithBatchUpdate } = await import(
      '@/lib/inventory/movement-service'
    );

    const result = await createMovementWithBatchUpdate({
      itemId,
      batchId,
      type: 'adjustment',
      quantityDelta: -originalQuantityDelta, // Reverse the adjustment
      costPerUnitMinor: originalMovement.costPerUnitMinor,
      reason: `Undo adjustment (reversal of movement ${movementId})`,
    });

    if (!result.success) {
      throw new Error(result.error ?? 'Failed to create reversal movement');
    }
  });
}

/**
 * Undo item deletion
 *
 * Only possible if no dependent batches or movements exist
 */
export async function undoDeleteItem(
  database: Database,
  itemId: string
): Promise<void> {
  await database.write(async () => {
    // Check if item was actually deleted
    const item = await database
      .get<InventoryItemModel>('inventory_items')
      .find(itemId);

    if (!(item._raw as any).deleted_at) {
      throw new Error('Item was not deleted');
    }

    // Check for dependent batches
    const batches = await database
      .get<InventoryBatchModel>('inventory_batches')
      .query()
      .fetch();

    const itemBatches = batches.filter((b) => b.itemId === itemId);

    if (itemBatches.length > 0) {
      throw new Error(
        'Cannot undo: item has dependent batches. Delete batches first.'
      );
    }

    // Check for dependent movements
    const movements = await database
      .get<InventoryMovementModel>('inventory_movements')
      .query()
      .fetch();

    const itemMovements = movements.filter((m) => m.itemId === itemId);

    if (itemMovements.length > 0) {
      throw new Error(
        'Cannot undo: item has movement history. Deletion cannot be reversed.'
      );
    }

    // Restore item by clearing deleted_at
    await item.update((i: any) => {
      i.deletedAt = null;
    });
  });
}

/**
 * Helper to create undo info for batch deletion
 */
export function createBatchDeleteUndo(
  database: Database,
  batchId: string,
  originalData: {
    itemId: string;
    lotNumber: string;
    expiresOn?: Date;
    quantity: number;
    costPerUnitMinor: number;
    receivedAt: Date;
  }
): UndoInfo {
  return registerUndo('DELETE_BATCH', { batchId, ...originalData }, () =>
    undoDeleteBatch(database, batchId, originalData)
  );
}

/**
 * Helper to create undo info for inventory adjustment
 */
export function createAdjustmentUndo(options: {
  database: Database;
  movementId: string;
  quantityDelta: number;
  itemId: string;
  batchId?: string;
}): UndoInfo {
  const { database, movementId, quantityDelta, itemId, batchId } = options;
  return registerUndo(
    'ADJUST_INVENTORY',
    { movementId, quantityDelta, itemId, batchId },
    () =>
      undoAdjustment({
        database,
        movementId,
        originalQuantityDelta: quantityDelta,
        itemId,
        batchId,
      })
  );
}

/**
 * Helper to create undo info for item deletion
 */
export function createItemDeleteUndo(
  database: Database,
  itemId: string
): UndoInfo {
  return registerUndo('DELETE_ITEM', { itemId }, () =>
    undoDeleteItem(database, itemId)
  );
}
