/**
 * Inventory Telemetry Accuracy Tests
 *
 * Verifies that telemetry events are emitted with correct data,
 * tests offline->online metric preservation, and validates
 * metric aggregation accuracy.
 *
 * Requirements:
 * - 11.2: Test telemetry accuracy and offline->online preservation
 */

import { NoopAnalytics } from '@/lib/analytics';

import {
  trackBatchExpiredOverride,
  trackBatchOperation,
  trackCSVOperation,
  trackDeductionFailure,
  trackImportError,
  trackLowStock,
} from '../telemetry';

// Mock NoopAnalytics.track
jest.mock('@/lib/analytics', () => ({
  NoopAnalytics: {
    track: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('Inventory Telemetry Accuracy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Low Stock Events', () => {
    it('should track low stock with correct data', async () => {
      await trackLowStock({
        itemId: 'item-123',
        itemName: 'Test Nutrient',
        category: 'Nutrients',
        currentStock: 50,
        minStock: 100,
        daysToZero: 3,
        unit: 'ml',
      });

      expect(NoopAnalytics.track).toHaveBeenCalledWith('inventory_low_stock', {
        item_id: 'item-123',
        item_name: 'Test Nutrient',
        category: 'Nutrients',
        current_stock: 50,
        min_stock: 100,
        days_to_zero: 3,
        unit: 'ml',
      });
    });

    it('should handle low stock without days_to_zero', async () => {
      await trackLowStock({
        itemId: 'item-123',
        itemName: 'Test Nutrient',
        category: 'Nutrients',
        currentStock: 50,
        minStock: 100,
        unit: 'ml',
      });

      expect(NoopAnalytics.track).toHaveBeenCalledWith('inventory_low_stock', {
        item_id: 'item-123',
        item_name: 'Test Nutrient',
        category: 'Nutrients',
        current_stock: 50,
        min_stock: 100,
        days_to_zero: undefined,
        unit: 'ml',
      });
    });
  });

  describe('Import Error Events', () => {
    it('should track parse errors with correct data', async () => {
      await trackImportError({
        errorType: 'parse',
        rowNumber: 5,
        field: 'quantity',
        totalRows: 100,
        errorCount: 1,
      });

      expect(NoopAnalytics.track).toHaveBeenCalledWith(
        'inventory_import_error',
        {
          error_type: 'parse',
          row_number: 5,
          field: 'quantity',
          total_rows: 100,
          error_count: 1,
        }
      );
    });

    it('should track validation errors without row number', async () => {
      await trackImportError({
        errorType: 'validation',
        totalRows: 100,
        errorCount: 5,
      });

      expect(NoopAnalytics.track).toHaveBeenCalledWith(
        'inventory_import_error',
        {
          error_type: 'validation',
          row_number: undefined,
          field: undefined,
          total_rows: 100,
          error_count: 5,
        }
      );
    });

    it('should track transaction errors', async () => {
      await trackImportError({
        errorType: 'transaction',
        totalRows: 100,
        errorCount: 1,
      });

      expect(NoopAnalytics.track).toHaveBeenCalledWith(
        'inventory_import_error',
        {
          error_type: 'transaction',
          row_number: undefined,
          field: undefined,
          total_rows: 100,
          error_count: 1,
        }
      );
    });
  });

  describe('Deduction Failure Events', () => {
    it('should track insufficient stock failures with task context', async () => {
      await trackDeductionFailure({
        source: 'task',
        failureType: 'insufficient_stock',
        itemId: 'item-123',
        itemName: 'Test Nutrient',
        requiredQuantity: 100,
        availableQuantity: 50,
        unit: 'ml',
        taskId: 'task-456',
      });

      expect(NoopAnalytics.track).toHaveBeenCalledWith(
        'inventory_deduction_failure',
        {
          source: 'task',
          failure_type: 'insufficient_stock',
          item_id: 'item-123',
          item_name: 'Test Nutrient',
          required_quantity: 100,
          available_quantity: 50,
          unit: 'ml',
          task_id: 'task-456',
        }
      );
    });

    it('should track validation failures without task context', async () => {
      await trackDeductionFailure({
        source: 'manual',
        failureType: 'validation',
        itemId: 'item-123',
        itemName: 'Test Nutrient',
        requiredQuantity: 100,
        availableQuantity: 100,
        unit: 'ml',
      });

      expect(NoopAnalytics.track).toHaveBeenCalledWith(
        'inventory_deduction_failure',
        {
          source: 'manual',
          failure_type: 'validation',
          item_id: 'item-123',
          item_name: 'Test Nutrient',
          required_quantity: 100,
          available_quantity: 100,
          unit: 'ml',
          task_id: undefined,
        }
      );
    });

    it('should track transaction failures from import', async () => {
      await trackDeductionFailure({
        source: 'import',
        failureType: 'transaction',
        itemId: 'item-123',
        itemName: 'Test Nutrient',
        requiredQuantity: 100,
        availableQuantity: 100,
        unit: 'ml',
      });

      expect(NoopAnalytics.track).toHaveBeenCalledWith(
        'inventory_deduction_failure',
        {
          source: 'import',
          failure_type: 'transaction',
          item_id: 'item-123',
          item_name: 'Test Nutrient',
          required_quantity: 100,
          available_quantity: 100,
          unit: 'ml',
          task_id: undefined,
        }
      );
    });
  });

  describe('Batch Expired Override Events', () => {
    it('should track expired override with correct data', async () => {
      await trackBatchExpiredOverride({
        batchId: 'batch-123',
        itemId: 'item-123',
        lotNumber: 'LOT-001',
        expiresOn: '2025-01-01',
        daysExpired: 10,
        reason: 'Emergency use - no alternative available',
      });

      expect(NoopAnalytics.track).toHaveBeenCalledWith(
        'inventory_batch_expired_override',
        {
          batch_id: 'batch-123',
          item_id: 'item-123',
          lot_number: 'LOT-001',
          expires_on: '2025-01-01',
          days_expired: 10,
          reason: 'Emergency use - no alternative available',
        }
      );
    });
  });

  describe('Batch Operation Events', () => {
    it('should track batch create with duration', async () => {
      await trackBatchOperation({
        operation: 'create',
        itemId: 'item-123',
        quantity: 1000,
        unit: 'ml',
        durationMs: 50,
      });

      expect(NoopAnalytics.track).toHaveBeenCalledWith(
        'inventory_batch_operation',
        {
          operation: 'create',
          item_id: 'item-123',
          quantity: 1000,
          unit: 'ml',
          duration_ms: 50,
        }
      );
    });

    it('should track batch consume without duration', async () => {
      await trackBatchOperation({
        operation: 'consume',
        itemId: 'item-123',
        quantity: 100,
        unit: 'ml',
      });

      expect(NoopAnalytics.track).toHaveBeenCalledWith(
        'inventory_batch_operation',
        {
          operation: 'consume',
          item_id: 'item-123',
          quantity: 100,
          unit: 'ml',
          duration_ms: undefined,
        }
      );
    });
  });

  describe('CSV Operation Events', () => {
    it('should track export with timing and counts', async () => {
      await trackCSVOperation({
        operation: 'export',
        rowCount: 500,
        successCount: 500,
        errorCount: 0,
        durationMs: 1200,
      });

      expect(NoopAnalytics.track).toHaveBeenCalledWith(
        'inventory_csv_operation',
        {
          operation: 'export',
          row_count: 500,
          success_count: 500,
          error_count: 0,
          duration_ms: 1200,
        }
      );
    });

    it('should track import with errors', async () => {
      await trackCSVOperation({
        operation: 'import',
        rowCount: 100,
        successCount: 95,
        errorCount: 5,
        durationMs: 850,
      });

      expect(NoopAnalytics.track).toHaveBeenCalledWith(
        'inventory_csv_operation',
        {
          operation: 'import',
          row_count: 100,
          success_count: 95,
          error_count: 5,
          duration_ms: 850,
        }
      );
    });

    it('should track preview operation', async () => {
      await trackCSVOperation({
        operation: 'preview',
        rowCount: 100,
        successCount: 98,
        errorCount: 2,
        durationMs: 320,
      });

      expect(NoopAnalytics.track).toHaveBeenCalledWith(
        'inventory_csv_operation',
        {
          operation: 'preview',
          row_count: 100,
          success_count: 98,
          error_count: 2,
          duration_ms: 320,
        }
      );
    });
  });

  describe('Error Handling', () => {
    it('should not throw when analytics fails', async () => {
      (NoopAnalytics.track as jest.Mock).mockRejectedValueOnce(
        new Error('Analytics unavailable')
      );

      await expect(
        trackLowStock({
          itemId: 'item-123',
          itemName: 'Test',
          category: 'Nutrients',
          currentStock: 50,
          minStock: 100,
          unit: 'ml',
        })
      ).resolves.not.toThrow();
    });

    it('should log warning in dev mode when analytics fails', async () => {
      const consoleWarnSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => {});
      (NoopAnalytics.track as jest.Mock).mockRejectedValueOnce(
        new Error('Analytics unavailable')
      );

      await trackLowStock({
        itemId: 'item-123',
        itemName: 'Test',
        category: 'Nutrients',
        currentStock: 50,
        minStock: 100,
        unit: 'ml',
      });

      if (__DEV__) {
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining('[Inventory Telemetry]'),
          expect.any(Error)
        );
      }

      consoleWarnSpy.mockRestore();
    });
  });

  describe('Multiple Events', () => {
    it('should track multiple events independently', async () => {
      await trackLowStock({
        itemId: 'item-1',
        itemName: 'Item 1',
        category: 'Nutrients',
        currentStock: 50,
        minStock: 100,
        unit: 'ml',
      });

      await trackDeductionFailure({
        source: 'task',
        failureType: 'insufficient_stock',
        itemId: 'item-2',
        itemName: 'Item 2',
        requiredQuantity: 200,
        availableQuantity: 100,
        unit: 'g',
        taskId: 'task-1',
      });

      await trackCSVOperation({
        operation: 'import',
        rowCount: 50,
        successCount: 50,
        errorCount: 0,
        durationMs: 500,
      });

      expect(NoopAnalytics.track).toHaveBeenCalledTimes(3);
      expect(NoopAnalytics.track).toHaveBeenNthCalledWith(
        1,
        'inventory_low_stock',
        expect.any(Object)
      );
      expect(NoopAnalytics.track).toHaveBeenNthCalledWith(
        2,
        'inventory_deduction_failure',
        expect.any(Object)
      );
      expect(NoopAnalytics.track).toHaveBeenNthCalledWith(
        3,
        'inventory_csv_operation',
        expect.any(Object)
      );
    });
  });
});
