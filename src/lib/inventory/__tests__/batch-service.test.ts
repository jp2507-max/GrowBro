/**
 * Batch Service Tests
 *
 * Tests for batch CRUD operations, FEFO ordering, and validation.
 *
 * Requirements tested:
 * - 2.1: Create batches with lot number, expiration, quantity, cost
 * - 2.2: FEFO ordering (earliest expiry first)
 */

import { database } from '@/lib/watermelon';
import type { InventoryItemModel } from '@/lib/watermelon-models/inventory-item';
import type { InventoryMovementModel } from '@/lib/watermelon-models/inventory-movement';

import {
  addBatch,
  BATCH_VALIDATION_ERRORS,
  deleteBatch,
  getBatch,
  getBatchesForItem,
  getTotalAvailableQuantity,
  updateBatchQuantity,
} from '../batch-service';

describe('BatchService', () => {
  let testItemId: string;

  beforeEach(async () => {
    // Create test item
    const itemCollection = database.get<InventoryItemModel>('inventory_items');
    const item = await database.write(() =>
      itemCollection.create((record) => {
        record.name = 'Test Item';
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

  describe('addBatch', () => {
    test('creates batch with valid data', async () => {
      const result = await addBatch({
        itemId: testItemId,
        lotNumber: 'LOT-001',
        quantity: 100,
        costPerUnitMinor: 1500, // $15.00
        expiresOn: new Date('2025-12-31'),
        receivedAt: new Date('2025-01-01'),
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.lotNumber).toBe('LOT-001');
      expect(result.data?.quantity).toBe(100);
      expect(result.data?.costPerUnitMinor).toBe(1500);
    });

    test('creates batch without expiration date', async () => {
      const result = await addBatch({
        itemId: testItemId,
        lotNumber: 'LOT-002',
        quantity: 50,
        costPerUnitMinor: 1000,
      });

      expect(result.success).toBe(true);
      expect(result.data?.expiresOn).toBeUndefined();
    });

    test('fails with missing required fields', async () => {
      const result = await addBatch({
        itemId: '',
        lotNumber: '',
        quantity: -1,
        costPerUnitMinor: -100,
      });

      expect(result.success).toBe(false);
      expect(result.validationErrors).toBeDefined();
      expect(result.validationErrors?.length).toBeGreaterThan(0);
    });

    test('fails with non-integer cost', async () => {
      const result = await addBatch({
        itemId: testItemId,
        lotNumber: 'LOT-003',
        quantity: 10,
        costPerUnitMinor: 15.5, // Should be integer
      });

      expect(result.success).toBe(false);
      expect(result.validationErrors?.[0]?.field).toBe('costPerUnitMinor');
      expect(result.validationErrors?.[0]?.message).toBe(
        BATCH_VALIDATION_ERRORS.INVALID_COST
      );
    });

    test('fails with duplicate lot number for same item', async () => {
      await addBatch({
        itemId: testItemId,
        lotNumber: 'LOT-DUP',
        quantity: 10,
        costPerUnitMinor: 1000,
      });

      const result = await addBatch({
        itemId: testItemId,
        lotNumber: 'LOT-DUP',
        quantity: 20,
        costPerUnitMinor: 1000,
      });

      expect(result.success).toBe(false);
      expect(result.validationErrors?.[0]?.message).toBe(
        BATCH_VALIDATION_ERRORS.DUPLICATE_LOT
      );
    });

    test('sets receivedAt to current time if not provided', async () => {
      const before = new Date();
      const result = await addBatch({
        itemId: testItemId,
        lotNumber: 'LOT-TIME',
        quantity: 10,
        costPerUnitMinor: 1000,
      });
      const after = new Date();

      expect(result.success).toBe(true);
      expect(result.data?.receivedAt).toBeDefined();
      expect(result.data!.receivedAt.getTime()).toBeGreaterThanOrEqual(
        before.getTime()
      );
      expect(result.data!.receivedAt.getTime()).toBeLessThanOrEqual(
        after.getTime()
      );
    });
  });

  describe('getBatchesForItem - FEFO Ordering', () => {
    test('returns batches sorted by expiration date (FEFO)', async () => {
      // Create batches with different expiration dates in the future
      await addBatch({
        itemId: testItemId,
        lotNumber: 'LOT-LATE',
        quantity: 10,
        costPerUnitMinor: 1000,
        expiresOn: new Date('2026-12-31'),
      });

      await addBatch({
        itemId: testItemId,
        lotNumber: 'LOT-EARLY',
        quantity: 20,
        costPerUnitMinor: 1000,
        expiresOn: new Date('2026-06-30'),
      });

      await addBatch({
        itemId: testItemId,
        lotNumber: 'LOT-MID',
        quantity: 15,
        costPerUnitMinor: 1000,
        expiresOn: new Date('2026-09-30'),
      });

      const batches = await getBatchesForItem(testItemId);

      expect(batches).toHaveLength(3);
      expect(batches[0].lotNumber).toBe('LOT-EARLY'); // Expires first
      expect(batches[1].lotNumber).toBe('LOT-MID');
      expect(batches[2].lotNumber).toBe('LOT-LATE');
    });

    test('places batches without expiry at the end', async () => {
      await addBatch({
        itemId: testItemId,
        lotNumber: 'LOT-EXPIRES',
        quantity: 10,
        costPerUnitMinor: 1000,
        expiresOn: new Date('2026-06-30'),
      });

      await addBatch({
        itemId: testItemId,
        lotNumber: 'LOT-NO-EXPIRY',
        quantity: 20,
        costPerUnitMinor: 1000,
        // No expiration
      });

      const batches = await getBatchesForItem(testItemId);

      expect(batches).toHaveLength(2);
      expect(batches[0].lotNumber).toBe('LOT-EXPIRES');
      expect(batches[1].lotNumber).toBe('LOT-NO-EXPIRY');
    });

    test('excludes expired batches by default', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      await addBatch({
        itemId: testItemId,
        lotNumber: 'LOT-EXPIRED',
        quantity: 10,
        costPerUnitMinor: 1000,
        expiresOn: yesterday,
      });

      await addBatch({
        itemId: testItemId,
        lotNumber: 'LOT-VALID',
        quantity: 20,
        costPerUnitMinor: 1000,
        expiresOn: new Date('2025-12-31'),
      });

      const batches = await getBatchesForItem(testItemId, false);

      expect(batches).toHaveLength(1);
      expect(batches[0].lotNumber).toBe('LOT-VALID');
    });

    test('includes expired batches when requested', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      await addBatch({
        itemId: testItemId,
        lotNumber: 'LOT-EXPIRED',
        quantity: 10,
        costPerUnitMinor: 1000,
        expiresOn: yesterday,
      });

      const batches = await getBatchesForItem(testItemId, true);

      expect(batches).toHaveLength(1);
      expect(batches[0].lotNumber).toBe('LOT-EXPIRED');
    });

    test('excludes batches with zero quantity', async () => {
      const batch1Result = await addBatch({
        itemId: testItemId,
        lotNumber: 'LOT-EMPTY',
        quantity: 10,
        costPerUnitMinor: 1000,
      });

      await addBatch({
        itemId: testItemId,
        lotNumber: 'LOT-FULL',
        quantity: 20,
        costPerUnitMinor: 1000,
      });

      // Set first batch to zero quantity
      await updateBatchQuantity(batch1Result.data!.id, {
        quantity: 0,
        reason: 'All consumed',
      });

      const batches = await getBatchesForItem(testItemId);

      expect(batches).toHaveLength(1);
      expect(batches[0].lotNumber).toBe('LOT-FULL');
    });
  });

  describe('getBatch', () => {
    test('retrieves batch by ID', async () => {
      const created = await addBatch({
        itemId: testItemId,
        lotNumber: 'LOT-GET',
        quantity: 10,
        costPerUnitMinor: 1000,
      });

      const batch = await getBatch(created.data!.id);

      expect(batch).not.toBeNull();
      expect(batch?.lotNumber).toBe('LOT-GET');
    });

    test('returns null for deleted batch', async () => {
      const created = await addBatch({
        itemId: testItemId,
        lotNumber: 'LOT-DEL',
        quantity: 10,
        costPerUnitMinor: 1000,
      });

      await deleteBatch(created.data!.id);
      const batch = await getBatch(created.data!.id);

      expect(batch).toBeNull();
    });
  });

  describe('updateBatchQuantity', () => {
    test('updates quantity with reason', async () => {
      const created = await addBatch({
        itemId: testItemId,
        lotNumber: 'LOT-UPD',
        quantity: 100,
        costPerUnitMinor: 1000,
      });

      const result = await updateBatchQuantity(created.data!.id, {
        quantity: 75,
        reason: 'Manual adjustment',
      });

      expect(result.success).toBe(true);
      expect(result.data?.quantity).toBe(75);
    });

    test('fails without reason', async () => {
      const created = await addBatch({
        itemId: testItemId,
        lotNumber: 'LOT-NOREASON',
        quantity: 100,
        costPerUnitMinor: 1000,
      });

      const result = await updateBatchQuantity(created.data!.id, {
        quantity: 50,
        reason: '',
      });

      expect(result.success).toBe(false);
      expect(result.validationErrors?.[0]?.message).toBe(
        BATCH_VALIDATION_ERRORS.REASON_REQUIRED
      );
    });

    test('fails with negative quantity', async () => {
      const created = await addBatch({
        itemId: testItemId,
        lotNumber: 'LOT-NEG',
        quantity: 100,
        costPerUnitMinor: 1000,
      });

      const result = await updateBatchQuantity(created.data!.id, {
        quantity: -10,
        reason: 'Test',
      });

      expect(result.success).toBe(false);
    });

    test('creates movement record for quantity adjustment', async () => {
      const created = await addBatch({
        itemId: testItemId,
        lotNumber: 'LOT-MOVEMENT',
        quantity: 100,
        costPerUnitMinor: 1000,
      });

      const result = await updateBatchQuantity(created.data!.id, {
        quantity: 75,
        reason: 'Manual adjustment for testing',
      });

      expect(result.success).toBe(true);
      expect(result.data?.quantity).toBe(75);

      // Verify movement record was created
      const movementCollection = database.get<InventoryMovementModel>(
        'inventory_movements'
      );
      const movements = await movementCollection.query().fetch();

      const adjustmentMovement = movements.find(
        (m) => m.batchId === created.data!.id && m.type === 'adjustment'
      );

      expect(adjustmentMovement).toBeDefined();
      expect(adjustmentMovement?.quantityDelta).toBe(-25); // 75 - 100 = -25
      expect(adjustmentMovement?.reason).toBe('Manual adjustment for testing');
      expect(adjustmentMovement?.itemId).toBe(testItemId);
    });
  });

  describe('getTotalAvailableQuantity', () => {
    test('sums quantities across all batches', async () => {
      await addBatch({
        itemId: testItemId,
        lotNumber: 'LOT-A',
        quantity: 50,
        costPerUnitMinor: 1000,
      });

      await addBatch({
        itemId: testItemId,
        lotNumber: 'LOT-B',
        quantity: 30,
        costPerUnitMinor: 1000,
      });

      await addBatch({
        itemId: testItemId,
        lotNumber: 'LOT-C',
        quantity: 20,
        costPerUnitMinor: 1000,
      });

      const total = await getTotalAvailableQuantity(testItemId);

      expect(total).toBe(100);
    });

    test('excludes expired batches by default', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      await addBatch({
        itemId: testItemId,
        lotNumber: 'LOT-VALID',
        quantity: 50,
        costPerUnitMinor: 1000,
      });

      await addBatch({
        itemId: testItemId,
        lotNumber: 'LOT-EXPIRED',
        quantity: 30,
        costPerUnitMinor: 1000,
        expiresOn: yesterday,
      });

      const total = await getTotalAvailableQuantity(testItemId, false);

      expect(total).toBe(50);
    });
  });

  describe('deleteBatch', () => {
    test('soft deletes batch', async () => {
      const created = await addBatch({
        itemId: testItemId,
        lotNumber: 'LOT-DEL',
        quantity: 10,
        costPerUnitMinor: 1000,
      });

      const result = await deleteBatch(created.data!.id);

      expect(result.success).toBe(true);

      const batch = await getBatch(created.data!.id);
      expect(batch).toBeNull();
    });
  });
});
