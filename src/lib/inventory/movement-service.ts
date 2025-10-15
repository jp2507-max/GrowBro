/**
 * Inventory Movement Service
 *
 * Manages immutable inventory movement journal with atomic transaction support.
 * All inventory changes are recorded as append-only movements for audit trails.
 *
 * Requirements:
 * - 1.4: Immutable movement records with type, timestamp, reason in atomic transactions
 * - 3.3: Consumption movements with task_id linkage and idempotency support
 * - 10.6: 100% of inventory edits produce immutable movements
 *
 * CRITICAL: This service creates APPEND-ONLY records. No UPDATE or DELETE operations.
 * Corrections must create new adjustment movements with negative delta to reverse,
 * followed by new adjustment with correct values.
 */

import { Q } from '@nozbe/watermelondb';

import { database } from '@/lib/watermelon';
import type { InventoryBatchModel } from '@/lib/watermelon-models/inventory-batch';
import type { InventoryMovementModel } from '@/lib/watermelon-models/inventory-movement';
import type { MovementType } from '@/types/inventory';

/**
 * Create movement request
 */
export interface CreateMovementRequest {
  /** Item ID (required) */
  itemId: string;

  /** Batch ID (optional, required for batched tracking) */
  batchId?: string;

  /** Movement type (required) */
  type: MovementType;

  /** Quantity delta (signed number, validated by type) */
  quantityDelta: number;

  /** Cost per unit in minor currency units (required except for adjustments) */
  costPerUnitMinor?: number;

  /** Human-readable reason (required) */
  reason: string;

  /** Task ID for auto-deductions (optional) */
  taskId?: string;

  /** External key for idempotency (optional) */
  externalKey?: string;
}

/**
 * Movement validation error
 */
export interface MovementValidationError {
  field: string;
  message: string;
  value?: unknown;
}

/**
 * Movement operation result
 */
export interface MovementOperationResult {
  success: boolean;
  movement?: InventoryMovementModel;
  error?: string;
  validationErrors?: MovementValidationError[];
  isIdempotentDuplicate?: boolean;
}

/**
 * Movement query options
 */
export interface MovementQueryOptions {
  /** Filter by date range */
  startDate?: Date;
  endDate?: Date;

  /** Filter by movement type */
  type?: MovementType;

  /** Limit results (for pagination) */
  limit?: number;

  /** Offset for pagination */
  offset?: number;
}

/**
 * Validate movement request before creation
 * Requirement 1.4
 *
 * @param request - Movement creation request
 * @returns Validation result with errors if invalid
 */
