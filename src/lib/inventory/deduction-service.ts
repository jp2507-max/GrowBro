/**
 * Inventory Deduction Service
 *
 * Core service for automatic inventory deduction with FEFO picking and FIFO costing.
 * Implements atomic transactions, idempotency, and three-choice error recovery.
 *
 * Requirements:
 * - 3.1: Automatic deduction with FEFO picking and FIFO costing
 * - 3.3: Atomic transactions with idempotency support
 * - 3.4: Insufficient stock handling with recovery options
 * - 3.6: Rollback on failure with clear error messaging
 */

import type { Database } from '@nozbe/watermelondb';

import { pickBatchesForConsumption } from '@/lib/inventory/batch-picker';
import { validateDeductionMap } from '@/lib/inventory/deduction-validators';
import { calculateScaledQuantity } from '@/lib/inventory/scaling-calculator';
import {
  logDeductionAttempt,
  logInsufficientStock,
  logInventoryMovement,
} from '@/lib/inventory/sentry-breadcrumbs';
import type { InventoryItemModel } from '@/lib/watermelon-models/inventory-item';
import type { InventoryMovementModel } from '@/lib/watermelon-models/inventory-movement';
import type {
  BatchPickResult,
  DeduceInventoryRequest,
  DeductionMapEntry,
  DeductionMovement,
  DeductionResult,
  InsufficientStockError,
  RecoveryOption,
} from '@/types/inventory-deduction';

/**
 * Deduce inventory based on deduction map
 *
 * Main entry point for inventory deduction. Validates deduction map,
 * picks batches using FEFO, creates consumption movements with FIFO costing,
 * and handles insufficient stock scenarios.
 *
 * All operations occur in a single atomic transaction. On any error,
 * all changes are rolled back.
 *
 * @param database - WatermelonDB instance
 * @param request - Deduction request with map and context
 * @returns Deduction result with movements or errors
 */
export async function deduceInventory(
  database: Database,
  request: DeduceInventoryRequest
): Promise<DeductionResult> {
  const idempotencyKey =
    request.idempotencyKey ??
    (request.taskId
      ? generateIdempotencyKey(request.taskId, request.deductionMap)
      : null);

  try {
    // Check for existing movements with this idempotency key (only if key provided)
    if (idempotencyKey) {
      const existingMovements = await checkExistingMovements(
        database,
        idempotencyKey
      );

      if (existingMovements.length > 0) {
        // Already processed - return existing movements
        return {
          success: true,
          movements: existingMovements.map(mapMovementToResult),
          idempotencyKey,
        };
      }
    }

    // Validate deduction map
    const validationErrors = await validateDeductionMap(
      database,
      request.deductionMap
    );

    if (validationErrors.length > 0) {
      return {
        success: false,
        movements: [],
        error: `Validation failed: ${validationErrors.map((e) => e.message).join('; ')}`,
        idempotencyKey,
      };
    }

    // Calculate scaled quantities and prepare picks
    const picksPerItem = await calculatePicks(database, request);

    // Check for insufficient stock
    const insufficientItems = await checkInsufficientStock(
      database,
      picksPerItem
    );

    if (insufficientItems.length > 0) {
      return {
        success: false,
        movements: [],
        insufficientItems,
        idempotencyKey,
      };
    }

    // Execute deduction in atomic transaction
    const movements = await createConsumptionMovements({
      database,
      picksPerItem,
      taskId: request.taskId ?? null,
      idempotencyKey,
      source: request.source,
    });

    return {
      success: true,
      movements: movements.map(mapMovementToResult),
      idempotencyKey,
    };
  } catch (error) {
    console.error('[DeductionService] Deduction failed:', error);
    return {
      success: false,
      movements: [],
      error: error instanceof Error ? error.message : 'Unknown error',
      idempotencyKey,
    };
  }
}

/**
 * Calculate batch picks for all items in deduction map
 */
