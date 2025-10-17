/**
 * Inventory Telemetry Performance Tests
 *
 * Measures telemetry overhead on deduction, import, and sync operations.
 * Verifies <1% performance overhead target (Requirement 11.2).
 *
 * Requirements:
 * - 11.2: Performance impact measurement with <1% overhead target
 */

import { NoopAnalytics } from '@/lib/analytics';

import {
  trackBatchOperation,
  trackCSVOperation,
  trackDeductionFailure,
  trackImportError,
  trackLowStock,
} from '../telemetry';

// Mock NoopAnalytics.track with realistic timing
jest.mock('@/lib/analytics', () => ({
  NoopAnalytics: {
    track: jest.fn().mockImplementation(async () => {
      // Simulate minimal analytics overhead (0.1ms)
      await new Promise((resolve) => setTimeout(resolve, 0.1));
    }),
  },
}));

describe('Inventory Telemetry Performance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Low Stock Tracking Overhead', () => {
    it('should have <1% overhead on stock checks', async () => {
      const operationTime = 10; // 10ms for stock check operation
      const iterations = 100;

      // Measure baseline (operation without telemetry)
      const baselineStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        await new Promise((resolve) => setTimeout(resolve, operationTime));
      }
      const baselineDuration = performance.now() - baselineStart;

      // Measure with telemetry
      const telemetryStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        await new Promise((resolve) => setTimeout(resolve, operationTime));
        await trackLowStock({
          itemId: `item-${i}`,
          itemName: `Item ${i}`,
          category: 'Nutrients',
          currentStock: 50,
          minStock: 100,
          unit: 'ml',
        });
      }
      const telemetryDuration = performance.now() - telemetryStart;

      const overhead = telemetryDuration - baselineDuration;
      const overheadPercent = (overhead / baselineDuration) * 100;

      expect(overheadPercent).toBeLessThan(1);
      expect(NoopAnalytics.track).toHaveBeenCalledTimes(iterations);
    });
  });

  describe('Deduction Failure Tracking Overhead', () => {
    it('should have <1% overhead on deduction failures', async () => {
      const operationTime = 50; // 50ms for deduction operation
      const iterations = 50;

      // Baseline
      const baselineStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        await new Promise((resolve) => setTimeout(resolve, operationTime));
      }
      const baselineDuration = performance.now() - baselineStart;

      // With telemetry
      const telemetryStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        await new Promise((resolve) => setTimeout(resolve, operationTime));
        await trackDeductionFailure({
          source: 'task',
          failureType: 'insufficient_stock',
          itemId: `item-${i}`,
          itemName: `Item ${i}`,
          requiredQuantity: 100,
          availableQuantity: 50,
          unit: 'ml',
          taskId: `task-${i}`,
        });
      }
      const telemetryDuration = performance.now() - telemetryStart;

      const overhead = telemetryDuration - baselineDuration;
      const overheadPercent = (overhead / baselineDuration) * 100;

      expect(overheadPercent).toBeLessThan(1);
    });
  });

  describe('Import Error Tracking Overhead', () => {
    it('should have <1% overhead on import operations', async () => {
      const operationTime = 200; // 200ms for import operation
      const iterations = 20;

      // Baseline
      const baselineStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        await new Promise((resolve) => setTimeout(resolve, operationTime));
      }
      const baselineDuration = performance.now() - baselineStart;

      // With telemetry
      const telemetryStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        await new Promise((resolve) => setTimeout(resolve, operationTime));
        await trackImportError({
          errorType: 'validation',
          totalRows: 100,
          errorCount: 5,
        });
      }
      const telemetryDuration = performance.now() - telemetryStart;

      const overhead = telemetryDuration - baselineDuration;
      const overheadPercent = (overhead / baselineDuration) * 100;

      expect(overheadPercent).toBeLessThan(1);
    });
  });

  describe('CSV Operation Tracking Overhead', () => {
    it('should have <1% overhead on CSV export', async () => {
      const operationTime = 1000; // 1000ms for large CSV export
      const iterations = 10;

      // Baseline
      const baselineStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        await new Promise((resolve) => setTimeout(resolve, operationTime));
      }
      const baselineDuration = performance.now() - baselineStart;

      // With telemetry
      const telemetryStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        await new Promise((resolve) => setTimeout(resolve, operationTime));
        await trackCSVOperation({
          operation: 'export',
          rowCount: 1000,
          successCount: 1000,
          errorCount: 0,
          durationMs: operationTime,
        });
      }
      const telemetryDuration = performance.now() - telemetryStart;

      const overhead = telemetryDuration - baselineDuration;
      const overheadPercent = (overhead / baselineDuration) * 100;

      expect(overheadPercent).toBeLessThan(1);
    });
  });

  describe('Batch Operation Tracking Overhead', () => {
    it('should have <1% overhead on batch operations', async () => {
      const operationTime = 30; // 30ms for batch operation
      const iterations = 100;

      // Baseline
      const baselineStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        await new Promise((resolve) => setTimeout(resolve, operationTime));
      }
      const baselineDuration = performance.now() - baselineStart;

      // With telemetry
      const telemetryStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        await new Promise((resolve) => setTimeout(resolve, operationTime));
        await trackBatchOperation({
          operation: 'consume',
          itemId: `item-${i}`,
          quantity: 100,
          unit: 'ml',
          durationMs: operationTime,
        });
      }
      const telemetryDuration = performance.now() - telemetryStart;

      const overhead = telemetryDuration - baselineDuration;
      const overheadPercent = (overhead / baselineDuration) * 100;

      expect(overheadPercent).toBeLessThan(1);
    });
  });

  describe('High-Frequency Event Tracking', () => {
    it('should handle rapid event bursts efficiently', async () => {
      const burstSize = 50;
      const start = performance.now();

      // Fire burst of events
      const promises = [];
      for (let i = 0; i < burstSize; i++) {
        promises.push(
          trackLowStock({
            itemId: `item-${i}`,
            itemName: `Item ${i}`,
            category: 'Nutrients',
            currentStock: 50,
            minStock: 100,
            unit: 'ml',
          })
        );
      }

      await Promise.all(promises);
      const duration = performance.now() - start;

      // Average time per event should be very low
      const avgTimePerEvent = duration / burstSize;
      expect(avgTimePerEvent).toBeLessThan(5); // <5ms per event
      expect(NoopAnalytics.track).toHaveBeenCalledTimes(burstSize);
    });
  });

  describe('Memory Impact', () => {
    it('should not accumulate memory with repeated tracking', async () => {
      const iterations = 1000;

      // Track memory before
      const memBefore = process.memoryUsage().heapUsed;

      // Track many events
      for (let i = 0; i < iterations; i++) {
        await trackLowStock({
          itemId: `item-${i}`,
          itemName: `Item ${i}`,
          category: 'Nutrients',
          currentStock: 50,
          minStock: 100,
          unit: 'ml',
        });
      }

      // Force GC if available
      if (global.gc) {
        global.gc();
      }

      // Track memory after
      const memAfter = process.memoryUsage().heapUsed;
      const memIncrease = memAfter - memBefore;
      const memIncreaseKB = memIncrease / 1024;

      // Should not leak significant memory (<100KB for 1000 events)
      expect(memIncreaseKB).toBeLessThan(100);
    });
  });

  describe('Error Handling Performance', () => {
    it('should handle analytics failures without blocking operations', async () => {
      (NoopAnalytics.track as jest.Mock).mockRejectedValueOnce(
        new Error('Analytics unavailable')
      );

      const start = performance.now();
      await trackLowStock({
        itemId: 'item-1',
        itemName: 'Item 1',
        category: 'Nutrients',
        currentStock: 50,
        minStock: 100,
        unit: 'ml',
      });
      const duration = performance.now() - start;

      // Should complete quickly even with error (<10ms)
      expect(duration).toBeLessThan(10);
    });
  });
});
