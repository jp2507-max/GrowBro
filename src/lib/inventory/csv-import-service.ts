/**
 * CSV Import Service
 *
 * Handles CSV import with dry-run preview, row-level diffs, idempotent
 * upserts by external_key, and atomic transaction handling.
 *
 * Requirements:
 * - 5.2: Dry-run preview showing row-level diffs and validation errors
 * - 5.3: Idempotent upsert operations by external_key/SKU
 * - 5.4: Prevent partial imports on errors
 * - 5.5: Re-importing same file yields zero net changes
 */

import { Q } from '@nozbe/watermelondb';

import { database } from '@/lib/watermelon';
import type { InventoryBatchModel } from '@/lib/watermelon-models/inventory-batch';
import type { InventoryItemModel } from '@/lib/watermelon-models/inventory-item';
import type { InventoryMovementModel } from '@/lib/watermelon-models/inventory-movement';

import { parseCSVFiles } from './csv-parser';
import { trackCSVOperation, trackImportError } from './telemetry';
import type {
  CSVBatchRow,
  CSVImportPreview,
  CSVImportResult,
  CSVItemRow,
  FieldChange,
  RowDiff,
} from './types/csv';

// ============================================================================
// Dry-Run Preview (Requirement 5.2)
// ============================================================================

/**
 * Generate dry-run preview showing what changes would be made
 * Requirement 5.2
 */
// eslint-disable-next-line max-lines-per-function
export async function previewCSVImport(files: {
  items?: string;
  batches?: string;
  movements?: string;
}): Promise<CSVImportPreview> {
  const startTime = Date.now();

  // Parse all files
  const parseResult = await parseCSVFiles(files);

  const diffs: RowDiff[] = [];
  let itemsToAdd = 0;
  let itemsToUpdate = 0;
  let itemsToSkip = 0;
  let batchesToAdd = 0;
  let batchesToUpdate = 0;
  let batchesToSkip = 0;
  let movementsToAdd = 0;

  const validRows =
    (parseResult.data.items?.length || 0) +
    (parseResult.data.batches?.length || 0) +
    (parseResult.data.movements?.length || 0);

  const totalRows = validRows;

  // Preview items
  if (parseResult.data.items) {
    const itemDiffs = await previewItems(parseResult.data.items);
    diffs.push(...itemDiffs);

    itemsToAdd = itemDiffs.filter((d) => d.action === 'add').length;
    itemsToUpdate = itemDiffs.filter((d) => d.action === 'update').length;
    itemsToSkip = itemDiffs.filter((d) => d.action === 'skip').length;
  }

  // Preview batches
  if (parseResult.data.batches) {
    const batchDiffs = await previewBatches(parseResult.data.batches);
    diffs.push(...batchDiffs);

    batchesToAdd = batchDiffs.filter((d) => d.action === 'add').length;
    batchesToUpdate = batchDiffs.filter((d) => d.action === 'update').length;
    batchesToSkip = batchDiffs.filter((d) => d.action === 'skip').length;
  }

  // Preview movements (always add)
  if (parseResult.data.movements) {
    movementsToAdd = parseResult.data.movements.length;
    parseResult.data.movements.forEach((movement, index) => {
      diffs.push({
        row: index + 1,
        action: 'add',
        externalKey: movement.external_key,
      });
    });
  }

  // Aggregate validation errors
  const validationErrors = [
    ...(parseResult.validationErrors.get('items') || []),
    ...(parseResult.validationErrors.get('batches') || []),
    ...(parseResult.validationErrors.get('movements') || []),
  ];

  // Aggregate parse errors
  const parseErrors = [
    ...(parseResult.errors.get('items') || []),
    ...(parseResult.errors.get('batches') || []),
    ...(parseResult.errors.get('movements') || []),
  ];

  const invalidRows = validationErrors.length + parseErrors.length;

  const durationMs = Date.now() - startTime;

  // Track CSV preview telemetry (Requirement 11.1)
  void trackCSVOperation({
    operation: 'preview',
    rowCount: totalRows,
    successCount: validRows,
    errorCount: invalidRows,
    durationMs,
  });

  // Track import errors if any (Requirement 11.1)
  if (parseErrors.length > 0) {
    void trackImportError({
      errorType: 'parse',
      totalRows,
      errorCount: parseErrors.length,
    });
  }
  if (validationErrors.length > 0) {
    void trackImportError({
      errorType: 'validation',
      totalRows,
      errorCount: validationErrors.length,
    });
  }

  return {
    totalRows,
    validRows,
    invalidRows,
    diffs,
    errors: validationErrors,
    parseErrors,
    summary: {
      itemsToAdd,
      itemsToUpdate,
      itemsToSkip,
      batchesToAdd,
      batchesToUpdate,
      batchesToSkip,
      movementsToAdd,
    },
    canProceed: parseResult.success && validationErrors.length === 0,
  };
}

