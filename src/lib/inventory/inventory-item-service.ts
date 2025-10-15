/**
 * Inventory Item Service
 *
 * CRUD operations for inventory items with atomic transactions
 * and comprehensive validation. Implements offline-first WatermelonDB
 * storage with proper error handling.
 *
 * Requirements:
 * - 1.2: Item name, category, unit, tracking_mode, min_stock, reorder_multiple
 * - 1.3: Display item details with current stock and total value
 * - 10.1: Offline-first local storage with WatermelonDB
 */

import { Q } from '@nozbe/watermelondb';

import { database } from '@/lib/watermelon';
import type { InventoryItemModel } from '@/lib/watermelon-models/inventory-item';
import type {
  CreateInventoryItemRequest,
  InventoryFilters,
  InventoryItem,
  InventoryOperationResult,
  InventoryValidationError,
  UpdateInventoryItemRequest,
} from '@/types/inventory';

import { isValidCategory } from './categories';

/**
 * Validation error codes
 */
export const VALIDATION_ERRORS = {
  REQUIRED_FIELD: 'Field is required',
  INVALID_CATEGORY: 'Invalid category',
  INVALID_TRACKING_MODE: 'Invalid tracking mode',
  INVALID_NUMBER: 'Must be a positive number',
  INVALID_REORDER_MULTIPLE: 'Reorder multiple must be greater than 0',
  DUPLICATE_SKU: 'SKU already exists',
  DUPLICATE_BARCODE: 'Barcode already exists',
  ITEM_NOT_FOUND: 'Item not found',
} as const;

/**
 * Convert WatermelonDB model to InventoryItem DTO
 */
export function modelToInventoryItem(model: InventoryItemModel): InventoryItem {
  return {
    id: model.id,
    name: model.name,
    category: model.category as InventoryItem['category'],
    unitOfMeasure: model.unitOfMeasure,
    trackingMode: model.trackingMode,
    isConsumable: model.isConsumable,
    minStock: model.minStock,
    reorderMultiple: model.reorderMultiple,
    leadTimeDays: model.leadTimeDays,
    sku: model.sku,
    barcode: model.barcode,
    userId: model.userId,
    createdAt: model.createdAt,
    updatedAt: model.updatedAt,
    deletedAt: model.deletedAt,
  };
}

/**
 * Validate required string fields
 */
function validateRequiredFields(
  data: CreateInventoryItemRequest
): InventoryValidationError[] {
  const errors: InventoryValidationError[] = [];

  if (!data.name || data.name.trim().length === 0) {
    errors.push({
      field: 'name',
      message: VALIDATION_ERRORS.REQUIRED_FIELD,
      value: data.name,
    });
  }

  if (!data.category) {
    errors.push({
      field: 'category',
      message: VALIDATION_ERRORS.REQUIRED_FIELD,
      value: data.category,
    });
  } else if (!isValidCategory(data.category)) {
    errors.push({
      field: 'category',
      message: VALIDATION_ERRORS.INVALID_CATEGORY,
      value: data.category,
    });
  }

  if (!data.unitOfMeasure || data.unitOfMeasure.trim().length === 0) {
    errors.push({
      field: 'unitOfMeasure',
      message: VALIDATION_ERRORS.REQUIRED_FIELD,
      value: data.unitOfMeasure,
    });
  }

  if (!data.trackingMode) {
    errors.push({
      field: 'trackingMode',
      message: VALIDATION_ERRORS.REQUIRED_FIELD,
      value: data.trackingMode,
    });
  } else if (
    data.trackingMode !== 'simple' &&
    data.trackingMode !== 'batched'
  ) {
    errors.push({
      field: 'trackingMode',
      message: VALIDATION_ERRORS.INVALID_TRACKING_MODE,
      value: data.trackingMode,
    });
  }

  if (data.isConsumable === undefined || data.isConsumable === null) {
    errors.push({
      field: 'isConsumable',
      message: VALIDATION_ERRORS.REQUIRED_FIELD,
      value: data.isConsumable,
    });
  }

  return errors;
}

/**
 * Validate numeric fields
 */
