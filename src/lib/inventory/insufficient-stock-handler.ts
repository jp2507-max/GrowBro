/**
 * Insufficient Stock Handler
 *
 * Handles three recovery strategies for insufficient inventory:
 * 1. Partial complete: consume available, log shortage
 * 2. Skip deduction: complete task without inventory update
 * 3. Adjust inventory: add stock then retry deduction
 *
 * Requirements:
 * - 3.4: Three-choice insufficient stock handling
 * - 3.6: All paths create movements linked to task ID
 */

import type { Database } from '@nozbe/watermelondb';

import { pickBatchesForConsumption } from '@/lib/inventory/batch-picker';
import type { InventoryBatchModel } from '@/lib/watermelon-models/inventory-batch';
import type { InventoryMovementModel } from '@/lib/watermelon-models/inventory-movement';
import type {
  DeductionMovement,
  InsufficientStockError,
} from '@/types/inventory-deduction';

export interface PartialCompleteOptions {
  database: Database;
  error: InsufficientStockError;
  taskId: string;
  idempotencyKey: string;
}

/**
 * Handle partial completion
 *
 * Consumes available stock and creates movement with shortage metadata.
 *
 * @param options - Partial completion options
 * @returns Created movements
 */
export async function handlePartialComplete(
  options: PartialCompleteOptions
): Promise<DeductionMovement[]> {
  const { database, error, taskId, idempotencyKey } = options;
  const movements: DeductionMovement[] = [];

  await database.write(async () => {
    const batchCollection =
      database.get<InventoryBatchModel>('inventory_batches');
    const movementCollection = database.get<InventoryMovementModel>(
      'inventory_movements'
    );

    // Pick available batches
    const pickResult = await pickBatchesForConsumption({
      database,
      itemId: error.itemId,
      quantityNeeded: error.available,
      allowExpiredOverride: false,
    });

    for (const pick of pickResult.picks) {
      // Update batch quantity
      const batch = await batchCollection.find(pick.batchId);
      await batch.update((b) => {
        (b as any).quantity = (b as any).quantity - pick.quantity;
      });

      // Create consumption movement with shortage metadata
      const shortage = error.required - error.available;
      const movement = await movementCollection.create((m: any) => {
        m.itemId = error.itemId;
        m.batchId = pick.batchId;
        m.type = 'consumption';
        m.quantityDelta = -pick.quantity;
        m.costPerUnitMinor = pick.costPerUnitMinor;
        m.reason = `Partial deduction: consumed ${error.available} ${error.unit}, shortage ${shortage} ${error.unit}`;
        m.taskId = taskId;
        m.externalKey = idempotencyKey;
      });

      movements.push(mapMovementToResult(movement));
    }
  });

  return movements;
}

export interface SkipDeductionOptions {
  database: Database;
  error: InsufficientStockError;
  taskId: string;
  idempotencyKey: string;
}

/**
 * Handle skip deduction
 *
 * Creates marker movement with zero quantity to record skipped deduction.
 *
 * @param options - Skip deduction options
 * @returns Created marker movement
 */
export async function handleSkipDeduction(
  options: SkipDeductionOptions
): Promise<DeductionMovement[]> {
  const { database, error, taskId, idempotencyKey } = options;
  const movements: DeductionMovement[] = [];

  await database.write(async () => {
    const movementCollection = database.get<InventoryMovementModel>(
      'inventory_movements'
    );

    // Create marker movement with zero quantity
    const movement = await movementCollection.create((m: any) => {
      m.itemId = error.itemId;
      m.batchId = null;
      m.type = 'adjustment';
      m.quantityDelta = 0; // Zero quantity marker
      m.costPerUnitMinor = 0;
      m.reason = `Skipped deduction due to insufficient stock: needed ${error.required} ${error.unit}, had ${error.available} ${error.unit}`;
      m.taskId = taskId;
      m.externalKey = idempotencyKey;
    });

    movements.push(mapMovementToResult(movement));
  });

  return movements;
}

/**
 * Handle adjust inventory
 *
 * This function prepares the adjustment data for the UI to present
 * to the user. The actual adjustment (adding new batch) should be
 * performed by the UI, then deduction should be retried.
 *
 * @param error - Insufficient stock error
 * @returns Adjustment data for UI
 */
export function prepareAdjustmentData(error: InsufficientStockError): {
  itemId: string;
  itemName: string;
  requiredQuantity: number;
  unit: string;
  shortage: number;
} {
  return {
    itemId: error.itemId,
    itemName: error.itemName,
    requiredQuantity: error.required,
    unit: error.unit,
    shortage: error.required - error.available,
  };
}

/**
 * Map WatermelonDB movement model to result DTO
 */
function mapMovementToResult(
  movement: InventoryMovementModel
): DeductionMovement {
  return {
    id: movement.id,
    itemId: movement.itemId,
    batchId: movement.batchId ?? '',
    quantityDelta: movement.quantityDelta,
    costPerUnitMinor: movement.costPerUnitMinor ?? 0,
    reason: movement.reason,
    taskId: movement.taskId ?? '',
    externalKey: movement.externalKey ?? '',
    createdAt: movement.createdAt,
  };
}