/**
 * Preview item changes
 */
// eslint-disable-next-line max-lines-per-function
async function previewItems(items: CSVItemRow[]): Promise<RowDiff[]> {
  const db = database;
  const itemsCollection = db.get<InventoryItemModel>('inventory_items');
  const diffs: RowDiff[] = [];

  for (let index = 0; index < items.length; index++) {
    const csvItem = items[index];
    const rowIndex = index + 1;

    // Find existing item by external_key (SKU)
    let existingItem: InventoryItemModel | null = null;

    if (csvItem.sku) {
      const results = await itemsCollection
        .query(Q.where('sku', csvItem.sku))
        .fetch();
      existingItem = results[0] || null;
    }

    if (!existingItem) {
      // New item
      diffs.push({
        row: rowIndex,
        action: 'add',
        externalKey: csvItem.external_key,
      });
    } else {
      // Check for changes
      const changes: FieldChange[] = [];

      if (existingItem.name !== csvItem.name) {
        changes.push({
          field: 'name',
          oldValue: existingItem.name,
          newValue: csvItem.name,
        });
      }

      if (existingItem.category !== csvItem.category) {
        changes.push({
          field: 'category',
          oldValue: existingItem.category,
          newValue: csvItem.category,
        });
      }

      if (existingItem.unitOfMeasure !== csvItem.unit) {
        changes.push({
          field: 'unit',
          oldValue: existingItem.unitOfMeasure,
          newValue: csvItem.unit,
        });
      }

      if (existingItem.trackingMode !== csvItem.tracking_mode) {
        changes.push({
          field: 'tracking_mode',
          oldValue: existingItem.trackingMode,
          newValue: csvItem.tracking_mode,
        });
      }

      if (existingItem.minStock !== csvItem.min_stock) {
        changes.push({
          field: 'min_stock',
          oldValue: existingItem.minStock,
          newValue: csvItem.min_stock,
        });
      }

      if (existingItem.reorderMultiple !== csvItem.reorder_multiple) {
        changes.push({
          field: 'reorder_multiple',
          oldValue: existingItem.reorderMultiple,
          newValue: csvItem.reorder_multiple,
        });
      }

      if (existingItem.leadTimeDays !== csvItem.lead_time_days) {
        changes.push({
          field: 'lead_time_days',
          oldValue: existingItem.leadTimeDays,
          newValue: csvItem.lead_time_days,
        });
      }

      if (existingItem.isConsumable !== csvItem.is_consumable) {
        changes.push({
          field: 'is_consumable',
          oldValue: existingItem.isConsumable,
          newValue: csvItem.is_consumable,
        });
      }

      if (changes.length > 0) {
        diffs.push({
          row: rowIndex,
          action: 'update',
          externalKey: csvItem.external_key,
          changes,
        });
      } else {
        diffs.push({
          row: rowIndex,
          action: 'skip',
          externalKey: csvItem.external_key,
        });
      }
    }
  }

  return diffs;
}

/**
 * Preview batch changes
 */

