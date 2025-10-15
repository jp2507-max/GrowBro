/**
 * Batch Management Service
 *
 * CRUD operations for inventory batches with lot number tracking,
 * expiration dates, and integer cost tracking.
 *
 * Requirements:
 * - 2.1: Create batches with lot number, expiration, quantity, cost, received_at
 * - 2.2: Display batches sorted by expiration date (FEFO ordering)
 * - 10.1: Offline-first local storage with WatermelonDB
 */

import { Q } from '@nozbe/watermelondb';

import { database } from '@/lib/watermelon';
import type { InventoryBatchModel } from '@/lib/watermelon-models/inventory-batch';
import type {
  CreateBatchRequest,
  InventoryBatch,
  InventoryOperationResult,
  InventoryValidationError,
  UpdateBatchRequest,
} from '@/types/inventory';

/**
 * Validation error codes for batch operations
 */
export const BATCH_VALIDATION_ERRORS = {
  REQUIRED_FIELD: 'Field is required',
  INVALID_QUANTITY: 'Quantity must be a non-negative number',
  INVALID_COST: 'Cost must be a non-negative integer',
  INVALID_LOT_NUMBER: 'Lot number must not be empty',
  DUPLICATE_LOT: 'Lot number already exists for this item',
  BATCH_NOT_FOUND: 'Batch not found',
  ITEM_NOT_FOUND: 'Item not found',
  REASON_REQUIRED: 'Reason is required for quantity adjustments',
} as const;

/**
 * Convert WatermelonDB model to InventoryBatch DTO
 */
export function modelToInventoryBatch(
  model: InventoryBatchModel
): InventoryBatch {
  return {
    id: model.id,
    itemId: model.itemId,
    lotNumber: model.lotNumber,
    expiresOn: model.expiresOn,
    quantity: model.quantity,
    costPerUnitMinor: model.costPerUnitMinor,
    receivedAt: model.receivedAt,
    userId: model.userId,
    createdAt: model.createdAt,
    updatedAt: model.updatedAt,
    deletedAt: model.deletedAt,
  };
}

/**
 * Validate create batch request
 * Requirement 2.1
 */
function validateCreateBatchRequest(
  data: CreateBatchRequest
): InventoryValidationError[] {
  const errors: InventoryValidationError[] = [];

  if (!data.itemId || data.itemId.trim().length === 0) {
    errors.push({
      field: 'itemId',
      message: BATCH_VALIDATION_ERRORS.REQUIRED_FIELD,
      value: data.itemId,
    });
  }

  if (!data.lotNumber || data.lotNumber.trim().length === 0) {
    errors.push({
      field: 'lotNumber',
      message: BATCH_VALIDATION_ERRORS.INVALID_LOT_NUMBER,
      value: data.lotNumber,
    });
  }

  if (
    data.quantity === undefined ||
    data.quantity === null ||
    data.quantity < 0
  ) {
    errors.push({
      field: 'quantity',
      message: BATCH_VALIDATION_ERRORS.INVALID_QUANTITY,
      value: data.quantity,
    });
  }

  if (
    data.costPerUnitMinor === undefined ||
    data.costPerUnitMinor === null ||
    data.costPerUnitMinor < 0 ||
    !Number.isInteger(data.costPerUnitMinor)
  ) {
    errors.push({
      field: 'costPerUnitMinor',
      message: BATCH_VALIDATION_ERRORS.INVALID_COST,
      value: data.costPerUnitMinor,
    });
  }

  return errors;
}

/**
 * Check if lot number already exists for the item
 */
async function checkDuplicateLot(
  itemId: string,
  lotNumber: string,
  excludeId?: string
): Promise<boolean> {
  const collection = database.get<InventoryBatchModel>('inventory_batches');
  const clauses = [
    Q.where('item_id', itemId),
    Q.where('lot_number', lotNumber),
    Q.where('deleted_at', null),
  ];

  if (excludeId) {
    clauses.push(Q.where('id', Q.notEq(excludeId)));
  }

  const existing = await collection.query(...clauses).fetch();
  return existing.length > 0;
}

/**
 * Create a new inventory batch
 * Requirements: 2.1, 10.1
 *
 * @param data - Batch creation data
 * @returns Result with created batch or validation errors
 */
export async function addBatch(
  data: CreateBatchRequest
): Promise<InventoryOperationResult<InventoryBatch>> {
  // Validate request
  const validationErrors = validateCreateBatchRequest(data);
  if (validationErrors.length > 0) {
    return {
      success: false,
      validationErrors,
      error: 'Validation failed',
    };
  }

  // Check for duplicate lot number
  const isDuplicate = await checkDuplicateLot(data.itemId, data.lotNumber);
  if (isDuplicate) {
    return {
      success: false,
      validationErrors: [
        {
          field: 'lotNumber',
          message: BATCH_VALIDATION_ERRORS.DUPLICATE_LOT,
          value: data.lotNumber,
        },
      ],
      error: 'Duplicate lot number',
    };
  }

  try {
    const collection = database.get<InventoryBatchModel>('inventory_batches');

    const batch = await database.write(async () => {
      return collection.create((record) => {
        record.itemId = data.itemId;
        record.lotNumber = data.lotNumber.trim();
        record.expiresOn = data.expiresOn;
        record.quantity = data.quantity;
        record.costPerUnitMinor = data.costPerUnitMinor;
        record.receivedAt = data.receivedAt ?? new Date();
      });
    });

    return {
      success: true,
      data: modelToInventoryBatch(batch),
    };
  } catch (error) {
    console.error('[BatchService] Create failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create batch',
    };
  }
}