async function calculatePicks(
  database: Database,
  request: DeduceInventoryRequest
): Promise<
  Map<
    string,
    {
      entry: DeductionMapEntry;
      quantityNeeded: number;
      picks: BatchPickResult[];
      totalAvailable: number;
      isPartial: boolean;
    }
  >
> {
  const context = request.context ?? { taskId: request.taskId ?? 'manual' };
  const picksPerItem = new Map();

  for (const entry of request.deductionMap) {
    const quantityNeeded = calculateScaledQuantity(entry, context);

    // Fetch item for logging
    const item = await database
      .get<InventoryItemModel>('inventory_items')
      .find(entry.itemId);

    const pickResult = await pickBatchesForConsumption({
      database,
      itemId: entry.itemId,
      quantityNeeded,
      allowExpiredOverride: request.allowExpiredOverride ?? false,
    });

    // Log deduction attempt with available quantity
    logDeductionAttempt({
      itemId: entry.itemId,
      itemName: item.name,
      requestedQuantity: quantityNeeded,
      availableQuantity: pickResult.totalAvailable,
      taskId: request.taskId,
    });

    picksPerItem.set(entry.itemId, {
      entry,
      quantityNeeded,
      picks: pickResult.picks,
      totalAvailable: pickResult.totalAvailable,
      isPartial: pickResult.isPartial,
    });
  }

  return picksPerItem;
}

/**
 * Check for insufficient stock in picks
 */
async function checkInsufficientStock(
  database: Database,
  picksPerItem: Map<string, any>
): Promise<InsufficientStockError[]> {
  const insufficientItems: InsufficientStockError[] = [];

  for (const [itemId, pickData] of picksPerItem) {
    if (pickData.isPartial) {
      const item = await database
        .get<InventoryItemModel>('inventory_items')
        .find(itemId);

      // Log insufficient stock for monitoring
      logInsufficientStock({
        itemId,
        itemName: item.name,
        required: pickData.quantityNeeded,
        available: pickData.totalAvailable,
        taskId,
      });

      insufficientItems.push({
        code: 'INSUFFICIENT_STOCK',
        itemId,
        itemName: item.name,
        required: pickData.quantityNeeded,
        available: pickData.totalAvailable,
        unit: item.unitOfMeasure,
        recoveryOptions: buildRecoveryOptions(
          itemId,
          pickData.quantityNeeded,
          pickData.totalAvailable
        ),
        message: `Insufficient stock for ${item.name}: need ${pickData.quantityNeeded} ${item.unitOfMeasure}, have ${pickData.totalAvailable} ${item.unitOfMeasure}`,
      });
    }
  }

  return insufficientItems;
}

/**
 * Generate deterministic idempotency key
 *
 * @param taskId - Task ID triggering deduction
 * @param deductionMap - Deduction map entries
 * @returns Idempotency key
 */
function generateIdempotencyKey(
  taskId: string,
  deductionMap: DeductionMapEntry[]
): string {
  // Deterministic: taskId + normalized deduction entries
  const normalized = deductionMap
    .map((e) => ({
      itemId: e.itemId,
      unit: e.unit,
      perTaskQuantity: e.perTaskQuantity ?? null,
      perPlantQuantity: e.perPlantQuantity ?? null,
      scalingMode: e.scalingMode ?? 'fixed',
    }))
    .sort((a, b) => a.itemId.localeCompare(b.itemId));
  const payload = JSON.stringify({ taskId, normalized });
  // Simple stable hash to shorten key
  let hash = 0;
  for (let i = 0; i < payload.length; i++) {
    hash = (hash * 31 + payload.charCodeAt(i)) | 0;
  }
  return `deduction:${taskId}:${Math.abs(hash)}`;
}

/**
 * Check for existing movements with idempotency key
 *
 * @param database - WatermelonDB instance
 * @param idempotencyKey - Idempotency key to check
 * @returns Array of existing movements
 */
async function checkExistingMovements(
  database: Database,
  idempotencyKey: string
): Promise<InventoryMovementModel[]> {
  const allMovements = await database
    .get<InventoryMovementModel>('inventory_movements')
    .query()
    .fetch();

  return allMovements.filter((movement) =>
    movement.externalKey?.startsWith(`${idempotencyKey}:`)
  );
}