export function validateMovement(request: CreateMovementRequest): {
  valid: boolean;
  errors: MovementValidationError[];
} {
  const errors: MovementValidationError[] = [];

  // Validate quantity delta sign by type
  if (request.type === 'receipt' && request.quantityDelta <= 0) {
    errors.push({
      field: 'quantityDelta',
      message: 'Receipt movements must have positive quantity',
      value: request.quantityDelta,
    });
  }

  if (request.type === 'consumption' && request.quantityDelta >= 0) {
    errors.push({
      field: 'quantityDelta',
      message: 'Consumption movements must have negative quantity',
      value: request.quantityDelta,
    });
  }

  // Note: Adjustment movements can have zero quantity for audit markers (e.g., skipped deductions)

  // Validate cost requirement (required except for adjustments)
  if (
    request.type !== 'adjustment' &&
    (request.costPerUnitMinor === undefined ||
      request.costPerUnitMinor === null)
  ) {
    errors.push({
      field: 'costPerUnitMinor',
      message: `Cost per unit is required for ${request.type} movements`,
      value: request.costPerUnitMinor,
    });
  }

  // Validate cost is non-negative if provided
  if (
    request.costPerUnitMinor !== undefined &&
    request.costPerUnitMinor !== null &&
    request.costPerUnitMinor < 0
  ) {
    errors.push({
      field: 'costPerUnitMinor',
      message: 'Cost per unit cannot be negative',
      value: request.costPerUnitMinor,
    });
  }

  // Validate reason is provided
  if (!request.reason || request.reason.trim().length === 0) {
    errors.push({
      field: 'reason',
      message: 'Reason is required for all movements',
      value: request.reason,
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Create immutable inventory movement record
 * Requirement 1.4, 3.3, 10.6
 *
 * IMPORTANT: This function creates APPEND-ONLY records.
 * All inventory changes must flow through this function.
 *
 * Idempotency: If external_key is provided and exists, returns existing movement.
 * Transaction: This function opens and manages its own write transaction internally.
 *
 * @param request - Movement creation request
 * @returns Operation result with movement or errors
 */
export async function createMovement(
  request: CreateMovementRequest
): Promise<MovementOperationResult> {
  // Validate request
  const validation = validateMovement(request);
  if (!validation.valid) {
    return {
      success: false,
      error: 'Movement validation failed',
      validationErrors: validation.errors,
    };
  }

  try {
    // Create movement within transaction with idempotency check
    const result = await database.write(async () => {
      const movementCollection = database.get<InventoryMovementModel>(
        'inventory_movements'
      );

      // Check for existing movement by external_key within transaction
      if (request.externalKey) {
        const existing = await movementCollection
          .query(Q.where('external_key', request.externalKey))
          .fetch();
        if (existing.length > 0) {
          return { movement: existing[0], isDuplicate: true };
        }
      }

      // Try to create movement
      let movement: InventoryMovementModel;
      try {
        movement = await movementCollection.create((record) => {
          record.itemId = request.itemId;
          record.batchId = request.batchId;
          record.type = request.type;
          record.quantityDelta = request.quantityDelta;
          record.costPerUnitMinor = request.costPerUnitMinor;
          record.reason = request.reason;
          record.taskId = request.taskId;
          record.externalKey = request.externalKey;
          // createdAt is set automatically by @readonly decorator
        });
      } catch (error) {
        // If constraint violation, check if movement was created by another operation
        if (
          error instanceof Error &&
          error.message.includes('UNIQUE constraint failed') &&
          request.externalKey
        ) {
          const existing = await movementCollection
            .query(Q.where('external_key', request.externalKey))
            .fetch();
          if (existing.length > 0) {
            return { movement: existing[0], isDuplicate: true };
          }
        }
        throw error; // Re-throw if not a handled constraint violation
      }

      return { movement, isDuplicate: false };
    });

    return {
      success: true,
      movement: result.movement,
      isIdempotentDuplicate: result.isDuplicate,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to create movement record',
    };
  }
}

/**
 * Create movement and update batch quantity atomically
 * Requirement 1.4, 3.3
 *
 * This is the primary function for batch-level inventory changes.
 * Ensures both batch update and movement creation succeed or both fail.
 *
 * @param request - Movement creation request (must include batchId)
 * @returns Operation result with movement or errors
 */
export async function createMovementWithBatchUpdate(
  request: CreateMovementRequest
): Promise<MovementOperationResult> {
  if (!request.batchId) {
    return {
      success: false,
      error: 'Batch ID is required for batch-level movements',
    };
  }

  // Validate request
  const validation = validateMovement(request);
  if (!validation.valid) {
    return {
      success: false,
      error: 'Movement validation failed',
      validationErrors: validation.errors,
    };
  }

  try {
    // Atomic transaction: check idempotency first, then create movement + update batch
    const result = await database.write(async () => {
      const movementCollection = database.get<InventoryMovementModel>(
        'inventory_movements'
      );

      // First perform lookup for existing movement with same externalKey (if provided)
      if (request.externalKey) {
        const existing = await movementCollection
          .query(Q.where('external_key', request.externalKey))
          .fetch();
        if (existing.length > 0) {
          // Movement already exists, return it without touching the batch
          return { movement: existing[0], isDuplicate: true };
        }
      }

      // Only proceed when no existing movement is found
      // Get batch and verify existence
      const batch = await database
        .get<InventoryBatchModel>('inventory_batches')
        .find(request.batchId!);

      // Update batch quantity first to ensure no duplicate movements on retries
      await batch.update((record) => {
        const newQuantity = record.quantity + request.quantityDelta;

        // Validate quantity doesn't go negative
        if (newQuantity < 0) {
          throw new Error(
            `Insufficient batch quantity. Available: ${record.quantity}, Requested: ${Math.abs(request.quantityDelta)}`
          );
        }

        record.quantity = newQuantity;
      });

      // Create movement record after batch update succeeds
      const movement = await movementCollection.create((record) => {
        record.itemId = request.itemId;
        record.batchId = request.batchId;
        record.type = request.type;
        record.quantityDelta = request.quantityDelta;
        record.costPerUnitMinor = request.costPerUnitMinor;
        record.reason = request.reason;
        record.taskId = request.taskId;
        record.externalKey = request.externalKey;
      });

      return { movement, isDuplicate: false };
    });

    return {
      success: true,
      movement: result.movement,
      isIdempotentDuplicate: result.isDuplicate,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to create movement with batch update',
    };
  }
}

/**
 * Get all movements for an item
 * Requirement 10.6
 *
 * @param itemId - Item ID
 * @param options - Query options
 * @returns Array of movements ordered by created_at DESC
 */
export async function getMovementsForItem(
  itemId: string,
  options?: MovementQueryOptions
): Promise<InventoryMovementModel[]> {
  const conditions = [Q.where('item_id', itemId)];

  // Apply date range filters if provided
  if (options?.startDate) {
    conditions.push(Q.where('created_at', Q.gte(options.startDate.getTime())));
  }
  if (options?.endDate) {
    conditions.push(Q.where('created_at', Q.lte(options.endDate.getTime())));
  }

  // Apply type filter if provided
  if (options?.type) {
    conditions.push(Q.where('type', options.type));
  }

  const results = await database
    .get<InventoryMovementModel>('inventory_movements')
    .query(...conditions, Q.sortBy('created_at', 'desc'))
    .fetch();

  // Apply pagination post-fetch since Q.skip doesn't exist in WatermelonDB
  const start = options?.offset ?? 0;
  const end = options?.limit ? start + options.limit : undefined;
  return results.slice(start, end);
}

/**
 * Get all movements for a task
 * Requirement 3.3
 *
 * @param taskId - Task ID
 * @returns Array of movements linked to task
 */
export async function getMovementsForTask(
  taskId: string
): Promise<InventoryMovementModel[]> {
  return await database
    .get<InventoryMovementModel>('inventory_movements')
    .query(Q.where('task_id', taskId), Q.sortBy('created_at', 'desc'))
    .fetch();
}

/**
 * Get movement by external key
 * Requirement 3.3
 *
 * @param externalKey - External key
 * @returns Movement if found, null otherwise
 */
export async function getMovementByExternalKey(
  externalKey: string
): Promise<InventoryMovementModel | null> {
  return await findMovementByExternalKey(externalKey);
}

/**
 * Check if external key already exists (idempotency check)
 * Requirement 3.3
 *
 * @param externalKey - External key to check
 * @returns Existing movement if found, null otherwise
 */
export async function findMovementByExternalKey(
  externalKey: string
): Promise<InventoryMovementModel | null> {
  const movements = await database
    .get<InventoryMovementModel>('inventory_movements')
    .query(Q.where('external_key', externalKey))
    .fetch();

  return movements.length > 0 ? movements[0] : null;
}

/**
 * Calculate current stock from movements (for simple tracking mode)
 * Requirement 10.6
 *
 * @param itemId - Item ID
 * @returns Current stock quantity
 */
export async function calculateStockFromMovements(
  itemId: string
): Promise<number> {
  const movements = await getMovementsForItem(itemId);

  return movements.reduce(
    (total, movement) => total + movement.quantityDelta,
    0
  );
}

/**
 * Get total cost from movements (for cost analysis)
 * Requirement 10.6
 *
 * @param movements - Array of movements
 * @returns Total cost in minor currency units
 */
export function calculateTotalCostFromMovements(
  movements: InventoryMovementModel[]
): number {
  return movements.reduce((total, movement) => {
    if (!movement.costPerUnitMinor) return total;
    const movementCost =
      Math.abs(movement.quantityDelta) * movement.costPerUnitMinor;
    return total + movementCost;
  }, 0);
}
