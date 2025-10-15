/**
 * Deduction Map Validation Utilities
 *
 * Validates deduction map entries before attempting consumption.
 * Ensures unit compatibility, positive quantities, and item existence.
 *
 * Requirements:
 * - 3.1: Validate deduction maps from task templates
 * - 3.6: Provide clear error messaging
 */

import type { Database } from '@nozbe/watermelondb';

import type { InventoryItemModel } from '@/lib/watermelon-models/inventory-item';
import type {
  DeductionMapEntry,
  DeductionValidationError,
} from '@/types/inventory-deduction';

/**
 * Validate entire deduction map
 *
 * @param database - WatermelonDB instance
 * @param deductionMap - Map entries to validate
 * @returns Array of validation errors (empty if valid)
 */
export async function validateDeductionMap(
  database: Database,
  deductionMap: DeductionMapEntry[]
): Promise<DeductionValidationError[]> {
  const errors: DeductionValidationError[] = [];

  for (let i = 0; i < deductionMap.length; i++) {
    const entry = deductionMap[i];

    // Validate quantity is positive
    const qtyError = validateQuantityPositive(entry, i);
    if (qtyError) errors.push(qtyError);

    // Validate unit compatibility with item
    const unitError = await validateUnitCompatibility(database, entry, i);
    if (unitError) errors.push(unitError);

    // Validate scaling mode consistency
    const scalingError = validateScalingMode(entry, i);
    if (scalingError) errors.push(scalingError);
  }

  return errors;
}

/**
 * Validate that quantity is positive
 *
 * @param entry - Deduction map entry
 * @param index - Entry index for error reporting
 * @returns Validation error or null if valid
 */
export function validateQuantityPositive(
  entry: DeductionMapEntry,
  index: number
): DeductionValidationError | null {
  const qty = entry.perTaskQuantity ?? entry.perPlantQuantity;

  if (qty === undefined || qty === null) {
    return {
      code: 'INVALID_QUANTITY',
      field: 'perTaskQuantity / perPlantQuantity',
      message: 'At least one quantity field must be specified',
      entryIndex: index,
    };
  }

  if (qty <= 0) {
    return {
      code: 'INVALID_QUANTITY',
      field: 'perTaskQuantity / perPlantQuantity',
      message: `Quantity must be positive (got ${qty})`,
      entryIndex: index,
    };
  }

  return null;
}

/**
 * Validate unit compatibility with inventory item
 *
 * @param database - WatermelonDB instance
 * @param entry - Deduction map entry
 * @param index - Entry index for error reporting
 * @returns Validation error or null if valid
 */
export async function validateUnitCompatibility(
  database: Database,
  entry: DeductionMapEntry,
  index: number
): Promise<DeductionValidationError | null> {
  if (!entry.unit || entry.unit.trim() === '') {
    return {
      code: 'INVALID_UNIT',
      field: 'unit',
      message: 'Unit of measure is required',
      entryIndex: index,
    };
  }

  // Check if item exists (use collection.find for primary key lookups)
  const items = database.get<InventoryItemModel>('inventory_items');
  let item: InventoryItemModel | null = null;
  try {
    item = await items.find(entry.itemId);
  } catch {
    item = null;
  }

  if (!item || (item.deletedAt !== null && item.deletedAt !== undefined)) {
    return {
      code: 'MISSING_ITEM',
      field: 'itemId',
      message: `Inventory item ${entry.itemId} not found`,
      entryIndex: index,
    };
  }

  // Validate unit matches item's unit_of_measure
  const itemUnit = item.unitOfMeasure;
  if (entry.unit !== itemUnit) {
    return {
      code: 'UNIT_MISMATCH',
      field: 'unit',
      message: `Unit mismatch: entry uses '${entry.unit}' but item requires '${itemUnit}'`,
      entryIndex: index,
    };
  }

  return null;
}

/**
 * Validate scaling mode consistency
 *
 * @param entry - Deduction map entry
 * @param index - Entry index for error reporting
 * @returns Validation error or null if valid
 */
export function validateScalingMode(
  entry: DeductionMapEntry,
  index: number
): DeductionValidationError | null {
  const mode = entry.scalingMode ?? 'fixed';

  if (mode === 'per-plant' && !entry.perPlantQuantity) {
    return {
      code: 'INVALID_SCALING',
      field: 'scalingMode',
      message: "Scaling mode 'per-plant' requires perPlantQuantity to be set",
      entryIndex: index,
    };
  }

  if (mode === 'fixed' && !entry.perTaskQuantity) {
    return {
      code: 'INVALID_SCALING',
      field: 'scalingMode',
      message: "Scaling mode 'fixed' requires perTaskQuantity to be set",
      entryIndex: index,
    };
  }

  if (mode === 'ec-based' && !entry.perTaskQuantity) {
    return {
      code: 'INVALID_SCALING',
      field: 'scalingMode',
      message:
        "Scaling mode 'ec-based' requires perTaskQuantity as base amount",
      entryIndex: index,
    };
  }

  return null;
}
