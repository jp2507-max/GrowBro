/**
 * Unit tests for movement service
 *
 * Tests Requirements:
 * - 1.4: Immutable movement records with atomic transactions
 * - 3.3: Idempotency support with external_key
 * - 10.6: 100% of inventory edits produce movements
 */

import { database } from '@/lib/watermelon';
import type { InventoryBatchModel } from '@/lib/watermelon-models/inventory-batch';
import type { InventoryItemModel } from '@/lib/watermelon-models/inventory-item';
import type { InventoryMovementModel } from '@/lib/watermelon-models/inventory-movement';

import {
  calculateStockFromMovements,
  calculateTotalCostFromMovements,
  createMovement,
  type CreateMovementRequest,
  createMovementWithBatchUpdate,
  getMovementByExternalKey,
  getMovementsForItem,
  getMovementsForTask,
  validateMovement,
} from '../movement-service';

describe('Movement Service', () => {
  let testItem: InventoryItemModel;
  let testBatch: InventoryBatchModel;

  beforeEach(async () => {
    // Create test item
    const itemCollection = database.get<InventoryItemModel>('inventory_items');
    testItem = await database.write(async () =>
      itemCollection.create((item) => {
        item.name = 'Test Nutrient';
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
        batch.lotNumber = 'LOT-001';
        batch.quantity = 1000;
        batch.costPerUnitMinor = 50; // $0.50 per ml
        batch.receivedAt = new Date();
      })
    );
  });

  describe('validateMovement', () => {
    it('should validate receipt movements require positive quantity', () => {
      const request: CreateMovementRequest = {
        itemId: testItem.id,
        type: 'receipt',
        quantityDelta: -10,
        costPerUnitMinor: 50,
        reason: 'Test receipt',
      };

      const result = validateMovement(request);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('quantityDelta');
      expect(result.errors[0].message).toContain('positive');
    });

    it('should validate consumption movements require negative quantity', () => {
      const request: CreateMovementRequest = {
        itemId: testItem.id,
        type: 'consumption',
        quantityDelta: 10,
        costPerUnitMinor: 50,
        reason: 'Test consumption',
      };

      const result = validateMovement(request);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('quantityDelta');
      expect(result.errors[0].message).toContain('negative');
    });

    it('should allow adjustment movements with zero quantity for audit markers', () => {
      const request: CreateMovementRequest = {
        itemId: testItem.id,
        type: 'adjustment',
        quantityDelta: 0,
        reason: 'Skipped deduction marker',
      };

      const result = validateMovement(request);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate cost is required for receipt movements', () => {
      const request: CreateMovementRequest = {
        itemId: testItem.id,
        type: 'receipt',
        quantityDelta: 100,
        reason: 'Test receipt',
      };

      const result = validateMovement(request);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('costPerUnitMinor');
      expect(result.errors[0].message).toContain('required');
    });

    it('should validate cost is required for consumption movements', () => {
      const request: CreateMovementRequest = {
        itemId: testItem.id,
        type: 'consumption',
        quantityDelta: -50,
        reason: 'Test consumption',
      };

      const result = validateMovement(request);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('costPerUnitMinor');
      expect(result.errors[0].message).toContain('required');
    });

    it('should allow adjustments without cost', () => {
      const request: CreateMovementRequest = {
        itemId: testItem.id,
        type: 'adjustment',
        quantityDelta: 10,
        reason: 'Inventory count adjustment',
      };

      const result = validateMovement(request);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate cost cannot be negative', () => {
      const request: CreateMovementRequest = {
        itemId: testItem.id,
        type: 'receipt',
        quantityDelta: 100,
        costPerUnitMinor: -50,
        reason: 'Test receipt',
      };

      const result = validateMovement(request);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'costPerUnitMinor')).toBe(
        true
      );
    });

    it('should validate reason is required', () => {
      const request: CreateMovementRequest = {
        itemId: testItem.id,
        type: 'adjustment',
        quantityDelta: 10,
        reason: '',
      };

      const result = validateMovement(request);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('reason');
      expect(result.errors[0].message).toContain('required');
    });

    it('should pass validation for valid receipt movement', () => {
      const request: CreateMovementRequest = {
        itemId: testItem.id,
        type: 'receipt',
        quantityDelta: 500,
        costPerUnitMinor: 45,
        reason: 'New shipment received',
      };

      const result = validateMovement(request);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('createMovement', () => {
    it('should create a valid receipt movement', async () => {
      const request: CreateMovementRequest = {
        itemId: testItem.id,
        batchId: testBatch.id,
        type: 'receipt',
        quantityDelta: 500,
        costPerUnitMinor: 45,
        reason: 'New shipment',
      };

      const result = await createMovement(request);

      expect(result.success).toBe(true);
      expect(result.movement).toBeDefined();
      expect(result.movement?.itemId).toBe(testItem.id);
      expect(result.movement?.type).toBe('receipt');
      expect(result.movement?.quantityDelta).toBe(500);
      expect(result.movement?.costPerUnitMinor).toBe(45);
      expect(result.isIdempotentDuplicate).toBe(false);
    });

    it('should create a valid consumption movement', async () => {
      const request: CreateMovementRequest = {
        itemId: testItem.id,
        batchId: testBatch.id,
        type: 'consumption',
        quantityDelta: -100,
        costPerUnitMinor: 50,
        reason: 'Used in feeding',
        taskId: 'task-123',
      };

      const result = await createMovement(request);

      expect(result.success).toBe(true);
      expect(result.movement).toBeDefined();
      expect(result.movement?.type).toBe('consumption');
      expect(result.movement?.quantityDelta).toBe(-100);
      expect(result.movement?.taskId).toBe('task-123');
    });

    it('should return existing movement on duplicate external_key', async () => {
      const externalKey = 'test-key-001';

      // Create first movement
      const request: CreateMovementRequest = {
        itemId: testItem.id,
        type: 'consumption',
        quantityDelta: -50,
        costPerUnitMinor: 50,
        reason: 'Test consumption',
        externalKey,
      };

      const result1 = await createMovement(request);
      expect(result1.success).toBe(true);
      expect(result1.isIdempotentDuplicate).toBe(false);

      // Attempt to create duplicate
      const result2 = await createMovement(request);
      expect(result2.success).toBe(true);
      expect(result2.isIdempotentDuplicate).toBe(true);
      expect(result2.movement?.id).toBe(result1.movement?.id);
    });

    it('should fail validation for invalid movement', async () => {
      const request: CreateMovementRequest = {
        itemId: testItem.id,
        type: 'receipt',
        quantityDelta: -100, // Invalid: receipt must be positive
        costPerUnitMinor: 50,
        reason: 'Test',
      };

      const result = await createMovement(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('validation failed');
      expect(result.validationErrors).toBeDefined();
      expect(result.validationErrors!.length).toBeGreaterThan(0);
    });
  });

  describe('createMovementWithBatchUpdate', () => {
    it('should atomically create movement and update batch quantity', async () => {
      const initialQuantity = testBatch.quantity;

      const request: CreateMovementRequest = {
        itemId: testItem.id,
        batchId: testBatch.id,
        type: 'consumption',
        quantityDelta: -200,
        costPerUnitMinor: 50,
        reason: 'Consumed in task',
      };

      const result = await createMovementWithBatchUpdate(request);

      expect(result.success).toBe(true);
      expect(result.movement).toBeDefined();

      // Verify batch quantity was updated
      const updatedBatch = await database
        .get<InventoryBatchModel>('inventory_batches')
        .find(testBatch.id);
      expect(updatedBatch.quantity).toBe(initialQuantity - 200);
    });

    it('should fail if batch quantity would go negative', async () => {
      const request: CreateMovementRequest = {
        itemId: testItem.id,
        batchId: testBatch.id,
        type: 'consumption',
        quantityDelta: -2000, // More than available
        costPerUnitMinor: 50,
        reason: 'Overconsumption',
      };

      const result = await createMovementWithBatchUpdate(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient batch quantity');

      // Verify batch quantity was not changed
      const unchangedBatch = await database
        .get<InventoryBatchModel>('inventory_batches')
        .find(testBatch.id);
      expect(unchangedBatch.quantity).toBe(1000); // Original quantity
    });

    it('should handle idempotency with batch updates', async () => {
      const externalKey = 'batch-update-001';
      const initialQuantity = testBatch.quantity;

      const request: CreateMovementRequest = {
        itemId: testItem.id,
        batchId: testBatch.id,
        type: 'consumption',
        quantityDelta: -100,
        costPerUnitMinor: 50,
        reason: 'Test',
        externalKey,
      };

      // First call
      const result1 = await createMovementWithBatchUpdate(request);
      expect(result1.success).toBe(true);
      expect(result1.isIdempotentDuplicate).toBe(false);

      const batchAfterFirst = await database
        .get<InventoryBatchModel>('inventory_batches')
        .find(testBatch.id);
      const quantityAfterFirst = batchAfterFirst.quantity;
      expect(quantityAfterFirst).toBe(initialQuantity - 100);

      // Second call with same external_key
      const result2 = await createMovementWithBatchUpdate(request);
      expect(result2.success).toBe(true);
      expect(result2.isIdempotentDuplicate).toBe(true);
      expect(result2.movement?.id).toBe(result1.movement?.id);

      // Verify batch quantity was NOT updated again
      const batchAfterSecond = await database
        .get<InventoryBatchModel>('inventory_batches')
        .find(testBatch.id);
      expect(batchAfterSecond.quantity).toBe(quantityAfterFirst);
    });

    it('should handle UNIQUE constraint violation gracefully', async () => {
      const externalKey = 'unique-violation-test';
      const initialQuantity = testBatch.quantity;

      const request: CreateMovementRequest = {
        itemId: testItem.id,
        batchId: testBatch.id,
        type: 'consumption',
        quantityDelta: -50,
        costPerUnitMinor: 50,
        reason: 'UNIQUE violation test',
        externalKey,
      };

      // First, create a movement manually to simulate a "winning" concurrent call
      const movementCollection = database.get<InventoryMovementModel>(
        'inventory_movements'
      );
      await database.write(async () => {
        // Update batch first
        const batch = await database
          .get<InventoryBatchModel>('inventory_batches')
          .find(testBatch.id);
        await batch.update((record) => {
          record.quantity = record.quantity + request.quantityDelta;
        });

        // Create movement
        await movementCollection.create((record) => {
          record.itemId = request.itemId;
          record.batchId = request.batchId;
          record.type = request.type;
          record.quantityDelta = request.quantityDelta;
          record.costPerUnitMinor = request.costPerUnitMinor;
          record.reason = request.reason;
          record.externalKey = request.externalKey;
        });
      });

      // Verify the movement was created and batch updated
      const batchAfterSetup = await database
        .get<InventoryBatchModel>('inventory_batches')
        .find(testBatch.id);
      expect(batchAfterSetup.quantity).toBe(initialQuantity - 50);

      // Now simulate the "losing" concurrent call that hits UNIQUE constraint
      // Mock the create method to throw UNIQUE constraint error
      const originalCreate = movementCollection.create;
      movementCollection.create = jest.fn().mockImplementation(async () => {
        throw new Error(
          'UNIQUE constraint failed: inventory_movements.external_key'
        );
      });

      // This call should catch the UNIQUE error and return the existing movement
      const result = await createMovementWithBatchUpdate({
        ...request,
        quantityDelta: -25, // Different delta to show it doesn't get applied
      });

      expect(result.success).toBe(true);
      expect(result.isIdempotentDuplicate).toBe(true);
      expect(result.movement?.externalKey).toBe(externalKey);
      expect(result.movement?.quantityDelta).toBe(-50); // Original movement's delta

      // Batch quantity should remain unchanged (no additional update)
      const batchAfterTest = await database
        .get<InventoryBatchModel>('inventory_batches')
        .find(testBatch.id);
      expect(batchAfterTest.quantity).toBe(initialQuantity - 50);

      // Restore original method
      movementCollection.create = originalCreate;
    });

    it('should fail if batchId is missing', async () => {
      const request: CreateMovementRequest = {
        itemId: testItem.id,
        type: 'consumption',
        quantityDelta: -100,
        costPerUnitMinor: 50,
        reason: 'Test',
      };

      const result = await createMovementWithBatchUpdate(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Batch ID is required');
    });
  });

  describe('getMovementsForItem', () => {
    beforeEach(async () => {
      // Create test movements
      await createMovement({
        itemId: testItem.id,
        type: 'receipt',
        quantityDelta: 500,
        costPerUnitMinor: 45,
        reason: 'Initial stock',
      });

      await createMovement({
        itemId: testItem.id,
        type: 'consumption',
        quantityDelta: -100,
        costPerUnitMinor: 50,
        reason: 'Consumed',
      });

      await createMovement({
        itemId: testItem.id,
        type: 'adjustment',
        quantityDelta: 50,
        reason: 'Count adjustment',
      });
    });

    it('should retrieve all movements for an item', async () => {
      const movements = await getMovementsForItem(testItem.id);

      expect(movements).toHaveLength(3);
      // Should be sorted by created_at desc
      // Debug: log the actual order
      console.log(
        'Movement types in order:',
        movements.map((m) => ({ type: m.type, createdAt: m.createdAt }))
      );
      expect(movements[0].type).toBe('adjustment');
      expect(movements[1].type).toBe('consumption');
      expect(movements[2].type).toBe('receipt');
    });

    it('should filter movements by type', async () => {
      const movements = await getMovementsForItem(testItem.id, {
        type: 'consumption',
      });

      expect(movements).toHaveLength(1);
      expect(movements[0].type).toBe('consumption');
    });

    it('should support pagination', async () => {
      const movements = await getMovementsForItem(testItem.id, {
        limit: 2,
        offset: 0,
      });

      expect(movements.length).toBeLessThanOrEqual(2);
    });
  });

  describe('getMovementsForTask', () => {
    it('should retrieve movements linked to a task', async () => {
      const taskId = 'task-456';

      await createMovement({
        itemId: testItem.id,
        type: 'consumption',
        quantityDelta: -50,
        costPerUnitMinor: 50,
        reason: 'Task consumption',
        taskId,
      });

      await createMovement({
        itemId: testItem.id,
        type: 'consumption',
        quantityDelta: -25,
        costPerUnitMinor: 50,
        reason: 'Task consumption 2',
        taskId,
      });

      const movements = await getMovementsForTask(taskId);

      expect(movements).toHaveLength(2);
      expect(movements.every((m) => m.taskId === taskId)).toBe(true);
    });
  });

  describe('getMovementByExternalKey', () => {
    it('should retrieve movement by external key', async () => {
      const externalKey = 'test-ext-key-001';

      await createMovement({
        itemId: testItem.id,
        type: 'consumption',
        quantityDelta: -50,
        costPerUnitMinor: 50,
        reason: 'Test',
        externalKey,
      });

      const movement = await getMovementByExternalKey(externalKey);

      expect(movement).toBeDefined();
      expect(movement?.externalKey).toBe(externalKey);
    });

    it('should return null if external key not found', async () => {
      const movement = await getMovementByExternalKey('non-existent-key');

      expect(movement).toBeNull();
    });
  });

  describe('calculateStockFromMovements', () => {
    it('should calculate current stock from movements', async () => {
      await createMovement({
        itemId: testItem.id,
        type: 'receipt',
        quantityDelta: 500,
        costPerUnitMinor: 45,
        reason: 'Initial',
      });

      await createMovement({
        itemId: testItem.id,
        type: 'consumption',
        quantityDelta: -100,
        costPerUnitMinor: 50,
        reason: 'Used',
      });

      await createMovement({
        itemId: testItem.id,
        type: 'adjustment',
        quantityDelta: 50,
        reason: 'Adjustment',
      });

      const stock = await calculateStockFromMovements(testItem.id);

      expect(stock).toBe(450); // 500 - 100 + 50
    });
  });

  describe('calculateTotalCostFromMovements', () => {
    it('should calculate total cost from movements', async () => {
      const result1 = await createMovement({
        itemId: testItem.id,
        type: 'receipt',
        quantityDelta: 100,
        costPerUnitMinor: 50,
        reason: 'Purchase',
      });

      const result2 = await createMovement({
        itemId: testItem.id,
        type: 'consumption',
        quantityDelta: -50,
        costPerUnitMinor: 50,
        reason: 'Usage',
      });

      const movements = [result1.movement!, result2.movement!];
      const totalCost = calculateTotalCostFromMovements(movements);

      expect(totalCost).toBe(7500); // (100 * 50) + (50 * 50)
    });

    it('should ignore movements without cost', async () => {
      const result1 = await createMovement({
        itemId: testItem.id,
        type: 'adjustment',
        quantityDelta: 50,
        reason: 'Count adjustment',
      });

      const totalCost = calculateTotalCostFromMovements([result1.movement!]);

      expect(totalCost).toBe(0);
    });
  });
});
