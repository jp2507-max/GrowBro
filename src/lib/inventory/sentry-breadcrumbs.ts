/**
 * Sentry Breadcrumb Utilities for Inventory
 *
 * Conservative breadcrumb helpers for inventory operations to avoid performance overhead.
 *
 * Requirements:
 * - 11.4: Sentry breadcrumbs for inventory operations
 * - 11.1: Performance monitoring with conservative breadcrumb usage
 *
 * Strategy:
 * - Only log actionable events (not per-frame or high-frequency events)
 * - Limit breadcrumb data to essential context
 * - Use category prefixes for filtering (inventory.*, sync.*, deduction.*)
 */

import type { Breadcrumb } from '@sentry/react-native';

import { sanitizeObjectPII } from '@/lib/sentry-utils';

/**
 * Add breadcrumb to Sentry (lazy-loaded to avoid bundle bloat)
 */
async function addBreadcrumb(breadcrumb: Breadcrumb): Promise<void> {
  try {
    const Sentry = await import('@sentry/react-native');
    const SentryClient = Sentry.default ?? Sentry;
    SentryClient.addBreadcrumb(breadcrumb);
  } catch {
    // Silently fail if Sentry is not available
  }
}

/**
 * Log inventory item creation/update/deletion
 */
export function logInventoryItemOperation(options: {
  operation: 'create' | 'update' | 'delete';
  itemId: string;
  itemName: string;
  category: string;
}): void {
  const { operation, itemId, itemName, category } = options;
  void addBreadcrumb({
    category: 'inventory.item',
    message: `${operation} item: ${itemName}`,
    level: 'info',
    data: sanitizeObjectPII({
      operation,
      itemId,
      category,
    }),
  });
}

/**
 * Log batch creation/update/deletion
 */
export function logBatchOperation(options: {
  operation: 'create' | 'update' | 'delete';
  batchId: string;
  itemId: string;
  lotNumber: string;
  quantity: number;
}): void {
  const { operation, batchId, itemId, lotNumber, quantity } = options;
  void addBreadcrumb({
    category: 'inventory.batch',
    message: `${operation} batch: ${lotNumber}`,
    level: 'info',
    data: sanitizeObjectPII({
      operation,
      batchId,
      itemId,
      lotNumber,
      quantity,
    }),
  });
}

/**
 * Log inventory movement creation
 */
export function logInventoryMovement(options: {
  type: 'receipt' | 'consumption' | 'adjustment';
  itemId: string;
  quantityDelta: number;
  taskId?: string;
}): void {
  const { type, itemId, quantityDelta, taskId } = options;
  void addBreadcrumb({
    category: 'inventory.movement',
    message: `Movement: ${type} (${quantityDelta > 0 ? '+' : ''}${quantityDelta})`,
    level: 'info',
    data: sanitizeObjectPII({
      type,
      itemId,
      quantityDelta,
      taskId,
    }),
  });
}

/**
 * Log inventory deduction attempt
 */
export function logDeductionAttempt(options: {
  itemId: string;
  itemName: string;
  requestedQuantity: number;
  availableQuantity: number;
  taskId?: string;
}): void {
  const { itemId, itemName, requestedQuantity, availableQuantity, taskId } =
    options;
  void addBreadcrumb({
    category: 'inventory.deduction',
    message: `Deduction attempt: ${itemName} (${requestedQuantity})`,
    level: requestedQuantity > availableQuantity ? 'warning' : 'info',
    data: sanitizeObjectPII({
      itemId,
      requestedQuantity,
      availableQuantity,
      sufficient: availableQuantity >= requestedQuantity,
      taskId,
    }),
  });
}

/**
 * Log insufficient stock error
 */
export function logInsufficientStock(options: {
  itemId: string;
  itemName: string;
  required: number;
  available: number;
  taskId?: string;
}): void {
  const { itemId, itemName, required, available, taskId } = options;
  void addBreadcrumb({
    category: 'inventory.insufficient_stock',
    message: `Insufficient stock: ${itemName} (need ${required}, have ${available})`,
    level: 'warning',
    data: sanitizeObjectPII({
      itemId,
      required,
      available,
      shortage: required - available,
      taskId,
    }),
  });
}

/**
 * Log recovery option selected
 */
