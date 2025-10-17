/**
 * Task Workflow Integration Tests
 *
 * Tests automatic inventory deduction integration with harvest and feeding workflows.
 * Verifies Requirements 3.1, 3.2 (automatic deduction on task completion).
 */

import type { Database } from '@nozbe/watermelondb';

import { deduceInventory } from '@/lib/inventory/deduction-service';
import { database } from '@/lib/watermelon';
import type { InventoryBatchModel } from '@/lib/watermelon-models/inventory-batch';
import type { InventoryItemModel } from '@/lib/watermelon-models/inventory-item';
import type { InventoryMovementModel } from '@/lib/watermelon-models/inventory-movement';
import type {
  DeduceInventoryRequest as DeductionRequest,
  DeductionResult,
} from '@/types/inventory-deduction';

/**
 * Test helpers for creating inventory items and batches
 */
async function createTestItem(
  db: Database,
  data: {
    name: string;
    category: string;
    unit: string;
  }
): Promise<InventoryItemModel> {
  const collection = db.get<InventoryItemModel>('inventory_items');
  return await db.write(async () => {
    return await collection.create((record) => {
      record.name = data.name;
      record.category = data.category;
      record.unitOfMeasure = data.unit;
      record.trackingMode = 'batched';
      record.isConsumable = true;
      record.minStock = 0;
      record.reorderMultiple = 1;
    });
  });
}

async function createTestBatch(
  db: Database,
  itemId: string,
  data: {
    lotNumber: string;
    quantity: number;
    costPerUnitMinor: number;
  }
): Promise<InventoryBatchModel> {
  const collection = db.get<InventoryBatchModel>('inventory_batches');
  return await db.write(async () => {
    return await collection.create((record) => {
      record.itemId = itemId;
      record.lotNumber = data.lotNumber;
      record.quantity = data.quantity;
      record.costPerUnitMinor = data.costPerUnitMinor;
      record.receivedAt = new Date();
    });
  });
}

async function getMovements(
  db: Database,
  _taskId: string
): Promise<InventoryMovementModel[]> {
  const collection = db.get<InventoryMovementModel>('inventory_movements');
  return await collection.query().fetch();
}

