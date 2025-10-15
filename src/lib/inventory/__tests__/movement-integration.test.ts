/**
 * Integration tests for movement service - exactly-once behavior
 *
 * Tests Requirements:
 * - 3.3: Idempotency-Key for repeat submissions
 * - Transaction atomicity under retries and timeouts
 * - Concurrent movement creation with same external_key
 */

import { database } from '@/lib/watermelon';
import type { InventoryBatchModel } from '@/lib/watermelon-models/inventory-batch';
import type { InventoryItemModel } from '@/lib/watermelon-models/inventory-item';

import {
  createMovement,
  type CreateMovementRequest,
  createMovementWithBatchUpdate,
  getMovementByExternalKey,
  getMovementsForItem,
} from '../movement-service';

describe('Movement Service Integration - Exactly-Once Behavior', () => {
  let testItem: InventoryItemModel;
  let testBatch: InventoryBatchModel;

  beforeEach(async () => {
    // Create test item
    const itemCollection = database.get<InventoryItemModel>('inventory_items');
    testItem = await database.write(async () =>
      itemCollection.create((item) => {
        item.name = 'Test Item';
        item.category = 'Nutrients';
        item.unitOfMeasure = 'ml';
        item.trackingMode = 'batched';
        item.isConsumable = true;
        item.minStock = 100;
        item.reorderMultiple = 500;
      })
    );

    // Create test batch
    const batchCollection =
      database.get<InventoryBatchModel>('inventory_batches');
    testBatch = await database.write(async () =>
      batchCollection.create((batch) => {
        batch.itemId = testItem.id;
        batch.lotNumber = 'LOT-TEST';
        batch.quantity = 1000;
        batch.costPerUnitMinor = 50;
        batch.receivedAt = new Date();
      })
    );
  });

  describe('Idempotency with external_key', () => {
    it('should return same movement on retry with same external_key', async () => {
      const externalKey = `retry-test-${Date.now()}`;
      const request: CreateMovementRequest = {
        itemId: testItem.id,
        type: 'consumption',
        quantityDelta: -100,
        costPerUnitMinor: 50,
        reason: 'Test consumption',
        externalKey,
      };

      // First attempt
      const result1 = await createMovement(request);
      expect(result1.success).toBe(true);
      expect(result1.isIdempotentDuplicate).toBe(false);
      const movementId1 = result1.movement?.id;

      // Retry with same external_key
      const result2 = await createMovement(request);
      expect(result2.success).toBe(true);
      expect(result2.isIdempotentDuplicate).toBe(true);
      expect(result2.movement?.id).toBe(movementId1);

      // Third retry
      const result3 = await createMovement(request);
      expect(result3.success).toBe(true);
      expect(result3.isIdempotentDuplicate).toBe(true);
      expect(result3.movement?.id).toBe(movementId1);

      // Verify only one movement was created
      const movements = await getMovementsForItem(testItem.id);
      expect(movements).toHaveLength(1);
      expect(movements[0].id).toBe(movementId1);
    });

    it('should handle batch updates idempotently', async () => {
      const externalKey = `batch-retry-${Date.now()}`;
      const initialQuantity = testBatch.quantity;

      const request: CreateMovementRequest = {
        itemId: testItem.id,
        batchId: testBatch.id,
        type: 'consumption',
        quantityDelta: -150,
        costPerUnitMinor: 50,
        reason: 'Batch consumption',
        externalKey,
      };

      // First attempt - should update batch
      const result1 = await createMovementWithBatchUpdate(request);
      expect(result1.success).toBe(true);
      expect(result1.isIdempotentDuplicate).toBe(false);

      const batchAfterFirst = await database
        .get<InventoryBatchModel>('inventory_batches')
        .find(testBatch.id);
      const quantityAfterFirst = batchAfterFirst.quantity;
      expect(quantityAfterFirst).toBe(initialQuantity - 150);

      // Retry - should NOT update batch again
      const result2 = await createMovementWithBatchUpdate(request);
      expect(result2.success).toBe(true);
      expect(result2.isIdempotentDuplicate).toBe(true);
      expect(result2.movement?.id).toBe(result1.movement?.id);

      const batchAfterSecond = await database
        .get<InventoryBatchModel>('inventory_batches')
        .find(testBatch.id);
      expect(batchAfterSecond.quantity).toBe(quantityAfterFirst); // No change

      // Third retry - still no change
      const result3 = await createMovementWithBatchUpdate(request);
      expect(result3.success).toBe(true);
      expect(result3.isIdempotentDuplicate).toBe(true);

      const batchAfterThird = await database
        .get<InventoryBatchModel>('inventory_batches')
        .find(testBatch.id);
      expect(batchAfterThird.quantity).toBe(quantityAfterFirst);
    });

    it('should handle different requests with unique external_keys', async () => {
      const externalKey1 = `unique-1-${Date.now()}`;
      const externalKey2 = `unique-2-${Date.now()}`;

      const request1: CreateMovementRequest = {
        itemId: testItem.id,
        type: 'consumption',
        quantityDelta: -50,
        costPerUnitMinor: 50,
        reason: 'First consumption',
        externalKey: externalKey1,
      };

      const request2: CreateMovementRequest = {
        itemId: testItem.id,
        type: 'consumption',
        quantityDelta: -75,
        costPerUnitMinor: 50,
        reason: 'Second consumption',
        externalKey: externalKey2,
      };

      const result1 = await createMovement(request1);
      const result2 = await createMovement(request2);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.movement?.id).not.toBe(result2.movement?.id);

      const movements = await getMovementsForItem(testItem.id);
      expect(movements).toHaveLength(2);
    });
  });

  describe('Concurrent operations with same external_key', () => {
    it('should handle concurrent creation attempts', async () => {
      const externalKey = `concurrent-${Date.now()}`;
      const request: CreateMovementRequest = {
        itemId: testItem.id,
        type: 'consumption',
        quantityDelta: -100,
        costPerUnitMinor: 50,
        reason: 'Concurrent test',
        externalKey,
      };

      // Simulate concurrent attempts
      const promises = [
        createMovement(request),
        createMovement(request),
        createMovement(request),
      ];

      const results = await Promise.all(promises);

      // All should succeed
      results.forEach((result) => {
        expect(result.success).toBe(true);
      });

      // At least one should be original, others should be duplicates
      const duplicateCount = results.filter(
        (r) => r.isIdempotentDuplicate
      ).length;
      expect(duplicateCount).toBeGreaterThan(0);

      // All should return same movement ID
      const movementIds = results.map((r) => r.movement?.id);
      const uniqueIds = new Set(movementIds);
      expect(uniqueIds.size).toBe(1);

      // Verify only one movement exists
      const movements = await getMovementsForItem(testItem.id);
      expect(movements).toHaveLength(1);
    });

    it('should handle concurrent batch updates', async () => {
      const externalKey = `concurrent-batch-${Date.now()}`;
      const initialQuantity = testBatch.quantity;

      const request: CreateMovementRequest = {
        itemId: testItem.id,
        batchId: testBatch.id,
        type: 'consumption',
        quantityDelta: -100,
        costPerUnitMinor: 50,
        reason: 'Concurrent batch test',
        externalKey,
      };

      // Simulate concurrent batch updates
      const promises = [
        createMovementWithBatchUpdate(request),
        createMovementWithBatchUpdate(request),
        createMovementWithBatchUpdate(request),
      ];

      const results = await Promise.all(promises);

      // All should succeed
      results.forEach((result) => {
        expect(result.success).toBe(true);
      });

      // Verify batch was only updated once
      const finalBatch = await database
        .get<InventoryBatchModel>('inventory_batches')
        .find(testBatch.id);
      expect(finalBatch.quantity).toBe(initialQuantity - 100);
    });
  });

  describe('Transaction rollback scenarios', () => {
    it('should rollback movement if batch update fails', async () => {
      const request: CreateMovementRequest = {
        itemId: testItem.id,
        batchId: testBatch.id,
        type: 'consumption',
        quantityDelta: -5000, // Exceeds available quantity
        costPerUnitMinor: 50,
        reason: 'Excessive consumption',
      };

      const result = await createMovementWithBatchUpdate(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient batch quantity');

      // Verify no movement was created
      const movements = await getMovementsForItem(testItem.id);
      expect(movements).toHaveLength(0);

      // Verify batch quantity unchanged
      const unchangedBatch = await database
        .get<InventoryBatchModel>('inventory_batches')
        .find(testBatch.id);
      expect(unchangedBatch.quantity).toBe(1000);
    });

    it('should maintain atomicity across multiple movements', async () => {
      const externalKey1 = `atomic-1-${Date.now()}`;
      const externalKey2 = `atomic-2-${Date.now()}`;

      // First movement succeeds
      const result1 = await createMovementWithBatchUpdate({
        itemId: testItem.id,
        batchId: testBatch.id,
        type: 'consumption',
        quantityDelta: -200,
        costPerUnitMinor: 50,
        reason: 'First consumption',
        externalKey: externalKey1,
      });

      expect(result1.success).toBe(true);

      const batchAfterFirst = await database
        .get<InventoryBatchModel>('inventory_batches')
        .find(testBatch.id);
      const quantityAfterFirst = batchAfterFirst.quantity;

      // Second movement fails (insufficient stock)
      const result2 = await createMovementWithBatchUpdate({
        itemId: testItem.id,
        batchId: testBatch.id,
        type: 'consumption',
        quantityDelta: -2000,
        costPerUnitMinor: 50,
        reason: 'Excessive consumption',
        externalKey: externalKey2,
      });

      expect(result2.success).toBe(false);

      // Verify first movement persisted, second did not
      const movements = await getMovementsForItem(testItem.id);
      expect(movements).toHaveLength(1);
      expect(movements[0].externalKey).toBe(externalKey1);

      // Verify batch quantity only reflects first movement
      const batchAfterSecond = await database
        .get<InventoryBatchModel>('inventory_batches')
        .find(testBatch.id);
      expect(batchAfterSecond.quantity).toBe(quantityAfterFirst);
    });
  });

  describe('External key lookup and retrieval', () => {
    it('should retrieve movement by external_key', async () => {
      const externalKey = `lookup-${Date.now()}`;

      await createMovement({
        itemId: testItem.id,
        type: 'consumption',
        quantityDelta: -50,
        costPerUnitMinor: 50,
        reason: 'Test lookup',
        externalKey,
      });

      const retrieved = await getMovementByExternalKey(externalKey);

      expect(retrieved).toBeDefined();
      expect(retrieved?.externalKey).toBe(externalKey);
      expect(retrieved?.itemId).toBe(testItem.id);
      expect(retrieved?.quantityDelta).toBe(-50);
    });

    it('should handle lookup of non-existent external_key', async () => {
      const nonExistent = await getMovementByExternalKey('does-not-exist');

      expect(nonExistent).toBeNull();
    });
  });

  describe('Movement immutability verification', () => {
    it('should not allow movement updates (append-only)', async () => {
      const result = await createMovement({
        itemId: testItem.id,
        type: 'consumption',
        quantityDelta: -100,
        costPerUnitMinor: 50,
        reason: 'Original',
      });

      expect(result.success).toBe(true);
      const movement = result.movement!;

      // Attempt to update should fail (WatermelonDB should not allow this)
      await expect(
        database.write(async () => {
          await movement.update((record) => {
            (record as any).quantityDelta = -200; // Attempt to change
          });
        })
      ).rejects.toThrow();
    });

    it('should require new movement for corrections', async () => {
      // Original movement
      await createMovement({
        itemId: testItem.id,
        type: 'consumption',
        quantityDelta: -100,
        costPerUnitMinor: 50,
        reason: 'Original consumption',
      });

      // Correction: reverse original
      await createMovement({
        itemId: testItem.id,
        type: 'adjustment',
        quantityDelta: 100,
        reason: 'Reverse incorrect consumption',
      });

      // Correction: apply correct value
      await createMovement({
        itemId: testItem.id,
        type: 'consumption',
        quantityDelta: -75,
        costPerUnitMinor: 50,
        reason: 'Correct consumption amount',
      });

      const movements = await getMovementsForItem(testItem.id);
      expect(movements).toHaveLength(3);

      // Net effect: -100 + 100 - 75 = -75
      const netQuantity = movements.reduce(
        (sum, m) => sum + m.quantityDelta,
        0
      );
      expect(netQuantity).toBe(-75);
    });
  });
});