function validateNumericFields(
  data: CreateInventoryItemRequest
): InventoryValidationError[] {
  const errors: InventoryValidationError[] = [];

  if (
    data.minStock === undefined ||
    data.minStock === null ||
    data.minStock < 0
  ) {
    errors.push({
      field: 'minStock',
      message: VALIDATION_ERRORS.INVALID_NUMBER,
      value: data.minStock,
    });
  }

  if (
    data.reorderMultiple === undefined ||
    data.reorderMultiple === null ||
    data.reorderMultiple <= 0
  ) {
    errors.push({
      field: 'reorderMultiple',
      message: VALIDATION_ERRORS.INVALID_REORDER_MULTIPLE,
      value: data.reorderMultiple,
    });
  }

  if (data.leadTimeDays !== undefined && data.leadTimeDays < 0) {
    errors.push({
      field: 'leadTimeDays',
      message: VALIDATION_ERRORS.INVALID_NUMBER,
      value: data.leadTimeDays,
    });
  }

  return errors;
}

/**
 * Validate create inventory item request
 * Requirement 1.2
 */
export function validateCreateRequest(
  data: CreateInventoryItemRequest
): InventoryValidationError[] {
  return [...validateRequiredFields(data), ...validateNumericFields(data)];
}

/**
 * Check for duplicate SKU or barcode
 */
async function checkDuplicates(
  sku?: string,
  barcode?: string,
  excludeId?: string
): Promise<InventoryValidationError[]> {
  const errors: InventoryValidationError[] = [];
  const collection = database.get<InventoryItemModel>('inventory_items');

  if (sku) {
    const clauses = [Q.where('sku', sku), Q.where('deleted_at', null)];
    if (excludeId) {
      clauses.push(Q.where('id', Q.notEq(excludeId)));
    }

    const existing = await collection.query(...clauses).fetch();
    if (existing.length > 0) {
      errors.push({
        field: 'sku',
        message: VALIDATION_ERRORS.DUPLICATE_SKU,
        value: sku,
      });
    }
  }

  if (barcode) {
    const clauses = [Q.where('barcode', barcode), Q.where('deleted_at', null)];
    if (excludeId) {
      clauses.push(Q.where('id', Q.notEq(excludeId)));
    }

    const existing = await collection.query(...clauses).fetch();
    if (existing.length > 0) {
      errors.push({
        field: 'barcode',
        message: VALIDATION_ERRORS.DUPLICATE_BARCODE,
        value: barcode,
      });
    }
  }

  return errors;
}

/**
 * Create a new inventory item
 * Requirements: 1.2, 10.1
 *
 * @param data - Inventory item data
 * @returns Result with created item or validation errors
 */
export async function createInventoryItem(
  data: CreateInventoryItemRequest
): Promise<InventoryOperationResult<InventoryItem>> {
  // Validate request
  const validationErrors = validateCreateRequest(data);
  if (validationErrors.length > 0) {
    return {
      success: false,
      validationErrors,
      error: 'Validation failed',
    };
  }

  try {
    const collection = database.get<InventoryItemModel>('inventory_items');

    const item = await database.write(async () => {
      // Re-check for duplicates inside the transaction
      const duplicateErrors = await checkDuplicates(data.sku, data.barcode);
      if (duplicateErrors.length > 0) {
        throw new Error('DUPLICATE_CHECK_FAILED');
      }

      return collection.create((record) => {
        record.name = data.name.trim();
        record.category = data.category;
        record.unitOfMeasure = data.unitOfMeasure.trim();
        record.trackingMode = data.trackingMode;
        record.isConsumable = data.isConsumable;
        record.minStock = data.minStock;
        record.reorderMultiple = data.reorderMultiple;
        record.leadTimeDays = data.leadTimeDays;
        record.sku = data.sku?.trim();
        record.barcode = data.barcode?.trim();
      });
    });

    return {
      success: true,
      data: modelToInventoryItem(item),
    };
  } catch (error) {
    // Handle database constraint violations
    if (error instanceof Error) {
      if (
        error.message.includes('UNIQUE constraint failed') ||
        error.message.includes('DUPLICATE_CHECK_FAILED')
      ) {
        // Extract which field caused the constraint violation
        let field = 'unknown';
        let message = VALIDATION_ERRORS.DUPLICATE_SKU;

        if (
          error.message.includes('sku') ||
          error.message.includes('DUPLICATE_CHECK_FAILED')
        ) {
          field = 'sku';
          message = VALIDATION_ERRORS.DUPLICATE_SKU;
        } else if (error.message.includes('barcode')) {
          field = 'barcode';
          message = VALIDATION_ERRORS.DUPLICATE_BARCODE;
        }

        return {
          success: false,
          validationErrors: [
            {
              field,
              message,
              value: field === 'sku' ? data.sku : data.barcode,
            },
          ],
          error: 'Duplicate SKU or barcode',
        };
      }
    }

    console.error('[InventoryItemService] Create failed:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to create inventory item',
    };
  }
}