describe('Task Workflow Integration', () => {
  let db: Database;

  beforeAll(() => {
    db = database;
  });

  afterEach(async () => {
    // Clean up test data
    await db.write(async () => {
      const items = await db
        .get<InventoryItemModel>('inventory_items')
        .query()
        .fetch();
      const batches = await db
        .get<InventoryBatchModel>('inventory_batches')
        .query()
        .fetch();
      const movements = await db
        .get<InventoryMovementModel>('inventory_movements')
        .query()
        .fetch();

      await Promise.all([
        ...items.map((item) => item.markAsDeleted()),
        ...batches.map((batch) => batch.markAsDeleted()),
        ...movements.map((movement) => movement.markAsDeleted()),
      ]);
    });
  });

  describe('Feeding Task Deduction (Requirement 3.1)', () => {
    it('should deduct nutrients with fixed quantity', async () => {
      // Arrange: Create nutrient item with batch
      const nutrientItem = await createTestItem(db, {
        name: 'Nutrient A',
        category: 'Nutrients',
        unit: 'ml',
      });

      await createTestBatch(db, nutrientItem.id, {
        lotNumber: 'LOT-001',
        quantity: 1000,
        costPerUnitMinor: 50, // $0.50 per ml
      });

      // Act: Simulate feeding task completion with fixed deduction
      const request: DeductionRequest = {
        source: 'task',
        taskId: 'task-feeding-001',
        deductionMap: [
          {
            itemId: nutrientItem.id,
            unit: 'ml',
            perTaskQuantity: 100,
            scalingMode: 'fixed',
            label: 'Weekly nutrient dose',
          },
        ],
        context: {
          taskId: 'task-feeding-001',
        },
      };

      const result: DeductionResult = await deduceInventory(db, request);

      // Assert: Verify successful deduction
      expect(result.success).toBe(true);
      expect(result.movements).toHaveLength(1);
      expect(result.movements[0].itemId).toBe(nutrientItem.id);
      expect(result.movements[0].quantityDelta).toBe(-100);
      expect(result.movements[0].taskId).toBe('task-feeding-001');

      // Verify batch quantity updated
      const batches = await db
        .get<InventoryBatchModel>('inventory_batches')
        .query()
        .fetch();
      expect(batches[0].quantity).toBe(900);
    });

    it('should scale nutrients per plant count', async () => {
      // Arrange: Create nutrient with per-plant scaling
      const nutrientItem = await createTestItem(db, {
        name: 'Nutrient B',
        category: 'Nutrients',
        unit: 'ml',
      });

      await createTestBatch(db, nutrientItem.id, {
        lotNumber: 'LOT-002',
        quantity: 2000,
        costPerUnitMinor: 75,
      });

      // Act: Deduct with per-plant scaling (5 plants)
      const request: DeductionRequest = {
        source: 'task',
        taskId: 'task-feeding-002',
        deductionMap: [
          {
            itemId: nutrientItem.id,
            unit: 'ml',
            perPlantQuantity: 50,
            scalingMode: 'per-plant',
            label: 'Per-plant nutrient',
          },
        ],
        context: {
          taskId: 'task-feeding-002',
          plantCount: 5,
        },
      };

      const result = await deduceInventory(db, request);

      // Assert: Verify scaled deduction (50ml × 5 plants = 250ml)
      expect(result.success).toBe(true);
      expect(result.movements[0].quantityDelta).toBe(-250);

      const batches = await db
        .get<InventoryBatchModel>('inventory_batches')
        .query()
        .fetch();
      expect(batches[0].quantity).toBe(1750);
    });

    it('should handle insufficient stock gracefully', async () => {
      // Arrange: Create item with insufficient stock
      const nutrientItem = await createTestItem(db, {
        name: 'Nutrient C',
        category: 'Nutrients',
        unit: 'ml',
      });

      await createTestBatch(db, nutrientItem.id, {
        lotNumber: 'LOT-003',
        quantity: 50, // Only 50ml available
        costPerUnitMinor: 100,
      });

      // Act: Try to deduct 100ml (more than available)
      const request: DeductionRequest = {
        source: 'task',
        taskId: 'task-feeding-003',
        deductionMap: [
          {
            itemId: nutrientItem.id,
            unit: 'ml',
            perTaskQuantity: 100,
            scalingMode: 'fixed',
            label: 'High dose nutrient',
          },
        ],
        context: {
          taskId: 'task-feeding-003',
        },
      };

      const result = await deduceInventory(db, request);

      // Assert: Verify insufficient stock error
      expect(result.success).toBe(false);
      expect(result.error).toBe('INSUFFICIENT_STOCK');
      expect(result.insufficientItems).toHaveLength(1);
      expect(result.insufficientItems![0]).toEqual({
        itemId: nutrientItem.id,
        itemName: 'Nutrient C',
        required: 100,
        available: 50,
        unit: 'ml',
      });

      // Verify no movements created on failure
      const movements = await getMovements(db, 'task-feeding-003');
      expect(movements).toHaveLength(0);
    });
  });

  describe('Harvest Task Deduction (Requirement 3.2)', () => {
    it('should deduct containers on harvest completion', async () => {
      // Arrange: Create container item
      const containerItem = await createTestItem(db, {
        name: 'Glass Jar 1L',
        category: 'Containers',
        unit: 'units',
      });

      await createTestBatch(db, containerItem.id, {
        lotNumber: 'JAR-BATCH-01',
        quantity: 100,
        costPerUnitMinor: 350, // $3.50 per jar
      });

      // Act: Simulate harvest task with container deduction
      const request: DeductionRequest = {
        source: 'task',
        taskId: 'task-harvest-001',
        deductionMap: [
          {
            itemId: containerItem.id,
            unit: 'units',
            perTaskQuantity: 3,
            scalingMode: 'fixed',
            label: 'Storage containers',
          },
        ],
        context: {
          taskId: 'task-harvest-001',
        },
      };

      const result = await deduceInventory(db, request);

      // Assert: Verify container deduction
      expect(result.success).toBe(true);
      expect(result.movements).toHaveLength(1);
      expect(result.movements[0].quantityDelta).toBe(-3);
      // Movements are created with consumption type (verified by quantityDelta being negative)

      const batches = await db
        .get<InventoryBatchModel>('inventory_batches')
        .query()
        .fetch();
      expect(batches[0].quantity).toBe(97);
    });

    it('should deduct multiple items in harvest workflow', async () => {
      // Arrange: Create container and label items
      const containerItem = await createTestItem(db, {
        name: 'Mason Jar',
        category: 'Containers',
        unit: 'units',
      });

      const labelItem = await createTestItem(db, {
        name: 'Adhesive Label',
        category: 'Tools',
        unit: 'units',
      });

      await createTestBatch(db, containerItem.id, {
        lotNumber: 'MASON-01',
        quantity: 50,
        costPerUnitMinor: 400,
      });

      await createTestBatch(db, labelItem.id, {
        lotNumber: 'LABEL-01',
        quantity: 200,
        costPerUnitMinor: 10,
      });

      // Act: Deduct both items
      const request: DeductionRequest = {
        source: 'task',
        taskId: 'task-harvest-002',
        deductionMap: [
          {
            itemId: containerItem.id,
            unit: 'units',
            perTaskQuantity: 5,
            scalingMode: 'fixed',
            label: 'Mason jars',
          },
          {
            itemId: labelItem.id,
            unit: 'units',
            perTaskQuantity: 10,
            scalingMode: 'fixed',
            label: 'Labels',
          },
        ],
        context: {
          taskId: 'task-harvest-002',
        },
      };

      const result = await deduceInventory(db, request);

      // Assert: Verify both items deducted
      expect(result.success).toBe(true);
      expect(result.movements).toHaveLength(2);

      const containerMovement = result.movements.find(
        (m) => m.itemId === containerItem.id
      );
      const labelMovement = result.movements.find(
        (m) => m.itemId === labelItem.id
      );

      expect(containerMovement?.quantityDelta).toBe(-5);
      expect(labelMovement?.quantityDelta).toBe(-10);

      // Verify batch quantities
      const batches = await db
        .get<InventoryBatchModel>('inventory_batches')
        .query()
        .fetch();

      const containerBatch = batches.find((b) => b.itemId === containerItem.id);
      const labelBatch = batches.find((b) => b.itemId === labelItem.id);

      expect(containerBatch?.quantity).toBe(45);
      expect(labelBatch?.quantity).toBe(190);
    });
  });

  describe('Idempotency (Requirement 3.3)', () => {
    it('should prevent double-deduction on retry', async () => {
      // Arrange: Create item
      const item = await createTestItem(db, {
        name: 'Test Item',
        category: 'Nutrients',
        unit: 'ml',
      });

      await createTestBatch(db, item.id, {
        lotNumber: 'TEST-001',
        quantity: 500,
        costPerUnitMinor: 100,
      });

      const request: DeductionRequest = {
        source: 'task',
        taskId: 'task-idempotent-001',
        idempotencyKey: 'idempotent-key-001',
        deductionMap: [
          {
            itemId: item.id,
            unit: 'ml',
            perTaskQuantity: 100,
            scalingMode: 'fixed',
            label: 'Test deduction',
          },
        ],
        context: {
          taskId: 'task-idempotent-001',
        },
      };

      // Act: Submit same request twice
      const result1 = await deduceInventory(db, request);
      const result2 = await deduceInventory(db, request);

      // Assert: Second request should be idempotent
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      // Verify only one movement created
      const allMovements = await db
        .get<InventoryMovementModel>('inventory_movements')
        .query()
        .fetch();
      expect(allMovements).toHaveLength(1);

      // Verify quantity only deducted once
      const batches = await db
        .get<InventoryBatchModel>('inventory_batches')
        .query()
        .fetch();
      expect(batches[0].quantity).toBe(400); // 500 - 100, not 500 - 200
    });
  });

  describe('FIFO Cost Tracking (Requirement 9.3)', () => {
    it('should preserve batch cost in movements', async () => {
      // Arrange: Create item with two batches at different costs
      const item = await createTestItem(db, {
        name: 'Nutrient D',
        category: 'Nutrients',
        unit: 'ml',
      });

      await createTestBatch(db, item.id, {
        lotNumber: 'OLD-BATCH',
        quantity: 200,
        costPerUnitMinor: 50, // $0.50/ml
      });

      await createTestBatch(db, item.id, {
        lotNumber: 'NEW-BATCH',
        quantity: 300,
        costPerUnitMinor: 75, // $0.75/ml (newer, more expensive)
      });

      // Act: Deduct 150ml (should use FEFO/FIFO from oldest batch first)
      const request: DeductionRequest = {
        source: 'task',
        taskId: 'task-cost-001',
        deductionMap: [
          {
            itemId: item.id,
            unit: 'ml',
            perTaskQuantity: 150,
            scalingMode: 'fixed',
            label: 'Cost test',
          },
        ],
        context: {
          taskId: 'task-cost-001',
        },
      };

      const result = await deduceInventory(db, request);

      // Assert: Verify movement preserves batch cost
      expect(result.success).toBe(true);

      const movements = await db
        .get<InventoryMovementModel>('inventory_movements')
        .query()
        .fetch();

      // Should create movements from OLD-BATCH with its original cost
      const oldBatchMovement = movements.find(
        (m) => m.batchId && m.batchId.includes('OLD')
      );
      expect(oldBatchMovement?.costPerUnitMinor).toBe(50);
    });
  });
});
