/**
 * Batch Picking Service Tests
 *
 * Tests for FEFO/FIFO policies, expired batch handling, and cost calculations.
 *
 * Requirements tested:
 * - 2.2: FEFO ordering for availability
 * - 2.3: FEFO for picking, FIFO for costing
 * - 2.6: Expired batch exclusion with override
 */

// Mock SQLiteAdapter to use LokiJSAdapter for Node.js tests
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';

import { database } from '@/lib/watermelon';
import type { InventoryItemModel } from '@/lib/watermelon-models/inventory-item';

import {
  calculateCostOfGoods,
  getAvailableBatches,
  getBatchExpiryWarning,
  pickQuantity,
  validatePick,
} from '../batch-picking-service';
import { addBatch } from '../batch-service';

jest.mock('@nozbe/watermelondb/adapters/sqlite', () => {
  const LokiJSAdapterMock = LokiJSAdapter;

  // Return a class that wraps LokiJSAdapter
  return class MockSQLiteAdapter extends LokiJSAdapterMock {
    constructor(options: any) {
      // Map SQLiteAdapter options to LokiJSAdapter options
      const lokiOptions = {
        schema: options.schema,
        // Skip migrations for in-memory testing to avoid validation issues
        // migrations: options.migrations,
        onSetUpError: options.onSetUpError,
        // Disable web workers for Node.js tests
        useWebWorker: false,
        // Disable IndexedDB for Node.js tests
        useIncrementalIndexedDB: false,
      };
      super(lokiOptions);
    }
  };
});

