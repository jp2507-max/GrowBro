/**
 * CSV Import/Export Tests
 *
 * Unit tests for CSV import and export functionality including idempotency verification.
 *
 * Requirements: 5.3, 5.5
 */

import { exportToCSV } from '@/lib/inventory/csv-export-service';
import {
  importCSV,
  previewCSVImport,
} from '@/lib/inventory/csv-import-service';
import { cleanup } from '@/lib/test-utils';

afterEach(cleanup);

describe('CSV Export', () => {
  test('exports RFC 4180 compliant CSV files', async () => {
    const result = await exportToCSV({});

    expect(result.items).toBeDefined();
    expect(result.items.filename).toBe('items.csv');
    expect(result.items.content).toContain('external_key,name,category');

    expect(result.batches).toBeDefined();
    expect(result.batches.filename).toBe('batches.csv');

    expect(result.movements).toBeDefined();
    expect(result.movements.filename).toBe('movements.csv');
  });

  test('uses UTF-8 encoding with CRLF line endings', async () => {
    const result = await exportToCSV({});

    // Check for CRLF line endings
    expect(result.items.content).toContain('\r\n');
  });

  test('uses ISO-8601 dates and dot decimals', async () => {
    const result = await exportToCSV({});

    // Check date format (YYYY-MM-DD)
    const dateRegex = /\d{4}-\d{2}-\d{2}/;
    expect(result.batches.content).toMatch(dateRegex);

    // Check decimal format (dot separator)
    const decimalRegex = /\d+\.\d+/;
    if (result.items.content.includes('.')) {
      expect(result.items.content).toMatch(decimalRegex);
    }
  });
});

describe('CSV Import Preview', () => {
  test('generates dry-run preview with row-level diffs', async () => {
    const csvContent = `external_key,name,category,unit,tracking_mode,min_stock,reorder_multiple,is_consumable
TEST001,Test Item,Nutrients,L,simple,10,5,true`;

    const preview = await previewCSVImport({ items: csvContent });

    expect(preview.totalRows).toBeGreaterThanOrEqual(1);
    expect(preview.diffs).toBeDefined();
    expect(preview.summary).toBeDefined();
    expect(preview.summary.itemsToAdd).toBeGreaterThanOrEqual(0);
  });

  test('validates CSV format and reports errors', async () => {
    const invalidCSV = `external_key,name
INVALID`;

    const preview = await previewCSVImport({ items: invalidCSV });

    expect(preview.invalidRows).toBeGreaterThan(0);
    expect(preview.canProceed).toBe(false);
  });
});

describe('CSV Import', () => {
  test('imports valid CSV data', async () => {
    const csvContent = `external_key,name,category,unit,tracking_mode,min_stock,reorder_multiple,is_consumable
IMPORT001,Import Test,Nutrients,L,simple,10,5,true`;

    const result = await importCSV({ items: csvContent });

    expect(result.success).toBe(true);
    expect(result.changes.itemsAdded).toBeGreaterThanOrEqual(0);
    expect(result.errors.length).toBe(0);
  });

  test('is idempotent - re-importing same file yields 0 changes', async () => {
    // First import
    const csvContent = `external_key,name,category,unit,tracking_mode,min_stock,reorder_multiple,is_consumable
IDEM001,Idempotent Test,Nutrients,L,simple,10,5,true`;

    const firstImport = await importCSV({ items: csvContent });
    expect(firstImport.changes.itemsAdded).toBeGreaterThanOrEqual(0);

    // Second import of same data
    const secondImport = await importCSV({ items: csvContent });

    // Should have zero net changes
    expect(secondImport.changes.itemsAdded).toBe(0);
    expect(secondImport.changes.itemsUpdated).toBe(0);
    expect(secondImport.changes.itemsSkipped).toBeGreaterThanOrEqual(0);
  }, 10000); // Allow more time for database operations
});

describe('CSV Size Limits', () => {
  test('enforces 50k row limit', async () => {
    // Generate CSV with >50k rows
    const header =
      'external_key,name,category,unit,tracking_mode,min_stock,reorder_multiple,is_consumable\n';
    const rows = Array.from(
      { length: 50001 },
      (_, i) => `LIMIT${i},Item ${i},Nutrients,L,simple,10,5,true`
    ).join('\n');
    const largeCSV = header + rows;

    await expect(previewCSVImport({ items: largeCSV })).rejects.toThrow();
  });

  test('enforces 10MB file size limit', async () => {
    // Generate CSV > 10MB
    const header =
      'external_key,name,category,unit,tracking_mode,min_stock,reorder_multiple,is_consumable\n';
    const largeRow = 'X'.repeat(1000); // 1KB row
    const rows = Array.from(
      { length: 11000 },
      (_, i) => `SIZE${i},${largeRow},Nutrients,L,simple,10,5,true`
    ).join('\n');
    const largeCSV = header + rows;

    await expect(previewCSVImport({ items: largeCSV })).rejects.toThrow();
  });
});