export function logRecoveryAction(
  action: 'partial' | 'skip' | 'adjust' | 'retry',
  context: Record<string, unknown>
): void {
  void addBreadcrumb({
    category: 'inventory.recovery',
    message: `Recovery action: ${action}`,
    level: 'info',
    data: sanitizeObjectPII({
      action,
      ...context,
    }),
  });
}

/**
 * Log sync operation start
 */
export function logSyncStart(
  operation: 'pull' | 'push',
  table: 'inventory_items' | 'inventory_batches' | 'inventory_movements'
): void {
  void addBreadcrumb({
    category: 'sync.inventory',
    message: `Sync ${operation} started: ${table}`,
    level: 'info',
    data: { operation, table },
  });
}

/**
 * Log sync operation complete
 */
export function logSyncComplete(options: {
  operation: 'pull' | 'push';
  table: 'inventory_items' | 'inventory_batches' | 'inventory_movements';
  recordCount: number;
  durationMs: number;
}): void {
  const { operation, table, recordCount, durationMs } = options;
  void addBreadcrumb({
    category: 'sync.inventory',
    message: `Sync ${operation} complete: ${table} (${recordCount} records)`,
    level: 'info',
    data: {
      operation,
      table,
      recordCount,
      durationMs,
    },
  });
}

/**
 * Log sync conflict detected
 */
export function logSyncConflict(options: {
  table: 'inventory_items' | 'inventory_batches' | 'inventory_movements';
  recordId: string;
  localUpdatedAt: Date;
  remoteUpdatedAt: Date;
}): void {
  const { table, recordId, localUpdatedAt, remoteUpdatedAt } = options;
  void addBreadcrumb({
    category: 'sync.conflict',
    message: `Conflict detected: ${table}`,
    level: 'warning',
    data: sanitizeObjectPII({
      table,
      recordId,
      localUpdatedAt: localUpdatedAt.toISOString(),
      remoteUpdatedAt: remoteUpdatedAt.toISOString(),
      resolution: 'LAST_WRITE_WINS',
    }),
  });
}

/**
 * Log sync conflict resolution
 */
export function logConflictResolution(
  table: 'inventory_items' | 'inventory_batches' | 'inventory_movements',
  recordId: string,
  action: 'ACCEPT_REMOTE' | 'REAPPLY_LOCAL'
): void {
  void addBreadcrumb({
    category: 'sync.conflict',
    message: `Conflict resolved: ${action}`,
    level: 'info',
    data: sanitizeObjectPII({
      table,
      recordId,
      action,
    }),
  });
}

/**
 * Log CSV import operation
 */
export function logCSVImport(options: {
  operation: 'start' | 'preview' | 'complete' | 'error';
  rowCount?: number;
  successCount?: number;
  errorCount?: number;
}): void {
  const { operation, rowCount, successCount, errorCount } = options;
  void addBreadcrumb({
    category: 'inventory.csv',
    message: `CSV import ${operation}${rowCount ? ` (${rowCount} rows)` : ''}`,
    level: operation === 'error' ? 'error' : 'info',
    data: sanitizeObjectPII({
      operation,
      rowCount,
      successCount,
      errorCount,
    }),
  });
}

/**
 * Log batch expiration override
 */
export function logBatchExpirationOverride(options: {
  batchId: string;
  lotNumber: string;
  expiresOn: Date;
  reason: string;
}): void {
  const { batchId, lotNumber, expiresOn, reason } = options;
  void addBreadcrumb({
    category: 'inventory.batch',
    message: `Expired batch override: ${lotNumber}`,
    level: 'warning',
    data: sanitizeObjectPII({
      batchId,
      lotNumber,
      expiresOn: expiresOn.toISOString(),
      reason,
    }),
  });
}

/**
 * Log undo action
 */
export function logUndoAction(
  action: 'DELETE_BATCH' | 'ADJUST_INVENTORY' | 'DELETE_ITEM',
  success: boolean,
  context?: Record<string, unknown>
): void {
  void addBreadcrumb({
    category: 'inventory.undo',
    message: `Undo ${action}: ${success ? 'success' : 'failed'}`,
    level: success ? 'info' : 'error',
    data: sanitizeObjectPII({
      action,
      success,
      ...context,
    }),
  });
}