/**
 * Get batches for an item sorted by expiration date (FEFO)
 * Requirement 2.2
 *
 * @param itemId - Item ID
 * @param includeExpired - Include expired batches (default: false)
 * @returns Array of batches sorted by expiration date (earliest first)
 */
export async function getBatchesForItem(
  itemId: string,
  includeExpired: boolean = false
): Promise<InventoryBatch[]> {
  try {
    const collection = database.get<InventoryBatchModel>('inventory_batches');
    const clauses = [Q.where('item_id', itemId), Q.where('deleted_at', null)];

    const batches = await collection.query(...clauses).fetch();

    // Filter by quantity and expiry manually
    let filteredBatches = batches.filter((batch) => batch.quantity > 0);

    if (!includeExpired) {
      const now = new Date();
      filteredBatches = filteredBatches.filter(
        (batch) => !batch.expiresOn || batch.expiresOn >= now
      );
    }

    // Sort by expiration date (FEFO - First Expire First Out)
    // Batches without expiry go last
    return filteredBatches.map(modelToInventoryBatch).sort((a, b) => {
      if (!a.expiresOn && !b.expiresOn) return 0;
      if (!a.expiresOn) return 1;
      if (!b.expiresOn) return -1;
      return a.expiresOn.getTime() - b.expiresOn.getTime();
    });
  } catch (error) {
    console.error('[BatchService] Get batches failed:', error);
    return [];
  }
}

/**
 * Get batch by ID
 *
 * @param id - Batch ID
 * @returns Batch or null if not found
 */
export async function getBatch(id: string): Promise<InventoryBatch | null> {
  try {
    const collection = database.get<InventoryBatchModel>('inventory_batches');
    const batch = await collection.find(id);

    if (batch.deletedAt) {
      return null;
    }

    return modelToInventoryBatch(batch);
  } catch (error) {
    console.error('[BatchService] Get batch failed:', error);
    return null;
  }
}

/**
 * Update batch quantity
 * Note: This should typically be done through movement records,
 * but this method is provided for manual adjustments.
 *
 * @param id - Batch ID
 * @param updates - Update data with reason
 * @returns Result with updated batch or errors
 */
export async function updateBatchQuantity(
  id: string,
  updates: UpdateBatchRequest
): Promise<InventoryOperationResult<InventoryBatch>> {
  // Validate
  if (!updates.reason || updates.reason.trim().length === 0) {
    return {
      success: false,
      validationErrors: [
        {
          field: 'reason',
          message: BATCH_VALIDATION_ERRORS.REASON_REQUIRED,
          value: updates.reason,
        },
      ],
      error: 'Reason is required',
    };
  }

  if (updates.quantity < 0) {
    return {
      success: false,
      validationErrors: [
        {
          field: 'quantity',
          message: BATCH_VALIDATION_ERRORS.INVALID_QUANTITY,
          value: updates.quantity,
        },
      ],
      error: 'Invalid quantity',
    };
  }

  try {
    const collection = database.get<InventoryBatchModel>('inventory_batches');
    const batch = await collection.find(id);

    if (batch.deletedAt) {
      return {
        success: false,
        error: BATCH_VALIDATION_ERRORS.BATCH_NOT_FOUND,
      };
    }

    const updatedBatch = await database.write(async () => {
      return batch.update((record) => {
        record.quantity = updates.quantity;
      });
    });

    return {
      success: true,
      data: modelToInventoryBatch(updatedBatch),
    };
  } catch (error) {
    console.error('[BatchService] Update failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update batch',
    };
  }
}

/**
 * Delete batch (soft delete)
 *
 * @param id - Batch ID
 * @returns Result indicating success or failure
 */
export async function deleteBatch(
  id: string
): Promise<InventoryOperationResult<void>> {
  try {
    const collection = database.get<InventoryBatchModel>('inventory_batches');
    const batch = await collection.find(id);

    if (batch.deletedAt) {
      return {
        success: false,
        error: BATCH_VALIDATION_ERRORS.BATCH_NOT_FOUND,
      };
    }

    await database.write(async () => {
      await batch.update((record) => {
        record.deletedAt = new Date();
      });
    });

    return {
      success: true,
    };
  } catch (error) {
    console.error('[BatchService] Delete failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete batch',
    };
  }
}

/**
 * Get total available quantity for an item across all batches
 *
 * @param itemId - Item ID
 * @param includeExpired - Include expired batches (default: false)
 * @returns Total available quantity
 */
export async function getTotalAvailableQuantity(
  itemId: string,
  includeExpired: boolean = false
): Promise<number> {
  const batches = await getBatchesForItem(itemId, includeExpired);
  return batches.reduce((sum, batch) => sum + batch.quantity, 0);
}
