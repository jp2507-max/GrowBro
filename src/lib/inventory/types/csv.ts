/**
 * CSV Import/Export Types
 *
 * Type definitions for RFC 4180 compliant CSV operations including
 * import/export, validation, and error handling.
 *
 * Requirements:
 * - 5.1: RFC 4180 compliant UTF-8 export with header rows
 * - 5.2: Format validation and dry-run preview with row-level diffs
 * - 5.3: Idempotent upsert operations by external_key/SKU
 * - 5.4: Specific error messages with row and column references
 * - 5.5: Detailed summary of changes with zero net changes on re-import
 * - 5.6: Documented CSV schema with external_key as primary identifier
 */

import { z } from 'zod';

import type { InventoryCategory } from '@/types/inventory';

// ============================================================================
// CSV Schema Definitions (Requirement 5.6)
// ============================================================================

/**
 * CSV Item Schema
 * Format: external_key, name, category, unit, tracking_mode, min_stock,
 *         reorder_multiple, lead_time_days, sku
 */
export const csvItemSchema = z.object({
  external_key: z.string().min(1, 'external_key is required'),
  name: z.string().min(1, 'name is required'),
  category: z.enum([
    'Nutrients',
    'Seeds',
    'Growing Media',
    'Tools',
    'Containers',
    'Amendments',
  ]),
  unit: z.string().min(1, 'unit is required'),
  tracking_mode: z.enum(['simple', 'batched']),
  min_stock: z.coerce
    .number()
    .nonnegative('min_stock must be non-negative')
    .finite(),
  reorder_multiple: z.coerce
    .number()
    .positive('reorder_multiple must be positive')
    .finite(),
  lead_time_days: z.coerce.number().int().nonnegative().finite().optional(),
  sku: z.string().optional(),
  is_consumable: z
    .enum(['true', 'false', '1', '0'])
    .transform((v) => v === 'true' || v === '1')
    .default('true'),
});

export type CSVItemRow = z.infer<typeof csvItemSchema>;

/**
 * CSV Batch Schema
 * Format: external_key, item_external_key, lot, expires_on, qty,
 *         cost_per_unit_minor, received_at
 */
export const csvBatchSchema = z.object({
  external_key: z.string().min(1, 'external_key is required'),
  item_external_key: z.string().min(1, 'item_external_key is required'),
  lot: z.string().min(1, 'lot is required'),
  expires_on: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'expires_on must be ISO-8601 (YYYY-MM-DD)')
    .optional(),
  qty: z.coerce.number().nonnegative('qty must be non-negative').finite(),
  cost_per_unit_minor: z.coerce
    .number()
    .int('cost_per_unit_minor must be integer')
    .nonnegative('cost_per_unit_minor must be non-negative'),
  received_at: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'received_at must be ISO-8601 (YYYY-MM-DD)')
    .optional(),
});

export type CSVBatchRow = z.infer<typeof csvBatchSchema>;

/**
 * CSV Movement Schema
 * Format: external_key, item_external_key, batch_lot, type, qty_delta,
 *         reason, task_external_id, created_at
 */
export const csvMovementSchema = z.object({
  external_key: z.string().min(1, 'external_key is required'),
  item_external_key: z.string().min(1, 'item_external_key is required'),
  batch_lot: z.string().optional(),
  type: z.enum(['receipt', 'consumption', 'adjustment']),
  qty_delta: z.coerce.number().finite('qty_delta must be a valid number'),
  reason: z.string().min(1, 'reason is required'),
  task_external_id: z.string().optional(),
  created_at: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'created_at must be ISO-8601 (YYYY-MM-DD)')
    .optional(),
});

export type CSVMovementRow = z.infer<typeof csvMovementSchema>;

// ============================================================================
// Validation Error Types (Requirement 5.4)
// ============================================================================

/**
 * CSV validation error with row and column context
 * Requirement 5.4
 */
export interface CSVValidationError {
  /** Row number (1-indexed, excluding header) */
  row: number;

  /** Column name */
  column: string;

  /** Error message */
  message: string;

  /** Current value that failed validation */
  value?: unknown;

  /** Severity level */
  severity: 'error' | 'warning';
}

/**
 * Parsing error for malformed CSV
 */
export interface CSVParseError {
  /** Error type */
  type: 'format' | 'encoding' | 'size_limit' | 'missing_headers';

  /** Error message */
  message: string;

  /** Optional row context */
  row?: number;
}

// ============================================================================
// Row Diff Types (Requirement 5.2)
// ============================================================================

/**
 * Action type for row-level diff
 */
export type DiffAction = 'add' | 'update' | 'skip';

