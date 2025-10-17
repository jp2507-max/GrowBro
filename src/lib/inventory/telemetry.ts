/**
 * Inventory Telemetry Service
 *
 * Centralized telemetry tracking for inventory operations.
 * All tracking is consent-aware via NoopAnalytics integration.
 *
 * Requirements:
 * - 11.1: Track sync duration, conflict count, low-stock events, import error rate, auto-deduction failure rate
 * - 11.2: Minimal performance overhead (<1% of operation duration)
 *
 * Usage:
 * ```ts
 * import { trackLowStock, trackDeductionFailure } from '@/lib/inventory/telemetry';
 *
 * // Track low stock event
 * await trackLowStock({
 *   itemId: '123',
 *   itemName: 'Test Nutrient',
 *   category: 'Nutrients',
 *   currentStock: 50,
 *   minStock: 100,
 *   daysToZero: 3,
 *   unit: 'ml'
 * });
 *
 * // Track deduction failure
 * await trackDeductionFailure({
 *   source: 'task',
 *   failureType: 'insufficient_stock',
 *   itemId: '123',
 *   itemName: 'Test Nutrient',
 *   requiredQuantity: 100,
 *   availableQuantity: 50,
 *   unit: 'ml',
 *   taskId: 'task-456'
 * });
 * ```
 */

import { NoopAnalytics } from '@/lib/analytics';

import type {
  BatchExpiredOverrideEvent,
  BatchOperationEvent,
  CSVOperationEvent,
  DeductionFailureEvent,
  ImportErrorEvent,
  LowStockEvent,
} from './telemetry-types';

/**
 * Track low stock event
 * Emitted when inventory falls to/below reorder point
 *
 * @param event - Low stock event details
 */
export async function trackLowStock(event: LowStockEvent): Promise<void> {
  try {
    await NoopAnalytics.track('inventory_low_stock', {
      item_id: event.itemId,
      item_name: event.itemName,
      category: event.category,
      current_stock: event.currentStock,
      min_stock: event.minStock,
      days_to_zero: event.daysToZero,
      unit: event.unit,
    });
  } catch (error) {
    // Analytics failures should not break inventory operations
    if (__DEV__) {
      console.warn('[Inventory Telemetry] Failed to track low stock:', error);
    }
  }
}

/**
 * Track CSV import error
 * Emitted for parse, validation, or transaction failures during import
 *
 * @param event - Import error event details
 */
export async function trackImportError(event: ImportErrorEvent): Promise<void> {
  try {
    await NoopAnalytics.track('inventory_import_error', {
      error_type: event.errorType,
      row_number: event.rowNumber,
      field: event.field,
      total_rows: event.totalRows,
      error_count: event.errorCount,
    });
  } catch (error) {
    if (__DEV__) {
      console.warn(
        '[Inventory Telemetry] Failed to track import error:',
        error
      );
    }
  }
}

/**
 * Track inventory deduction failure
 * Emitted for insufficient stock, validation, or transaction failures
 *
 * @param event - Deduction failure event details
 */
export async function trackDeductionFailure(
  event: DeductionFailureEvent
): Promise<void> {
  try {
    await NoopAnalytics.track('inventory_deduction_failure', {
      source: event.source,
      failure_type: event.failureType,
      item_id: event.itemId,
      item_name: event.itemName,
      required_quantity: event.requiredQuantity,
      available_quantity: event.availableQuantity,
      unit: event.unit,
      task_id: event.taskId,
    });
  } catch (error) {
    if (__DEV__) {
      console.warn(
        '[Inventory Telemetry] Failed to track deduction failure:',
        error
      );
    }
  }
}

/**
 * Track batch expired override
 * Emitted when user explicitly consumes from expired batch with reason
 *
 * @param event - Batch expired override event details
 */
export async function trackBatchExpiredOverride(
  event: BatchExpiredOverrideEvent
): Promise<void> {
  try {
    await NoopAnalytics.track('inventory_batch_expired_override', {
      batch_id: event.batchId,
      item_id: event.itemId,
      lot_number: event.lotNumber,
      expires_on: event.expiresOn,
      days_expired: event.daysExpired,
      reason: event.reason,
    });
  } catch (error) {
    if (__DEV__) {
      console.warn(
        '[Inventory Telemetry] Failed to track expired override:',
        error
      );
    }
  }
}

/**
 * Track batch operation
 * Emitted for create/update/delete/consume operations with timing
 *
 * @param event - Batch operation event details
 */
export async function trackBatchOperation(
  event: BatchOperationEvent
): Promise<void> {
  try {
    await NoopAnalytics.track('inventory_batch_operation', {
      operation: event.operation,
      item_id: event.itemId,
      quantity: event.quantity,
      unit: event.unit,
      duration_ms: event.durationMs,
    });
  } catch (error) {
    if (__DEV__) {
      console.warn(
        '[Inventory Telemetry] Failed to track batch operation:',
        error
      );
    }
  }
}

/**
 * Track CSV operation
 * Emitted for export/import/preview operations with timing and counts
 *
 * @param event - CSV operation event details
 */
export async function trackCSVOperation(
  event: CSVOperationEvent
): Promise<void> {
  try {
    await NoopAnalytics.track('inventory_csv_operation', {
      operation: event.operation,
      row_count: event.rowCount,
      success_count: event.successCount,
      error_count: event.errorCount,
      duration_ms: event.durationMs,
    });
  } catch (error) {
    if (__DEV__) {
      console.warn(
        '[Inventory Telemetry] Failed to track CSV operation:',
        error
      );
    }
  }
}