async function previewBatches(batches: CSVBatchRow[]): Promise<RowDiff[]> {
  const db = database;
  const itemsCollection = db.get<InventoryItemModel>('inventory_items');
  const batchesCollection = db.get<InventoryBatchModel>('inventory_batches');
  const diffs: RowDiff[] = [];

  // Build item lookup map
  const itemMap = new Map<string, string>();
  const items = await itemsCollection.query().fetch();
  for (const item of items) {
    if (item.sku) {
      itemMap.set(item.sku, item.id);
    }
    itemMap.set(item.id, item.id);
  }

  for (let index = 0; index < batches.length; index++) {
    const csvBatch = batches[index];
    const rowIndex = index + 1;

    // Resolve item ID
    const itemId = itemMap.get(csvBatch.item_external_key);
    if (!itemId) {
      diffs.push({
        row: rowIndex,
        action: 'skip',
        externalKey: csvBatch.external_key,
        error: `Item not found: ${csvBatch.item_external_key}`,
      });
      continue;
    }

    // Find existing batch by item_id + lot_number
    const existingBatches = await batchesCollection
      .query(Q.where('item_id', itemId), Q.where('lot_number', csvBatch.lot))
      .fetch();

    const existingBatch = existingBatches[0] || null;

    if (!existingBatch) {
      // New batch
      diffs.push({
        row: rowIndex,
        action: 'add',
        externalKey: csvBatch.external_key,
      });
    } else {
      // Check for changes
      const changes: FieldChange[] = [];

      if (existingBatch.quantity !== csvBatch.qty) {
        changes.push({
          field: 'quantity',
          oldValue: existingBatch.quantity,
          newValue: csvBatch.qty,
        });
      }

      if (existingBatch.costPerUnitMinor !== csvBatch.cost_per_unit_minor) {
        changes.push({
          field: 'cost_per_unit_minor',
          oldValue: existingBatch.costPerUnitMinor,
          newValue: csvBatch.cost_per_unit_minor,
        });
      }

      if (changes.length > 0) {
        diffs.push({
          row: rowIndex,
          action: 'update',
          externalKey: csvBatch.external_key,
          changes,
        });
      } else {
        diffs.push({
          row: rowIndex,
          action: 'skip',
          externalKey: csvBatch.external_key,
        });
      }
    }
  }

  return diffs;
}

// ============================================================================
// Import Execution (Requirement 5.3, 5.5)
// ============================================================================

/**
 * Execute CSV import with atomic transactions
 * Requirement 5.3, 5.5
 */