/**
 * Field-level change
 */
export interface FieldChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

/**
 * Row-level diff for preview
 * Requirement 5.2
 */
export interface RowDiff {
  /** Row number in CSV (1-indexed) */
  row: number;

  /** Action to be taken */
  action: DiffAction;

  /** External key for reference */
  externalKey: string;

  /** Field-level changes (for updates) */
  changes?: FieldChange[];

  /** Error if validation failed */
  error?: string;
}

// ============================================================================
// Import Preview and Result Types (Requirement 5.2, 5.5)
// ============================================================================

/**
 * Dry-run preview result
 * Requirement 5.2
 */
export interface CSVImportPreview {
  /** Total rows in CSV (excluding header) */
  totalRows: number;

  /** Valid rows that will be processed */
  validRows: number;

  /** Invalid rows with errors */
  invalidRows: number;

  /** Row-level diffs */
  diffs: RowDiff[];

  /** Validation errors */
  errors: CSVValidationError[];

  /** Parse errors */
  parseErrors: CSVParseError[];

  /** Summary counts */
  summary: {
    itemsToAdd: number;
    itemsToUpdate: number;
    itemsToSkip: number;
    batchesToAdd: number;
    batchesToUpdate: number;
    batchesToSkip: number;
    movementsToAdd: number;
  };

  /** Whether preview is valid and ready for import */
  canProceed: boolean;
}

/**
 * Import result after execution
 * Requirement 5.5
 */
export interface CSVImportResult {
  /** Whether import succeeded */
  success: boolean;

  /** Detailed change counts */
  changes: {
    itemsAdded: number;
    itemsUpdated: number;
    itemsSkipped: number;
    batchesAdded: number;
    batchesUpdated: number;
    batchesSkipped: number;
    movementsAdded: number;
  };

  /** Errors that occurred during import */
  errors: CSVValidationError[];

  /** Duration in milliseconds */
  durationMs: number;

  /** Timestamp of import */
  timestamp: Date;
}

// ============================================================================
// Export Types (Requirement 5.1)
// ============================================================================

/**
 * Export options
 */
export interface CSVExportOptions {
  /** Include deleted items */
  includeDeleted?: boolean;

  /** Filter by date range (for movements) */
  dateRange?: {
    from: Date;
    to: Date;
  };

  /** Categories to export (all if omitted) */
  categories?: InventoryCategory[];
}

/**
 * Single CSV file export result
 */
export interface CSVFileExport {
  /** Filename (e.g., "items.csv") */
  filename: string;

  /** CSV content as UTF-8 string */
  content: string;

  /** Number of rows (excluding header) */
  rowCount: number;

  /** File size in bytes */
  sizeBytes: number;
}

/**
 * Complete export result
 * Requirement 5.1
 */
export interface CSVExportResult {
  /** Items export */
  items: CSVFileExport;

  /** Batches export */
  batches: CSVFileExport;

  /** Movements export */
  movements: CSVFileExport;

  /** Total rows across all files */
  totalRows: number;

  /** Total size in bytes */
  totalBytes: number;

  /** Export timestamp */
  timestamp: Date;
}

// ============================================================================
// Size Limit Constants
// ============================================================================

export const CSV_LIMITS = {
  /** Maximum rows per file (50,000) */
  MAX_ROWS: 50_000,

  /** Maximum file size in bytes (10 MB) */
  MAX_SIZE_BYTES: 10 * 1024 * 1024,

  /** Maximum single field length */
  MAX_FIELD_LENGTH: 10_000,
} as const;

// ============================================================================
// CSV Format Constants (RFC 4180)
// ============================================================================

export const CSV_FORMAT = {
  /** Delimiter */
  DELIMITER: ',',

  /** Line ending (CRLF for RFC 4180) */
  LINE_ENDING: '\r\n',

  /** Quote character */
  QUOTE: '"',

  /** Encoding */
  ENCODING: 'utf-8',

  /** Date format (ISO-8601) */
  DATE_FORMAT: 'YYYY-MM-DD',
} as const;

// ============================================================================
// Helper Types
// ============================================================================

/**
 * Parsed CSV data by type
 */
export interface ParsedCSVData {
  items?: CSVItemRow[];
  batches?: CSVBatchRow[];
  movements?: CSVMovementRow[];
}

/**
 * CSV file type identifier
 */
export type CSVFileType = 'items' | 'batches' | 'movements';

/**
 * Idempotency tracking
 */
export interface ImportIdempotencyKey {
  /** File hash for deduplication */
  fileHash: string;

  /** Last import timestamp */
  lastImportedAt: Date;

  /** Row count from last import */
  rowCount: number;
}
