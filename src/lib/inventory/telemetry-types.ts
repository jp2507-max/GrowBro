/**
 * Inventory Telemetry Type Definitions
 *
 * Types for inventory-specific telemetry events tracked across the system.
 * All events are consent-aware and routed through NoopAnalytics.
 *
 * Requirements:
 * - 11.1: Track sync duration, conflict count, low-stock events, import error rate, auto-deduction failure rate
 * - 11.2: Performance impact measurement and telemetry accuracy validation
 */

/**
 * Low stock event details
 * Emitted when inventory falls to/below reorder point
 */
export interface LowStockEvent {
  itemId: string;
  itemName: string;
  category: string;
  currentStock: number;
  minStock: number;
  daysToZero?: number;
  unit: string;
}

/**
 * Import error event details
 * Tracks CSV import failures with categorization
 */
export interface ImportErrorEvent {
  errorType: 'parse' | 'validation' | 'transaction';
  rowNumber?: number;
  field?: string;
  totalRows: number;
  errorCount: number;
}

/**
 * Deduction failure event details
 * Tracks auto-deduction failures by source and type
 */
export interface DeductionFailureEvent {
  source: 'task' | 'manual' | 'import';
  failureType: 'insufficient_stock' | 'validation' | 'transaction';
  itemId: string;
  itemName: string;
  requiredQuantity: number;
  availableQuantity: number;
  unit: string;
  taskId?: string;
}

/**
 * Batch expired override event details
 * Tracks usage of expired batches with reason logging
 */
export interface BatchExpiredOverrideEvent {
  batchId: string;
  itemId: string;
  lotNumber: string;
  expiresOn: string;
  daysExpired: number;
  reason: string;
}

/**
 * Batch operation event details
 * Tracks create/update/delete/consume operations
 */
export interface BatchOperationEvent {
  operation: 'create' | 'update' | 'delete' | 'consume';
  itemId: string;
  quantity: number;
  unit: string;
  durationMs?: number;
}

/**
 * CSV operation event details
 * Tracks export/import/preview operations with timing
 */
export interface CSVOperationEvent {
  operation: 'export' | 'import' | 'preview';
  rowCount: number;
  successCount?: number;
  errorCount?: number;
  durationMs: number;
}

/**
 * Aggregated telemetry metrics
 * Used for health monitoring and dashboard queries
 */
export interface InventoryTelemetryMetrics {
  lowStockEvents: number;
  importErrorRate: number;
  deductionFailureRate: number;
  batchOperationsTotal: number;
  averageDeductionDurationMs: number;
  averageImportDurationMs: number;
  lastUpdated: number;
}