/**
 * Get inventory item by ID
 *
 * @param id - Item ID
 * @returns Item or null if not found
 */
export async function getInventoryItem(
  id: string
): Promise<InventoryItem | null> {
  try {
    const collection = database.get<InventoryItemModel>('inventory_items');
    const item = await collection.find(id);

    if (item.deletedAt) {
      return null;
    }

    return modelToInventoryItem(item);
  } catch (error) {
    console.error('[InventoryItemService] Get failed:', error);
    return null;
  }
}

/**
 * Query inventory items with filters
 * Requirement 1.3
 *
 * @param filters - Query filters
 * @returns Array of inventory items
 */
export async function queryInventoryItems(
  filters?: InventoryFilters
): Promise<InventoryItem[]> {
  try {
    const collection = database.get<InventoryItemModel>('inventory_items');
    const clauses = [];

    // Apply filters
    if (!filters?.includeDeleted) {
      clauses.push(Q.where('deleted_at', null));
    }

    if (filters?.category) {
      clauses.push(Q.where('category', filters.category));
    }

    if (filters?.trackingMode) {
      clauses.push(Q.where('tracking_mode', filters.trackingMode));
    }

    if (filters?.isConsumable !== undefined) {
      clauses.push(Q.where('is_consumable', filters.isConsumable));
    }

    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      clauses.push(
        Q.or(
          Q.where('name', Q.like(`%${Q.sanitizeLikeString(searchLower)}%`)),
          Q.where('sku', Q.like(`%${Q.sanitizeLikeString(searchLower)}%`))
        )
      );
    }

    const items = await collection.query(...clauses).fetch();

    return items.map(modelToInventoryItem);
  } catch (error) {
    console.error('[InventoryItemService] Query failed:', error);
    return [];
  }
}

/**
 * Validate update request fields
 */
function validateUpdateFields(
  updates: UpdateInventoryItemRequest
): InventoryValidationError[] {
  const validationErrors: InventoryValidationError[] = [];

  if (updates.name !== undefined && updates.name.trim().length === 0) {
    validationErrors.push({
      field: 'name',
      message: VALIDATION_ERRORS.REQUIRED_FIELD,
      value: updates.name,
    });
  }

  if (updates.category && !isValidCategory(updates.category)) {
    validationErrors.push({
      field: 'category',
      message: VALIDATION_ERRORS.INVALID_CATEGORY,
      value: updates.category,
    });
  }

  if (
    updates.trackingMode &&
    updates.trackingMode !== 'simple' &&
    updates.trackingMode !== 'batched'
  ) {
    validationErrors.push({
      field: 'trackingMode',
      message: VALIDATION_ERRORS.INVALID_TRACKING_MODE,
      value: updates.trackingMode,
    });
  }

  if (updates.minStock !== undefined && updates.minStock < 0) {
    validationErrors.push({
      field: 'minStock',
      message: VALIDATION_ERRORS.INVALID_NUMBER,
      value: updates.minStock,
    });
  }

  if (updates.reorderMultiple !== undefined && updates.reorderMultiple <= 0) {
    validationErrors.push({
      field: 'reorderMultiple',
      message: VALIDATION_ERRORS.INVALID_REORDER_MULTIPLE,
      value: updates.reorderMultiple,
    });
  }

  if (updates.leadTimeDays !== undefined && updates.leadTimeDays < 0) {
    validationErrors.push({
      field: 'leadTimeDays',
      message: VALIDATION_ERRORS.INVALID_NUMBER,
      value: updates.leadTimeDays,
    });
  }

  return validationErrors;
}

/**
 * Apply updates to inventory item record
 */
function applyItemUpdates(
  record: InventoryItemModel,
  updates: UpdateInventoryItemRequest
): void {
  if (updates.name !== undefined) {
    record.name = updates.name.trim();
  }
  if (updates.category !== undefined) {
    record.category = updates.category;
  }
  if (updates.unitOfMeasure !== undefined) {
    record.unitOfMeasure = updates.unitOfMeasure.trim();
  }
  if (updates.trackingMode !== undefined) {
    record.trackingMode = updates.trackingMode;
  }
  if (updates.isConsumable !== undefined) {
    record.isConsumable = updates.isConsumable;
  }
  if (updates.minStock !== undefined) {
    record.minStock = updates.minStock;
  }
  if (updates.reorderMultiple !== undefined) {
    record.reorderMultiple = updates.reorderMultiple;
  }
  if (updates.leadTimeDays !== undefined) {
    record.leadTimeDays = updates.leadTimeDays;
  }
  if (updates.sku !== undefined) {
    record.sku = updates.sku?.trim();
  }
  if (updates.barcode !== undefined) {
    record.barcode = updates.barcode?.trim();
  }
}

