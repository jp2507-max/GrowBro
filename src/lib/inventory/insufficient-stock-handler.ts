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

  // Import movement service for atomic operations
  const { createMovementWithBatchUpdate } = await import(
    '@/lib/inventory/movement-service'
  );

  // Pick available batches
  const pickResult = await pickBatchesForConsumption({
    database,
    itemId: error.itemId,
    quantityNeeded: error.available,
    allowExpiredOverride: false,
  });

  const shortage = error.required - error.available;

  for (let i = 0; i < pickResult.picks.length; i++) {
    const pick = pickResult.picks[i];

    // Generate per-pick idempotency key
    const pickKey = `${idempotencyKey}:partial:${pick.batchId}:${i}`;

    // Use movement service for atomic batch update + movement creation
    const result = await createMovementWithBatchUpdate({
      itemId: error.itemId,
      batchId: pick.batchId,
      type: 'consumption',
      quantityDelta: -pick.quantity,
      costPerUnitMinor: pick.costPerUnitMinor,
      reason: `Partial deduction: consumed ${error.available} ${error.unit}, shortage ${shortage} ${error.unit}`,
      taskId,
      externalKey: pickKey,
    });

    if (!result.success || !result.movement) {
      throw new Error(result.error ?? 'Failed to create partial movement');
    }

    movements.push(mapMovementToResult(result.movement));
  }

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
  const { error, taskId, idempotencyKey } = options;

  // Import movement service for atomic operations
  const { createMovement } = await import('@/lib/inventory/movement-service');

  // Create zero-quantity marker movement through movement service
  const result = await createMovement({
    itemId: error.itemId,
    batchId: undefined,
    type: 'adjustment',
    quantityDelta: 0, // Zero quantity marker for audit trail
    costPerUnitMinor: 0,
    reason: `Skipped deduction due to insufficient stock: needed ${error.required} ${error.unit}, had ${error.available} ${error.unit}`,
    taskId,
    externalKey: idempotencyKey,
  });

  if (!result.success || !result.movement) {
    throw new Error(result.error ?? 'Failed to create skip marker movement');
  }

  return [mapMovementToResult(result.movement)];
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