describe('BatchPickingService', () => {
  let testItemId: string;

  beforeEach(async () => {
    // Create test item
    const itemCollection = database.get<InventoryItemModel>('inventory_items');
    const item = await database.write(() =>
      itemCollection.create((record) => {
        record.name = 'Test Nutrient';
        record.category = 'Nutrients';
        record.unitOfMeasure = 'L';
        record.trackingMode = 'batched';
        record.isConsumable = true;
        record.minStock = 10;
        record.reorderMultiple = 5;
      })
    );
    testItemId = item.id;
  });

  describe('getAvailableBatches', () => {
    test('returns batches with status information', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      await addBatch({
        itemId: testItemId,
        lotNumber: 'LOT-001',
        quantity: 100,
        costPerUnitMinor: 1500,
        expiresOn: tomorrow,
      });

      const batches = await getAvailableBatches(testItemId);

      expect(batches).toHaveLength(1);
      expect(batches[0].isExpired).toBe(false);
      expect(batches[0].daysToExpiry).toBeDefined();
      expect(batches[0].isExcludedFromPicking).toBe(false);
    });

    test('marks expired batches correctly', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      await addBatch({
        itemId: testItemId,
        lotNumber: 'LOT-EXPIRED',
        quantity: 50,
        costPerUnitMinor: 1000,
        expiresOn: yesterday,
      });

      const batches = await getAvailableBatches(testItemId, {
        includeExpired: true,
      });

      expect(batches).toHaveLength(1);
      expect(batches[0].isExpired).toBe(true);
      expect(batches[0].isExcludedFromPicking).toBe(true);
      expect(batches[0].daysToExpiry).toBeLessThan(0);
    });

    test('filters by minimum shelf days', async () => {
      const soon = new Date();
      soon.setDate(soon.getDate() + 5);

      const later = new Date();
      later.setDate(later.getDate() + 20);

      await addBatch({
        itemId: testItemId,
        lotNumber: 'LOT-SOON',
        quantity: 10,
        costPerUnitMinor: 1000,
        expiresOn: soon,
      });

      await addBatch({
        itemId: testItemId,
        lotNumber: 'LOT-LATER',
        quantity: 20,
        costPerUnitMinor: 1000,
        expiresOn: later,
      });

      const batches = await getAvailableBatches(testItemId, {
        minShelfDays: 10,
      });

      expect(batches).toHaveLength(1);
      expect(batches[0].lotNumber).toBe('LOT-LATER');
    });

    test('includes batches without expiry when filtering by shelf life', async () => {
      await addBatch({
        itemId: testItemId,
        lotNumber: 'LOT-NO-EXPIRY',
        quantity: 100,
        costPerUnitMinor: 1000,
        // No expiration
      });

      const batches = await getAvailableBatches(testItemId, {
        minShelfDays: 365,
      });

      expect(batches).toHaveLength(1);
      expect(batches[0].lotNumber).toBe('LOT-NO-EXPIRY');
    });
  });

  describe('pickQuantity - FEFO Policy', () => {
    test('picks from batch expiring soonest first', async () => {
      const early = new Date();
      early.setDate(early.getDate() + 10);

      const late = new Date();
      late.setDate(late.getDate() + 30);

      await addBatch({
        itemId: testItemId,
        lotNumber: 'LOT-EARLY',
        quantity: 50,
        costPerUnitMinor: 1000,
        expiresOn: early,
      });

      await addBatch({
        itemId: testItemId,
        lotNumber: 'LOT-LATE',
        quantity: 50,
        costPerUnitMinor: 1200,
        expiresOn: late,
      });

      const result = await pickQuantity(testItemId, 30);

      expect(result.success).toBe(true);
      expect(result.quantityPicked).toBe(30);
      expect(result.allocations).toHaveLength(1);
      expect(result.allocations[0].lotNumber).toBe('LOT-EARLY');
      expect(result.allocations[0].costPerUnitMinor).toBe(1000);
    });

    test('splits across multiple batches (FEFO order)', async () => {
      const early = new Date();
      early.setDate(early.getDate() + 5);

      const mid = new Date();
      mid.setDate(mid.getDate() + 15);

      const late = new Date();
      late.setDate(late.getDate() + 30);

      await addBatch({
        itemId: testItemId,
        lotNumber: 'LOT-EARLY',
        quantity: 20,
        costPerUnitMinor: 1000,
        expiresOn: early,
      });

      await addBatch({
        itemId: testItemId,
        lotNumber: 'LOT-MID',
        quantity: 30,
        costPerUnitMinor: 1100,
        expiresOn: mid,
      });

      await addBatch({
        itemId: testItemId,
        lotNumber: 'LOT-LATE',
        quantity: 50,
        costPerUnitMinor: 1200,
        expiresOn: late,
      });

      // Pick 70 units (20 from early + 30 from mid + 20 from late)
      const result = await pickQuantity(testItemId, 70);

      expect(result.success).toBe(true);
      expect(result.quantityPicked).toBe(70);
      expect(result.allocations).toHaveLength(3);

      // Check FEFO order
      expect(result.allocations[0].lotNumber).toBe('LOT-EARLY');
      expect(result.allocations[0].quantity).toBe(20);
      expect(result.allocations[0].costPerUnitMinor).toBe(1000);

      expect(result.allocations[1].lotNumber).toBe('LOT-MID');
      expect(result.allocations[1].quantity).toBe(30);
      expect(result.allocations[1].costPerUnitMinor).toBe(1100);

      expect(result.allocations[2].lotNumber).toBe('LOT-LATE');
      expect(result.allocations[2].quantity).toBe(20);
      expect(result.allocations[2].costPerUnitMinor).toBe(1200);
    });

    test('handles partial availability (insufficient stock)', async () => {
      await addBatch({
        itemId: testItemId,
        lotNumber: 'LOT-ONLY',
        quantity: 30,
        costPerUnitMinor: 1000,
      });

      const result = await pickQuantity(testItemId, 50);

      expect(result.success).toBe(false);
      expect(result.quantityPicked).toBe(30);
      expect(result.quantityShort).toBe(20);
      expect(result.error).toBe('Insufficient inventory');
      expect(result.allocations).toHaveLength(1);
    });

    test('excludes expired batches by default', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      await addBatch({
        itemId: testItemId,
        lotNumber: 'LOT-EXPIRED',
        quantity: 50,
        costPerUnitMinor: 1000,
        expiresOn: yesterday,
      });

      await addBatch({
        itemId: testItemId,
        lotNumber: 'LOT-VALID',
        quantity: 30,
        costPerUnitMinor: 1000,
        expiresOn: tomorrow,
      });

      const result = await pickQuantity(testItemId, 40);

      expect(result.success).toBe(false);
      expect(result.quantityPicked).toBe(30); // Only from valid batch
      expect(result.allocations).toHaveLength(1);
      expect(result.allocations[0].lotNumber).toBe('LOT-VALID');
    });

    test('allows picking from expired batches with override and reason', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      await addBatch({
        itemId: testItemId,
        lotNumber: 'LOT-EXPIRED',
        quantity: 50,
        costPerUnitMinor: 1000,
        expiresOn: yesterday,
      });

      const result = await pickQuantity(testItemId, 30, {
        allowExpiredOverride: true,
        expiredOverrideReason: 'Emergency use approved by supervisor',
      });

      expect(result.success).toBe(true);
      expect(result.quantityPicked).toBe(30);
      expect(result.allocations[0].lotNumber).toBe('LOT-EXPIRED');
    });

    test('requires reason for expired override', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      await addBatch({
        itemId: testItemId,
        lotNumber: 'LOT-EXPIRED',
        quantity: 50,
        costPerUnitMinor: 1000,
        expiresOn: yesterday,
      });

      const result = await pickQuantity(testItemId, 30, {
        allowExpiredOverride: true,
        // Missing expiredOverrideReason
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        'Reason required when allowing expired override'
      );
    });

    test('handles batches with no expiry date', async () => {
      await addBatch({
        itemId: testItemId,
        lotNumber: 'LOT-NO-EXPIRY-1',
        quantity: 50,
        costPerUnitMinor: 1000,
      });

      await addBatch({
        itemId: testItemId,
        lotNumber: 'LOT-NO-EXPIRY-2',
        quantity: 30,
        costPerUnitMinor: 1100,
      });

      const result = await pickQuantity(testItemId, 60);

      expect(result.success).toBe(true);
      expect(result.quantityPicked).toBe(60);
      expect(result.allocations).toHaveLength(2);
    });

    test('handles multiple batches with same expiry date', async () => {
      const sameDate = new Date('2025-12-31');

      await addBatch({
        itemId: testItemId,
        lotNumber: 'LOT-A',
        quantity: 20,
        costPerUnitMinor: 1000,
        expiresOn: sameDate,
      });

      await addBatch({
        itemId: testItemId,
        lotNumber: 'LOT-B',
        quantity: 30,
        costPerUnitMinor: 1100,
        expiresOn: sameDate,
      });

      const result = await pickQuantity(testItemId, 40);

      expect(result.success).toBe(true);
      expect(result.quantityPicked).toBe(40);
      expect(result.allocations).toHaveLength(2);
    });

    test('fails with zero quantity', async () => {
      const result = await pickQuantity(testItemId, 0);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Quantity must be positive');
    });

    test('fails with no available batches', async () => {
      const result = await pickQuantity(testItemId, 10);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No available batches');
    });
  });

  describe('pickQuantity - FIFO Costing', () => {
    test('uses cost from batch at time of picking', async () => {
      const early = new Date();
      early.setDate(early.getDate() + 10);

      await addBatch({
        itemId: testItemId,
        lotNumber: 'LOT-CHEAP',
        quantity: 50,
        costPerUnitMinor: 1000, // $10.00
        expiresOn: early,
      });

      await addBatch({
        itemId: testItemId,
        lotNumber: 'LOT-EXPENSIVE',
        quantity: 50,
        costPerUnitMinor: 1500, // $15.00
        expiresOn: early,
      });

      const result = await pickQuantity(testItemId, 70);

      // Should pick 50 from LOT-CHEAP + 20 from LOT-EXPENSIVE
      expect(result.success).toBe(true);
      expect(result.totalCostMinor).toBe(50 * 1000 + 20 * 1500); // 50000 + 30000 = 80000
      expect(result.averageCostPerUnitMinor).toBe(Math.round(80000 / 70)); // ~1143
    });

    test('maintains cost integrity across split batches', async () => {
      const early = new Date();
      early.setDate(early.getDate() + 5);

      const late = new Date();
      late.setDate(late.getDate() + 20);

      await addBatch({
        itemId: testItemId,
        lotNumber: 'LOT-A',
        quantity: 30,
        costPerUnitMinor: 1000,
        expiresOn: early,
      });

      await addBatch({
        itemId: testItemId,
        lotNumber: 'LOT-B',
        quantity: 40,
        costPerUnitMinor: 1200,
        expiresOn: late,
      });

      const result = await pickQuantity(testItemId, 50);

      // Pick 30 @ 1000 + 20 @ 1200 = 30000 + 24000 = 54000
      expect(result.totalCostMinor).toBe(54000);
      expect(result.allocations[0].totalCostMinor).toBe(30000);
      expect(result.allocations[1].totalCostMinor).toBe(24000);
    });
  });

  describe('calculateCostOfGoods', () => {
    test('calculates total cost from allocations', async () => {
      const allocations = [
        {
          batchId: '1',
          lotNumber: 'LOT-A',
          quantity: 30,
          costPerUnitMinor: 1000,
          totalCostMinor: 30000,
        },
        {
          batchId: '2',
          lotNumber: 'LOT-B',
          quantity: 20,
          costPerUnitMinor: 1200,
          totalCostMinor: 24000,
        },
      ];

      const analysis = calculateCostOfGoods(allocations);

      expect(analysis.totalCostMinor).toBe(54000);
      expect(analysis.averageCostPerUnitMinor).toBe(Math.round(54000 / 50)); // 1080
      expect(analysis.movementCount).toBe(2);
      expect(analysis.totalQuantity).toBe(50);
    });

    test('handles empty allocations', async () => {
      const analysis = calculateCostOfGoods([]);

      expect(analysis.totalCostMinor).toBe(0);
      expect(analysis.averageCostPerUnitMinor).toBe(0);
      expect(analysis.movementCount).toBe(0);
      expect(analysis.totalQuantity).toBe(0);
    });
  });

  describe('validatePick', () => {
    test('validates successful pick', async () => {
      await addBatch({
        itemId: testItemId,
        lotNumber: 'LOT-001',
        quantity: 50,
        costPerUnitMinor: 1000,
      });

      const batches = await getAvailableBatches(testItemId);
      const validation = validatePick(batches, 30);

      expect(validation.valid).toBe(true);
    });

    test('fails with zero quantity', async () => {
      await addBatch({
        itemId: testItemId,
        lotNumber: 'LOT-001',
        quantity: 50,
        costPerUnitMinor: 1000,
      });

      const batches = await getAvailableBatches(testItemId);
      const validation = validatePick(batches, 0);

      expect(validation.valid).toBe(false);
      expect(validation.error).toBe('Quantity must be positive');
    });

    test('fails with no batches', async () => {
      const validation = validatePick([], 10);

      expect(validation.valid).toBe(false);
      expect(validation.error).toBe('No available batches');
    });

    test('requires reason for expired override', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      await addBatch({
        itemId: testItemId,
        lotNumber: 'LOT-EXPIRED',
        quantity: 50,
        costPerUnitMinor: 1000,
        expiresOn: yesterday,
      });

      const batches = await getAvailableBatches(testItemId, {
        includeExpired: true,
      });
      const validation = validatePick(batches, 10, {
        allowExpiredOverride: true,
        // Missing reason
      });

      expect(validation.valid).toBe(false);
      expect(validation.error).toBe(
        'Reason required for expired batch override'
      );
    });
  });

  describe('getBatchExpiryWarning', () => {
    test('returns warning for expired batch', async () => {
      const yesterday = new Date('2025-01-15');

      await addBatch({
        itemId: testItemId,
        lotNumber: 'LOT-EXPIRED',
        quantity: 50,
        costPerUnitMinor: 1000,
        expiresOn: yesterday,
      });

      const batches = await getAvailableBatches(testItemId, {
        includeExpired: true,
      });

      const warning = getBatchExpiryWarning(batches[0]);

      expect(warning).toBeDefined();
      expect(warning).toContain('Expired on');
      expect(warning).toContain('Excluded from auto-picking (FEFO)');
      expect(warning).toContain('Override?');
    });

    test('returns undefined for non-expired batch', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      await addBatch({
        itemId: testItemId,
        lotNumber: 'LOT-VALID',
        quantity: 50,
        costPerUnitMinor: 1000,
        expiresOn: tomorrow,
      });

      const batches = await getAvailableBatches(testItemId);
      const warning = getBatchExpiryWarning(batches[0]);

      expect(warning).toBeUndefined();
    });
  });
});