interface CreateMovementsOptions {
  database: Database;
  picksPerItem: Map<
    string,
    {
      entry: DeductionMapEntry;
      quantityNeeded: number;
      picks: BatchPickResult[];
    }
  >;
  taskId: string | null;
  idempotencyKey: string | null;
  source: string;
}

/**
 * Create consumption movements in atomic transaction
 *
 * Updates batch quantities and creates movement records.
 * All operations succeed or fail as a unit.
 *
 * @param options - Movement creation options
 * @returns Array of created movements
 */
async function createConsumptionMovements(
  options: CreateMovementsOptions
): Promise<InventoryMovementModel[]> {
  const { database, picksPerItem, taskId, idempotencyKey, source } = options;
  const createdMovements: InventoryMovementModel[] = [];

  // Import internal movement service function for bulk atomic operations
  // This allows wrapping multiple movements in a single transaction
  const { createMovementWithBatchUpdateInternal } = await import(
    '@/lib/inventory/movement-service'
  );

  // Wrap entire deduction operation in single atomic transaction
  // This ensures all batch updates and movements succeed or all fail
  await database.write(async () => {
    // Process each item and its batch picks
    // picksPerItem contains Map<itemId, { entry, picks[] }>
    for (const [itemId, pickData] of picksPerItem) {
      const { entry, picks } = pickData;

      // Process each batch pick for this item
      // Multiple picks may be needed if FIFO allocation spans multiple batches
      for (let i = 0; i < picks.length; i++) {
        const pick = picks[i];

        // Generate per-pick idempotency key to handle retries correctly (only if idempotency is enabled)
        // Format: baseKey:batchId:pickIndex - allows individual pick retries
        // without affecting other picks in the same transaction
        const externalKey = idempotencyKey
          ? `${idempotencyKey}:${pick.batchId}:${i}`
          : undefined;

        // Use internal movement service function within the bulk transaction
        // This ensures batch quantity is validated before deduction
        // and movement is created atomically with all other operations
        const result = await createMovementWithBatchUpdateInternal(database, {
          itemId,
          batchId: pick.batchId,
          type: 'consumption',
          quantityDelta: -pick.quantity, // Negative for consumption
          costPerUnitMinor: pick.costPerUnitMinor, // FIFO cost from batch
          reason: `Auto-deduction from ${source}${entry.label ? `: ${entry.label}` : ''}`,
          taskId: taskId ?? undefined,
          externalKey,
        });

        // Throw on any movement creation failure to rollback entire transaction
        if (!result.success || !result.movement) {
          throw new Error(
            result.error ?? 'Failed to create consumption movement'
          );
        }

        // Log successful movement creation
        logInventoryMovement({
          type: 'consumption',
          itemId,
          quantityDelta: -pick.quantity,
          taskId: taskId ?? undefined,
        });

        createdMovements.push(result.movement);
      }
    }
  });

  return createdMovements;
}

/**
 * Build recovery options for insufficient stock
 *
 * @param itemId - Item ID with insufficient stock
 * @param required - Required quantity
 * @param available - Available quantity
 * @returns Array of recovery options
 */
function buildRecoveryOptions(
  itemId: string,
  required: number,
  available: number
): RecoveryOption[] {
  return [
    {
      action: 'partial',
      label: 'Complete with available stock',
      description: `Use ${available} and log shortage of ${required - available}`,
      data: { availableQuantity: available },
    },
    {
      action: 'skip',
      label: 'Skip inventory deduction',
      description: 'Complete task without updating inventory',
    },
    {
      action: 'adjust',
      label: 'Add inventory now',
      description: `Add ${required} to inventory then complete task`,
      data: { requiredQuantity: required, itemId },
    },
  ];
}

/**
 * Map WatermelonDB movement model to result DTO
 *
 * @param movement - Movement model
 * @returns Deduction movement DTO
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