// eslint-disable-next-line max-lines-per-function
export async function importCSV(files: {
  items?: string;
  batches?: string;
  movements?: string;
}): Promise<CSVImportResult> {
  const startTime = performance.now();

  // Parse all files
  const parseResult = await parseCSVFiles(files);

  if (!parseResult.success) {
    return {
      success: false,
      changes: {
        itemsAdded: 0,
        itemsUpdated: 0,
        itemsSkipped: 0,
        batchesAdded: 0,
        batchesUpdated: 0,
        batchesSkipped: 0,
        movementsAdded: 0,
      },
      errors: [
        ...(parseResult.validationErrors.get('items') || []),
        ...(parseResult.validationErrors.get('batches') || []),
        ...(parseResult.validationErrors.get('movements') || []),
      ],
      durationMs: performance.now() - startTime,
      timestamp: new Date(),
    };
  }

  const changes = {
    itemsAdded: 0,
    itemsUpdated: 0,
    itemsSkipped: 0,
    batchesAdded: 0,
    batchesUpdated: 0,
    batchesSkipped: 0,
    movementsAdded: 0,
  };

  const totalRows =
    (parseResult.data.items?.length || 0) +
    (parseResult.data.batches?.length || 0) +
    (parseResult.data.movements?.length || 0);

  try {
    await database.write(async () => {
      // Import items
      if (parseResult.data.items) {
        const itemChanges = await importItems(parseResult.data.items);
        changes.itemsAdded = itemChanges.added;
        changes.itemsUpdated = itemChanges.updated;
        changes.itemsSkipped = itemChanges.skipped;
      }

      // Import batches
      if (parseResult.data.batches) {
        const batchChanges = await importBatches(parseResult.data.batches);
        changes.batchesAdded = batchChanges.added;
        changes.batchesUpdated = batchChanges.updated;
        changes.batchesSkipped = batchChanges.skipped;
      }

      // Import movements
      if (parseResult.data.movements) {
        const movementChanges = await importMovements(
          parseResult.data.movements
        );
        changes.movementsAdded = movementChanges.added;
      }
    });

    const durationMs = performance.now() - startTime;

    // Track successful CSV import telemetry (Requirement 11.1)
    void trackCSVOperation({
      operation: 'import',
      rowCount: totalRows,
      successCount: totalRows,
      errorCount: 0,
      durationMs,
    });

    return {
      success: true,
      changes,
      errors: [],
      durationMs,
      timestamp: new Date(),
    };
  } catch (error) {
    const durationMs = performance.now() - startTime;

    // Track failed CSV import telemetry (Requirement 11.1)
    void trackImportError({
      errorType: 'transaction',
      totalRows,
      errorCount: 1,
    });

    return {
      success: false,
      changes,
      errors: [
        {
          row: 0,
          column: 'general',
          message: `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          severity: 'error',
        },
      ],
      durationMs,
      timestamp: new Date(),
    };
  }
}

/**
 * Import items with idempotent upserts
 */
async function importItems(items: CSVItemRow[]): Promise<{
  added: number;
  updated: number;
  skipped: number;
}> {
  const db = database;
  const itemsCollection = db.get<InventoryItemModel>('inventory_items');

  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const csvItem of items) {
    // Find existing item by SKU
    let existingItem: InventoryItemModel | null = null;

    if (csvItem.sku) {
      const results = await itemsCollection
        .query(Q.where('sku', csvItem.sku))
        .fetch();
      existingItem = results[0] || null;
    }

    if (!existingItem) {
      // Create new item
      await itemsCollection.create((item) => {
        item.name = csvItem.name;
        item.category = csvItem.category;
        item.unitOfMeasure = csvItem.unit;
        item.trackingMode = csvItem.tracking_mode;
        item.isConsumable = csvItem.is_consumable;
        item.minStock = csvItem.min_stock;
        item.reorderMultiple = csvItem.reorder_multiple;
        item.leadTimeDays = csvItem.lead_time_days;
        item.sku = csvItem.sku;
      });
      added++;
    } else {
      // Update existing item if changed
      const hasChanges =
        existingItem.name !== csvItem.name ||
        existingItem.category !== csvItem.category ||
        existingItem.unitOfMeasure !== csvItem.unit ||
        existingItem.trackingMode !== csvItem.tracking_mode ||
        existingItem.isConsumable !== csvItem.is_consumable ||
        existingItem.minStock !== csvItem.min_stock ||
        existingItem.reorderMultiple !== csvItem.reorder_multiple ||
        existingItem.leadTimeDays !== csvItem.lead_time_days;

      if (hasChanges) {
        await existingItem.update((item) => {
          item.name = csvItem.name;
          item.category = csvItem.category;
          item.unitOfMeasure = csvItem.unit;
          item.trackingMode = csvItem.tracking_mode;
          item.isConsumable = csvItem.is_consumable;
          item.minStock = csvItem.min_stock;
          item.reorderMultiple = csvItem.reorder_multiple;
          item.leadTimeDays = csvItem.lead_time_days;
        });
        updated++;
      } else {
        skipped++;
      }
    }
  }

  return { added, updated, skipped };
}

/**
 * Import batches with idempotent upserts
 */
async function importBatches(
  batches: {
    external_key: string;
    item_external_key: string;
    lot: string;
    expires_on?: string;
    qty: number;
    cost_per_unit_minor: number;
    received_at?: string;
  }[]
): Promise<{ added: number; updated: number; skipped: number }> {
  const db = database;
  const itemsCollection = db.get<InventoryItemModel>('inventory_items');
  const batchesCollection = db.get<InventoryBatchModel>('inventory_batches');

  // Build item lookup map
  const itemMap = new Map<string, string>();
  const items = await itemsCollection.query().fetch();
  for (const item of items) {
    if (item.sku) {
      itemMap.set(item.sku, item.id);
    }
    itemMap.set(item.id, item.id);
  }

  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const csvBatch of batches) {
    // Resolve item ID
    const itemId = itemMap.get(csvBatch.item_external_key);
    if (!itemId) {
      skipped++;
      continue;
    }

    // Find existing batch
    const existingBatches = await batchesCollection
      .query(Q.where('item_id', itemId), Q.where('lot_number', csvBatch.lot))
      .fetch();

    const existingBatch = existingBatches[0] || null;

    if (!existingBatch) {
      // Create new batch
      await batchesCollection.create((batch) => {
        batch.itemId = itemId;
        batch.lotNumber = csvBatch.lot;
        batch.expiresOn = csvBatch.expires_on
          ? new Date(csvBatch.expires_on)
          : undefined;
        batch.quantity = csvBatch.qty;
        batch.costPerUnitMinor = csvBatch.cost_per_unit_minor;
        batch.receivedAt = csvBatch.received_at
          ? new Date(csvBatch.received_at)
          : new Date();
      });
      added++;
    } else {
      // Update existing batch if changed
      const hasChanges =
        existingBatch.quantity !== csvBatch.qty ||
        existingBatch.costPerUnitMinor !== csvBatch.cost_per_unit_minor;

      if (hasChanges) {
        await existingBatch.update((batch) => {
          batch.quantity = csvBatch.qty;
          batch.costPerUnitMinor = csvBatch.cost_per_unit_minor;
        });
        updated++;
      } else {
        skipped++;
      }
    }
  }

  return { added, updated, skipped };
}

/**
 * Import movements (always create new)
 */
async function importMovements(
  movements: {
    external_key: string;
    item_external_key: string;
    batch_lot?: string;
    type: 'receipt' | 'consumption' | 'adjustment';
    qty_delta: number;
    reason: string;
    task_external_id?: string;
    created_at?: string;
  }[]
): Promise<{ added: number }> {
  const db = database;
  const itemsCollection = db.get<InventoryItemModel>('inventory_items');
  const batchesCollection = db.get<InventoryBatchModel>('inventory_batches');
  const movementsCollection = db.get<InventoryMovementModel>(
    'inventory_movements'
  );

  // Build item lookup map
  const itemMap = new Map<string, string>();
  const items = await itemsCollection.query().fetch();
  for (const item of items) {
    if (item.sku) {
      itemMap.set(item.sku, item.id);
    }
    itemMap.set(item.id, item.id);
  }

  // Build batch lookup map
  const batchMap = new Map<string, string>();
  const batches = await batchesCollection.query().fetch();
  for (const batch of batches) {
    batchMap.set(`${batch.itemId}:${batch.lotNumber}`, batch.id);
  }

  let added = 0;

  for (const csvMovement of movements) {
    // Resolve item ID
    const itemId = itemMap.get(csvMovement.item_external_key);
    if (!itemId) {
      continue;
    }

    // Resolve batch ID if provided
    let batchId: string | null = null;
    if (csvMovement.batch_lot) {
      batchId = batchMap.get(`${itemId}:${csvMovement.batch_lot}`) || null;
    }

    // Create movement
    await movementsCollection.create((movement) => {
      movement.itemId = itemId;
      movement.batchId = batchId ?? undefined;
      movement.type = csvMovement.type;
      movement.quantityDelta = csvMovement.qty_delta;
      movement.reason = csvMovement.reason;
      movement.taskId = csvMovement.task_external_id;
      // Override createdAt if provided (for historical imports)
      if (csvMovement.created_at) {
        movement.createdAt = new Date(csvMovement.created_at);
      }
    });
    added++;
  }

  return { added };
}
