/**
 * CSV Export Service
 *
 * RFC 4180 compliant CSV export for inventory items, batches, and movements.
 *
 * Requirements:
 * - 5.1: Generate RFC 4180 compliant UTF-8 files with header rows
 * - 5.1: Use ISO-8601 dates and dot decimals
 * - 5.1: Generate items.csv, batches.csv, and movements.csv
 */

import { unparse } from 'papaparse';

import { database } from '@/lib/watermelon';
import type { InventoryBatchModel } from '@/lib/watermelon-models/inventory-batch';
import type { InventoryItemModel } from '@/lib/watermelon-models/inventory-item';
import type { InventoryMovementModel } from '@/lib/watermelon-models/inventory-movement';

import type {
  CSVExportOptions,
  CSVExportResult,
  CSVFileExport,
} from './types/csv';
import { CSV_FORMAT } from './types/csv';

/**
 * Format date to ISO-8601 (YYYY-MM-DD)
 */
function formatDate(date: Date | null | undefined): string {
  if (!date) return '';
  return date.toISOString().split('T')[0];
}

/**
 * Format number with dot decimals (RFC 4180)
 */
function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return value.toString();
}

/**
 * Export inventory items to CSV
 */
async function exportItems(
  options: CSVExportOptions = {}
): Promise<CSVFileExport> {
  const db = database;
  const itemsCollection = db.get<InventoryItemModel>('inventory_items');

  // Build query
  let query = itemsCollection.query();

  if (!options.includeDeleted) {
    // WatermelonDB automatically filters out soft-deleted records
  }

  if (options.categories && options.categories.length > 0) {
    query = itemsCollection.query(
      // @ts-expect-error - WatermelonDB typing limitations with Q.where
      (q) => q.where('category', q.oneOf(options.categories))
    );
  }

  const items = await query.fetch();

  // Transform to CSV rows
  const rows = items.map((item: InventoryItemModel) => ({
    external_key: item.sku || item.id,
    name: item.name,
    category: item.category,
    unit: item.unitOfMeasure,
    tracking_mode: item.trackingMode,
    min_stock: formatNumber(item.minStock),
    reorder_multiple: formatNumber(item.reorderMultiple),
    lead_time_days: formatNumber(item.leadTimeDays),
    sku: item.sku || '',
    is_consumable: item.isConsumable ? 'true' : 'false',
  }));

  // Generate RFC 4180 compliant CSV
  const content = unparse(rows, {
    delimiter: CSV_FORMAT.DELIMITER,
    newline: CSV_FORMAT.LINE_ENDING,
    quotes: true, // Always quote fields for RFC 4180 compliance
    header: true,
  });

  const sizeBytes = new TextEncoder().encode(content).length;

  return {
    filename: 'items.csv',
    content,
    rowCount: rows.length,
    sizeBytes,
  };
}

/**
 * Export inventory batches to CSV
 */
async function exportBatches(
  options: CSVExportOptions = {}
): Promise<CSVFileExport> {
  const db = database;
  const batchesCollection = db.get<InventoryBatchModel>('inventory_batches');
  const itemsCollection = db.get<InventoryItemModel>('inventory_items');

  // Build query
  let query = batchesCollection.query();

  if (!options.includeDeleted) {
    // WatermelonDB automatically filters out soft-deleted records
  }

  const batches = await query.fetch();

  // Build external key map for items
  const itemMap = new Map<string, string>();
  const items = await itemsCollection.query().fetch();
  for (const item of items) {
    itemMap.set(item.id, item.sku || item.id);
  }

  // Transform to CSV rows
  const rows = batches.map((batch: InventoryBatchModel) => ({
    external_key: batch.id,
    item_external_key: itemMap.get(batch.itemId) || batch.itemId,
    lot: batch.lotNumber,
    expires_on: formatDate(batch.expiresOn),
    qty: formatNumber(batch.quantity),
    cost_per_unit_minor: formatNumber(batch.costPerUnitMinor),
    received_at: formatDate(batch.receivedAt),
  }));

  // Generate RFC 4180 compliant CSV
  const content = unparse(rows, {
    delimiter: CSV_FORMAT.DELIMITER,
    newline: CSV_FORMAT.LINE_ENDING,
    quotes: true,
    header: true,
  });

  const sizeBytes = new TextEncoder().encode(content).length;

  return {
    filename: 'batches.csv',
    content,
    rowCount: rows.length,
    sizeBytes,
  };
}

/**
 * Export inventory movements to CSV
 */
async function exportMovements(
  options: CSVExportOptions = {}
): Promise<CSVFileExport> {
  const db = database;
  const movementsCollection = db.get<InventoryMovementModel>(
    'inventory_movements'
  );
  const itemsCollection = db.get<InventoryItemModel>('inventory_items');
  const batchesCollection = db.get<InventoryBatchModel>('inventory_batches');

  // Build query with date range filter
  let query = movementsCollection.query();

  if (options.dateRange) {
    const { from, to } = options.dateRange;
    query = movementsCollection.query(
      // @ts-expect-error - WatermelonDB typing limitations with Q.where
      (q) => q.where('created_at', q.gte(from.getTime())),
      // @ts-expect-error - WatermelonDB typing limitations with Q.where
      (q) => q.where('created_at', q.lte(to.getTime()))
    );
  }

  const movements = await query.fetch();

  // Build external key maps
  const itemMap = new Map<string, string>();
  const items = await itemsCollection.query().fetch();
  for (const item of items) {
    itemMap.set(item.id, item.sku || item.id);
  }

  const batchMap = new Map<string, string>();
  const batches = await batchesCollection.query().fetch();
  for (const batch of batches) {
    batchMap.set(batch.id, batch.lotNumber);
  }

  // Transform to CSV rows
  const rows = movements.map((movement: InventoryMovementModel) => ({
    external_key: movement.id,
    item_external_key: itemMap.get(movement.itemId) || movement.itemId,
    batch_lot: movement.batchId ? batchMap.get(movement.batchId) || '' : '',
    type: movement.type,
    qty_delta: formatNumber(movement.quantityDelta),
    reason: movement.reason || '',
    task_external_id: movement.taskId || '',
    created_at: formatDate(movement.createdAt),
  }));

  // Generate RFC 4180 compliant CSV
  const content = unparse(rows, {
    delimiter: CSV_FORMAT.DELIMITER,
    newline: CSV_FORMAT.LINE_ENDING,
    quotes: true,
    header: true,
  });

  const sizeBytes = new TextEncoder().encode(content).length;

  return {
    filename: 'movements.csv',
    content,
    rowCount: rows.length,
    sizeBytes,
  };
}

/**
 * Export all inventory data to CSV
 * Requirement 5.1
 */
export async function exportToCSV(
  options: CSVExportOptions = {}
): Promise<CSVExportResult> {
  const timestamp = new Date();

  // Export all three files
  const [items, batches, movements] = await Promise.all([
    exportItems(options),
    exportBatches(options),
    exportMovements(options),
  ]);

  return {
    items,
    batches,
    movements,
    totalRows: items.rowCount + batches.rowCount + movements.rowCount,
    totalBytes: items.sizeBytes + batches.sizeBytes + movements.sizeBytes,
    timestamp,
  };
}

/**
 * Export single file type
 */
export async function exportSingleFile(
  fileType: 'items' | 'batches' | 'movements',
  options: CSVExportOptions = {}
): Promise<CSVFileExport> {
  switch (fileType) {
    case 'items':
      return exportItems(options);
    case 'batches':
      return exportBatches(options);
    case 'movements':
      return exportMovements(options);
    default:
      throw new Error(`Unknown file type: ${fileType}`);
  }
}