/**
 * Update inventory item
 * Requirement 1.2
 *
 * @param id - Item ID
 * @param updates - Fields to update
 * @returns Result with updated item or errors
 */
// eslint-disable-next-line max-lines-per-function -- Complex CRUD with validation, pre-existing from Task 3
export async function updateInventoryItem(
  id: string,
  updates: UpdateInventoryItemRequest
): Promise<InventoryOperationResult<InventoryItem>> {
  try {
    const collection = database.get<InventoryItemModel>('inventory_items');

    const updatedItem = await database.write(async () => {
      const item = await collection.find(id);

      if (item.deletedAt) {
        throw new Error('ITEM_NOT_FOUND');
      }

      // Validate updates
      const validationErrors = validateUpdateFields(updates);
      if (validationErrors.length > 0) {
        throw new Error('VALIDATION_FAILED');
      }

      // Re-check for duplicate SKU/barcode inside the transaction (excluding current item)
      const duplicateErrors = await checkDuplicates(
        updates.sku,
        updates.barcode,
        id
      );
      if (duplicateErrors.length > 0) {
        throw new Error('DUPLICATE_CHECK_FAILED');
      }

      // Perform update
      return item.update((record) => {
        applyItemUpdates(record, updates);
      });
    });

    return {
      success: true,
      data: modelToInventoryItem(updatedItem),
    };
  } catch (error) {
    // Handle specific errors
    if (error instanceof Error) {
      if (error.message === 'ITEM_NOT_FOUND') {
        return {
          success: false,
          error: VALIDATION_ERRORS.ITEM_NOT_FOUND,
        };
      }

      if (error.message === 'VALIDATION_FAILED') {
        return {
          success: false,
          validationErrors: validateUpdateFields(updates),
          error: 'Validation failed',
        };
      }

      if (
        error.message.includes('UNIQUE constraint failed') ||
        error.message.includes('DUPLICATE_CHECK_FAILED')
      ) {
        // Extract which field caused the constraint violation
        let field = 'unknown';
        let message = VALIDATION_ERRORS.DUPLICATE_SKU;

        if (
          error.message.includes('sku') ||
          error.message.includes('DUPLICATE_CHECK_FAILED')
        ) {
          field = 'sku';
          message = VALIDATION_ERRORS.DUPLICATE_SKU;
        } else if (error.message.includes('barcode')) {
          field = 'barcode';
          message = VALIDATION_ERRORS.DUPLICATE_BARCODE;
        }

        return {
          success: false,
          validationErrors: [
            {
              field,
              message,
              value: field === 'sku' ? updates.sku : updates.barcode,
            },
          ],
          error: 'Duplicate SKU or barcode',
        };
      }
    }

    console.error('[InventoryItemService] Update failed:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to update inventory item',
    };
  }
}

/**
 * Delete inventory item (soft delete)
 *
 * @param id - Item ID
 * @returns Result indicating success or failure
 */
export async function deleteInventoryItem(
  id: string
): Promise<InventoryOperationResult<void>> {
  try {
    const collection = database.get<InventoryItemModel>('inventory_items');
    const item = await collection.find(id);

    if (item.deletedAt) {
      return {
        success: false,
        error: VALIDATION_ERRORS.ITEM_NOT_FOUND,
      };
    }

    await database.write(async () => {
      await item.update((record) => {
        record.deletedAt = new Date();
      });
    });

    return {
      success: true,
    };
  } catch (error) {
    console.error('[InventoryItemService] Delete failed:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to delete inventory item',
    };
  }
}

/**
 * Get inventory items count by category
 *
 * @returns Category counts
 */
export async function getInventoryItemCountsByCategory(): Promise<
  Record<string, number>
> {
  try {
    const items = await queryInventoryItems({ includeDeleted: false });
    const counts: Record<string, number> = {};

    for (const item of items) {
      counts[item.category] = (counts[item.category] ?? 0) + 1;
    }

    return counts;
  } catch (error) {
    console.error('[InventoryItemService] Get counts failed:', error);
    return {};
  }
}
