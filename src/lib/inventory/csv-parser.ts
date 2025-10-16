/**
 * CSV Parser and Validator
 *
 * RFC 4180 compliant CSV parsing with size limits, validation,
 * and comprehensive error reporting.
 *
 * Requirements:
 * - 5.2: Validate format compliance and display validation errors
 * - 5.4: Specific error messages with row and column references
 * - Size limits: Max 50k rows or 10MB
 */

import { parse, type ParseResult } from 'papaparse';

import type {
  CSVBatchRow,
  CSVFileType,
  CSVItemRow,
  CSVMovementRow,
  CSVParseError,
  CSVValidationError,
  ParsedCSVData,
} from './types/csv';
import {
  CSV_FORMAT,
  CSV_LIMITS,
  csvBatchSchema,
  csvItemSchema,
  csvMovementSchema,
} from './types/csv';

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Expected headers for each CSV file type
 */
const EXPECTED_HEADERS: Record<CSVFileType, string[]> = {
  items: [
    'external_key',
    'name',
    'category',
    'unit',
    'tracking_mode',
    'min_stock',
    'reorder_multiple',
    'lead_time_days',
    'sku',
    'is_consumable',
  ],
  batches: [
    'external_key',
    'item_external_key',
    'lot',
    'expires_on',
    'qty',
    'cost_per_unit_minor',
    'received_at',
  ],
  movements: [
    'external_key',
    'item_external_key',
    'batch_lot',
    'type',
    'qty_delta',
    'reason',
    'task_external_id',
    'created_at',
  ],
};

// ============================================================================
// Size Validation
// ============================================================================

/**
 * Validate CSV file size constraints
 */
function validateSize(content: string): CSVParseError | null {
  const sizeBytes = new TextEncoder().encode(content).length;

  if (sizeBytes > CSV_LIMITS.MAX_SIZE_BYTES) {
    return {
      type: 'size_limit',
      message: `File size (${(sizeBytes / 1024 / 1024).toFixed(2)} MB) exceeds maximum allowed size (${CSV_LIMITS.MAX_SIZE_BYTES / 1024 / 1024} MB)`,
    };
  }

  return null;
}

/**
 * Validate row count constraint
 */
function validateRowCount(rowCount: number): CSVParseError | null {
  if (rowCount > CSV_LIMITS.MAX_ROWS) {
    return {
      type: 'size_limit',
      message: `Row count (${rowCount}) exceeds maximum allowed rows (${CSV_LIMITS.MAX_ROWS})`,
    };
  }

  return null;
}

// ============================================================================
// Header Validation
// ============================================================================

/**
 * Validate CSV headers match expected schema
 */
function validateHeaders(
  headers: string[],
  fileType: CSVFileType
): CSVParseError | null {
  const expected = EXPECTED_HEADERS[fileType];
  const missing = expected.filter((h) => !headers.includes(h));

  if (missing.length > 0) {
    return {
      type: 'missing_headers',
      message: `Missing required headers: ${missing.join(', ')}. Expected headers: ${expected.join(', ')}`,
      row: 1,
    };
  }

  return null;
}

// ============================================================================
// Row Validation
// ============================================================================

/**
 * Validate single item row using Zod schema
 */
function validateItemRow(
  row: Record<string, unknown>,
  rowIndex: number
): CSVValidationError[] {
  const result = csvItemSchema.safeParse(row);

  if (!result.success) {
    return result.error.errors.map((err) => ({
      row: rowIndex,
      column: err.path.join('.'),
      message: err.message,
      value: row[err.path[0] as string],
      severity: 'error',
    }));
  }

  return [];
}

/**
 * Validate single batch row using Zod schema
 */
function validateBatchRow(
  row: Record<string, unknown>,
  rowIndex: number
): CSVValidationError[] {
  const result = csvBatchSchema.safeParse(row);

  if (!result.success) {
    return result.error.errors.map((err) => ({
      row: rowIndex,
      column: err.path.join('.'),
      message: err.message,
      value: row[err.path[0] as string],
      severity: 'error',
    }));
  }

  return [];
}

/**
 * Validate single movement row using Zod schema
 */
function validateMovementRow(
  row: Record<string, unknown>,
  rowIndex: number
): CSVValidationError[] {
  const result = csvMovementSchema.safeParse(row);

  if (!result.success) {
    return result.error.errors.map((err) => ({
      row: rowIndex,
      column: err.path.join('.'),
      message: err.message,
      value: row[err.path[0] as string],
      severity: 'error',
    }));
  }

  return [];
}

// ============================================================================
// Main Parser
// ============================================================================

/**
 * Parse CSV content with validation
 * Requirement 5.2, 5.4
 */
export interface ParseCSVResult {
  success: boolean;
  data?: Record<string, unknown>[];
  errors: CSVParseError[];
  validationErrors: CSVValidationError[];
  rowCount: number;
}

/**
 * Parse and validate CSV file
 */
// eslint-disable-next-line max-lines-per-function
export function parseCSV(
  content: string,
  fileType: CSVFileType
): ParseCSVResult {
  const errors: CSVParseError[] = [];
  const validationErrors: CSVValidationError[] = [];

  // 1. Validate size
  const sizeError = validateSize(content);
  if (sizeError) {
    return {
      success: false,
      errors: [sizeError],
      validationErrors: [],
      rowCount: 0,
    };
  }

  // 2. Parse CSV using PapaParse (RFC 4180 compliant)
  let parseResult: ParseResult<Record<string, unknown>>;
  try {
    parseResult = parse<Record<string, unknown>>(content, {
      header: true,
      delimiter: CSV_FORMAT.DELIMITER,
      newline: CSV_FORMAT.LINE_ENDING,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().toLowerCase(),
      transform: (value) => value.trim(),
    });
  } catch (error) {
    return {
      success: false,
      errors: [
        {
          type: 'format',
          message: `Failed to parse CSV: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ],
      validationErrors: [],
      rowCount: 0,
    };
  }

  // 3. Check for parser errors
  if (parseResult.errors.length > 0) {
    errors.push({
      type: 'format',
      message: `CSV format errors: ${parseResult.errors.map((e) => e.message).join('; ')}`,
      row: parseResult.errors[0].row || undefined,
    });
  }

  const data = parseResult.data;

  // 4. Validate row count
  const rowCountError = validateRowCount(data.length);
  if (rowCountError) {
    return {
      success: false,
      errors: [rowCountError],
      validationErrors: [],
      rowCount: data.length,
    };
  }

  // 5. Validate headers
  if (data.length > 0) {
    const headers = Object.keys(data[0]);
    const headerError = validateHeaders(headers, fileType);
    if (headerError) {
      return {
        success: false,
        errors: [headerError],
        validationErrors: [],
        rowCount: data.length,
      };
    }
  }

  // 6. Validate each row
  data.forEach((row, index) => {
    const rowIndex = index + 1; // 1-indexed for user display

    let rowErrors: CSVValidationError[] = [];
    switch (fileType) {
      case 'items':
        rowErrors = validateItemRow(row, rowIndex);
        break;
      case 'batches':
        rowErrors = validateBatchRow(row, rowIndex);
        break;
      case 'movements':
        rowErrors = validateMovementRow(row, rowIndex);
        break;
    }

    validationErrors.push(...rowErrors);
  });

  return {
    success: errors.length === 0 && validationErrors.length === 0,
    data,
    errors,
    validationErrors,
    rowCount: data.length,
  };
}

// ============================================================================
// Typed Parsing
// ============================================================================

/**
 * Parse items CSV with full validation
 */
export function parseItemsCSV(content: string): {
  success: boolean;
  data?: CSVItemRow[];
  errors: CSVParseError[];
  validationErrors: CSVValidationError[];
} {
  const result = parseCSV(content, 'items');

  if (!result.success || !result.data) {
    return {
      success: false,
      errors: result.errors,
      validationErrors: result.validationErrors,
    };
  }

  // Parse with Zod to get typed data
  const items: CSVItemRow[] = [];
  result.data.forEach((row) => {
    const parsed = csvItemSchema.safeParse(row);
    if (parsed.success) {
      items.push(parsed.data);
    }
  });

  return {
    success: result.validationErrors.length === 0,
    data: items,
    errors: result.errors,
    validationErrors: result.validationErrors,
  };
}

/**
 * Parse batches CSV with full validation
 */
export function parseBatchesCSV(content: string): {
  success: boolean;
  data?: CSVBatchRow[];
  errors: CSVParseError[];
  validationErrors: CSVValidationError[];
} {
  const result = parseCSV(content, 'batches');

  if (!result.success || !result.data) {
    return {
      success: false,
      errors: result.errors,
      validationErrors: result.validationErrors,
    };
  }

  // Parse with Zod to get typed data
  const batches: CSVBatchRow[] = [];
  result.data.forEach((row) => {
    const parsed = csvBatchSchema.safeParse(row);
    if (parsed.success) {
      batches.push(parsed.data);
    }
  });

  return {
    success: result.validationErrors.length === 0,
    data: batches,
    errors: result.errors,
    validationErrors: result.validationErrors,
  };
}

/**
 * Parse movements CSV with full validation
 */
export function parseMovementsCSV(content: string): {
  success: boolean;
  data?: CSVMovementRow[];
  errors: CSVParseError[];
  validationErrors: CSVValidationError[];
} {
  const result = parseCSV(content, 'movements');

  if (!result.success || !result.data) {
    return {
      success: false,
      errors: result.errors,
      validationErrors: result.validationErrors,
    };
  }

  // Parse with Zod to get typed data
  const movements: CSVMovementRow[] = [];
  result.data.forEach((row) => {
    const parsed = csvMovementSchema.safeParse(row);
    if (parsed.success) {
      movements.push(parsed.data);
    }
  });

  return {
    success: result.validationErrors.length === 0,
    data: movements,
    errors: result.errors,
    validationErrors: result.validationErrors,
  };
}

/**
 * Parse multiple CSV files and return typed data
 */
export async function parseCSVFiles(files: {
  items?: string;
  batches?: string;
  movements?: string;
}): Promise<{
  success: boolean;
  data: ParsedCSVData;
  errors: Map<CSVFileType, CSVParseError[]>;
  validationErrors: Map<CSVFileType, CSVValidationError[]>;
}> {
  const data: ParsedCSVData = {};
  const errors = new Map<CSVFileType, CSVParseError[]>();
  const validationErrors = new Map<CSVFileType, CSVValidationError[]>();

  // Parse items
  if (files.items) {
    const result = parseItemsCSV(files.items);
    if (result.data) {
      data.items = result.data;
    }
    if (result.errors.length > 0) {
      errors.set('items', result.errors);
    }
    if (result.validationErrors.length > 0) {
      validationErrors.set('items', result.validationErrors);
    }
  }

  // Parse batches
  if (files.batches) {
    const result = parseBatchesCSV(files.batches);
    if (result.data) {
      data.batches = result.data;
    }
    if (result.errors.length > 0) {
      errors.set('batches', result.errors);
    }
    if (result.validationErrors.length > 0) {
      validationErrors.set('batches', result.validationErrors);
    }
  }

  // Parse movements
  if (files.movements) {
    const result = parseMovementsCSV(files.movements);
    if (result.data) {
      data.movements = result.data;
    }
    if (result.errors.length > 0) {
      errors.set('movements', result.errors);
    }
    if (result.validationErrors.length > 0) {
      validationErrors.set('movements', result.validationErrors);
    }
  }

  const success = errors.size === 0 && validationErrors.size === 0;

  return {
    success,
    data,
    errors,
    validationErrors,
  };
}
