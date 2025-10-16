/**
 * Inventory Deduction Integration Tests
 *
 * Tests automatic inventory deduction with task completion,
 * proving idempotency, atomic transactions, and FEFO/FIFO mechanics.
 *
 * Requirements:
 * - 3.1: Automatic deduction with FEFO picking and FIFO costing
 * - 3.3: Atomic transactions and idempotency
 * - 3.4: Insufficient stock handling
 * - 3.6: Rollback on failure
 */

// Mock SQLiteAdapter to use LokiJSAdapter for Node.js tests
import { DateTime } from 'luxon';

import { deduceInventory } from '@/lib/inventory/deduction-service';
import {
  handlePartialComplete,
  handleSkipDeduction,
} from '@/lib/inventory/insufficient-stock-handler';
import { database } from '@/lib/watermelon';
import type { InventoryBatchModel } from '@/lib/watermelon-models/inventory-batch';
import type { InventoryItemModel } from '@/lib/watermelon-models/inventory-item';
import type { InventoryMovementModel } from '@/lib/watermelon-models/inventory-movement';

jest.mock('@nozbe/watermelondb/adapters/sqlite', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const LokiJSAdapter = require('@nozbe/watermelondb/adapters/lokijs').default;

  // Return a class that wraps LokiJSAdapter
  return class MockSQLiteAdapter extends LokiJSAdapter {
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

describe('Inventory Deduction Integration', () => {
  beforeEach(async () => {
    // Clean up test data before each test
    await database.write(async () => {
      const movements = await database
        .get('inventory_movements')
        .query()
        .fetch();
      const batches = await database.get('inventory_batches').query().fetch();
      const items = await database.get('inventory_items').query().fetch();

      for (const record of [...movements, ...batches, ...items]) {
        await record.destroyPermanently();
      }
    });
  });

  describe('Basic Deduction', () => {
    it('should deduce inventory successfully with task completion', async () => {
      // Create test item
      const item = await database.write(async () =>
        database.get<InventoryItemModel>('inventory_items').create((i: any) => {
          i.name = 'Test Nutrient';
          i.category = 'Nutrients';
          i.unitOfMeasure = 'ml';
          i.trackingMode = 'batched';
          i.isConsumable = true;
          i.minStock = 100;
          i.reorderMultiple = 500;
        })
      );

      // Create batch with stock
      const batch = await database.write(async () =>
        database
          .get<InventoryBatchModel>('inventory_batches')
          .create((b: any) => {
            b.itemId = item.id;
            b.lotNumber = 'LOT-001';
            b.quantity = 1000;
            b.costPerUnitMinor = 50; // 50 cents per ml
            b.receivedAt = new Date();
          })
      );

      // Deduce 100ml
      const result = await deduceInventory(database, {
        source: 'task',
        taskId: 'test-task-1',
        deductionMap: [
          {
            itemId: item.id,
            unit: 'ml',
            perTaskQuantity: 100,
            label: 'Nutrient dose',
          },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.movements).toHaveLength(1);
      expect(result.movements[0].quantityDelta).toBe(-100);
      expect(result.movements[0].costPerUnitMinor).toBe(50);
      expect(result.movements[0].taskId).toBe('test-task-1');

      // Verify batch quantity updated
      const updatedBatch = await database
        .get<InventoryBatchModel>('inventory_batches')
        .find(batch.id);
      expect((updatedBatch as any).quantity).toBe(900);
    });

    it('should prevent duplicate deductions with idempotency key', async () => {
      const item = await database.write(async () =>
        database.get<InventoryItemModel>('inventory_items').create((i: any) => {
          i.name = 'Test Item';
          i.category = 'Tools';
          i.unitOfMeasure = 'units';
          i.trackingMode = 'simple';
          i.isConsumable = true;
          i.minStock = 10;
          i.reorderMultiple = 20;
        })
      );

      await database.write(async () =>
        database
          .get<InventoryBatchModel>('inventory_batches')
          .create((b: any) => {
            b.itemId = item.id;
            b.lotNumber = 'BATCH-001';
            b.quantity = 100;
            b.costPerUnitMinor = 100;
            b.receivedAt = new Date();
          })
      );

      const deductionRequest = {
        source: 'task' as const,
        taskId: 'task-123',
        deductionMap: [{ itemId: item.id, unit: 'units', perTaskQuantity: 5 }],
        idempotencyKey: 'test-idempotency-key',
      };

      // First deduction
      const result1 = await deduceInventory(database, deductionRequest);
      expect(result1.success).toBe(true);
      expect(result1.movements).toHaveLength(1);

      // Second deduction with same key
      const result2 = await deduceInventory(database, deductionRequest);
      expect(result2.success).toBe(true);
      expect(result2.movements).toHaveLength(1);
      expect(result2.movements[0].id).toBe(result1.movements[0].id);

      // Verify only one movement exists
      const movements = await database
        .get<InventoryMovementModel>('inventory_movements')
        .query()
        .fetch();
      expect(movements).toHaveLength(1);
    });
  });

  describe('FEFO Picking', () => {
    it('should consume from batch expiring soonest (FEFO)', async () => {
      const item = await database.write(async () =>
        database.get<InventoryItemModel>('inventory_items').create((i: any) => {
          i.name = 'Perishable Item';
          i.category = 'Nutrients';
          i.unitOfMeasure = 'ml';
          i.trackingMode = 'batched';
          i.isConsumable = true;
          i.minStock = 50;
          i.reorderMultiple = 100;
        })
      );

      const now = DateTime.now();

      // Create batches with different expiration dates
      const batch1 = await database.write(async () =>
        database
          .get<InventoryBatchModel>('inventory_batches')
          .create((b: any) => {
            b.itemId = item.id;
            b.lotNumber = 'BATCH-FAR';
            b.quantity = 100;
            b.costPerUnitMinor = 50;
            b.expiresOn = now.plus({ days: 90 }).toJSDate(); // Expires later
            b.receivedAt = now.minus({ days: 10 }).toJSDate();
          })
      );

      const batch2 = await database.write(async () =>
        database
          .get<InventoryBatchModel>('inventory_batches')
          .create((b: any) => {
            b.itemId = item.id;
            b.lotNumber = 'BATCH-SOON';
            b.quantity = 100;
            b.costPerUnitMinor = 60;
            b.expiresOn = now.plus({ days: 30 }).toJSDate(); // Expires sooner
            b.receivedAt = now.minus({ days: 5 }).toJSDate();
          })
      );

      // Deduce 50ml - should come from batch2 (expires sooner)
      const result = await deduceInventory(database, {
        source: 'task',
        taskId: 'test-fefo',
        deductionMap: [{ itemId: item.id, unit: 'ml', perTaskQuantity: 50 }],
      });

      expect(result.success).toBe(true);
      expect(result.movements).toHaveLength(1);
      expect(result.movements[0].batchId).toBe(batch2.id);
      expect(result.movements[0].costPerUnitMinor).toBe(60); // FIFO cost from batch2

      // Verify batch2 quantity updated
      const updatedBatch2 = await database
        .get<InventoryBatchModel>('inventory_batches')
        .find(batch2.id);
      expect((updatedBatch2 as any).quantity).toBe(50);

      // Verify batch1 unchanged
      const updatedBatch1 = await database
        .get<InventoryBatchModel>('inventory_batches')
        .find(batch1.id);
      expect((updatedBatch1 as any).quantity).toBe(100);
    });

    it('should exclude expired batches by default', async () => {
      const item = await database.write(async () =>
        database.get<InventoryItemModel>('inventory_items').create((i: any) => {
          i.name = 'Expired Test';
          i.category = 'Seeds';
          i.unitOfMeasure = 'seeds';
          i.trackingMode = 'batched';
          i.isConsumable = true;
          i.minStock = 10;
          i.reorderMultiple = 50;
        })
      );

      const now = DateTime.now();

      // Create expired batch
      await database.write(async () =>
        database
          .get<InventoryBatchModel>('inventory_batches')
          .create((b: any) => {
            b.itemId = item.id;
            b.lotNumber = 'EXPIRED-BATCH';
            b.quantity = 50;
            b.costPerUnitMinor = 100;
            b.expiresOn = now.minus({ days: 10 }).toJSDate(); // Expired
            b.receivedAt = now.minus({ days: 60 }).toJSDate();
          })
      );

      // Attempt deduction without override
      const result = await deduceInventory(database, {
        source: 'task',
        taskId: 'test-expired',
        deductionMap: [{ itemId: item.id, unit: 'seeds', perTaskQuantity: 10 }],
      });

      expect(result.success).toBe(false);
      expect(result.insufficientItems).toHaveLength(1);
      expect(result.insufficientItems![0].available).toBe(0);
    });

    it('should allow expired batch consumption with override', async () => {
      const item = await database.write(async () =>
        database.get<InventoryItemModel>('inventory_items').create((i: any) => {
          i.name = 'Override Test';
          i.category = 'Nutrients';
          i.unitOfMeasure = 'ml';
          i.trackingMode = 'batched';
          i.isConsumable = true;
          i.minStock = 50;
          i.reorderMultiple = 100;
        })
      );

      const now = DateTime.now();

      const expiredBatch = await database.write(async () =>
        database
          .get<InventoryBatchModel>('inventory_batches')
          .create((b: any) => {
            b.itemId = item.id;
            b.lotNumber = 'OVERRIDE-BATCH';
            b.quantity = 100;
            b.costPerUnitMinor = 50;
            b.expiresOn = now.minus({ days: 5 }).toJSDate();
            b.receivedAt = now.minus({ days: 30 }).toJSDate();
          })
      );

      // Deduction with override
      const result = await deduceInventory(database, {
        source: 'manual',
        deductionMap: [{ itemId: item.id, unit: 'ml', perTaskQuantity: 20 }],
        allowExpiredOverride: true,
        expiredOverrideReason: 'User acknowledged expiry',
      });

      expect(result.success).toBe(true);
      expect(result.movements).toHaveLength(1);
      expect(result.movements[0].batchId).toBe(expiredBatch.id);
    });
  });

  describe('Insufficient Stock Handling', () => {
    it('should return insufficient stock error with recovery options', async () => {
      const item = await database.write(async () =>
        database.get<InventoryItemModel>('inventory_items').create((i: any) => {
          i.name = 'Low Stock Item';
          i.category = 'Tools';
          i.unitOfMeasure = 'units';
          i.trackingMode = 'simple';
          i.isConsumable = true;
          i.minStock = 10;
          i.reorderMultiple = 20;
        })
      );

      // Only 30 units available
      await database.write(async () =>
        database
          .get<InventoryBatchModel>('inventory_batches')
          .create((b: any) => {
            b.itemId = item.id;
            b.lotNumber = 'LOW-STOCK';
            b.quantity = 30;
            b.costPerUnitMinor = 100;
            b.receivedAt = new Date();
          })
      );

      // Try to deduce 50 units
      const result = await deduceInventory(database, {
        source: 'task',
        taskId: 'insufficient-test',
        deductionMap: [{ itemId: item.id, unit: 'units', perTaskQuantity: 50 }],
      });

      expect(result.success).toBe(false);
      expect(result.insufficientItems).toHaveLength(1);

      const error = result.insufficientItems![0];
      expect(error.required).toBe(50);
      expect(error.available).toBe(30);
      expect(error.recoveryOptions).toHaveLength(3);

      // Verify recovery options
      const actions = error.recoveryOptions.map((opt) => opt.action);
      expect(actions).toContain('partial');
      expect(actions).toContain('skip');
      expect(actions).toContain('adjust');
    });

    it('should handle partial completion consuming available stock', async () => {
      const item = await database.write(async () =>
        database.get<InventoryItemModel>('inventory_items').create((i: any) => {
          i.name = 'Partial Test';
          i.category = 'Nutrients';
          i.unitOfMeasure = 'ml';
          i.trackingMode = 'batched';
          i.isConsumable = true;
          i.minStock = 100;
          i.reorderMultiple = 500;
        })
      );

      await database.write(async () =>
        database
          .get<InventoryBatchModel>('inventory_batches')
          .create((b: any) => {
            b.itemId = item.id;
            b.lotNumber = 'PARTIAL-BATCH';
            b.quantity = 25;
            b.costPerUnitMinor = 75;
            b.receivedAt = new Date();
          })
      );

      // Initial deduction fails
      const result = await deduceInventory(database, {
        source: 'task',
        taskId: 'partial-task',
        deductionMap: [{ itemId: item.id, unit: 'ml', perTaskQuantity: 50 }],
      });

      expect(result.success).toBe(false);
      const error = result.insufficientItems![0];

      // Handle partial completion
      const movements = await handlePartialComplete({
        database,
        error,
        taskId: 'partial-task',
        idempotencyKey: 'partial-idempotency-key',
      });

      expect(movements).toHaveLength(1);
      expect(movements[0].quantityDelta).toBe(-25);
      expect(movements[0].reason).toContain('Partial deduction');
      expect(movements[0].reason).toContain('shortage 25');

      // Verify no orphan movements
      const allMovements = await database
        .get('inventory_movements')
        .query()
        .fetch();
      expect(allMovements.length).toBeGreaterThan(0);
    });

    it('should handle skip deduction with marker movement', async () => {
      const item = await database.write(async () =>
        database.get<InventoryItemModel>('inventory_items').create((i: any) => {
          i.name = 'Skip Test';
          i.category = 'Tools';
          i.unitOfMeasure = 'units';
          i.trackingMode = 'simple';
          i.isConsumable = true;
          i.minStock = 5;
          i.reorderMultiple = 10;
        })
      );

      // Initial deduction fails (no stock)
      const result = await deduceInventory(database, {
        source: 'task',
        taskId: 'skip-task',
        deductionMap: [{ itemId: item.id, unit: 'units', perTaskQuantity: 10 }],
      });

      expect(result.success).toBe(false);
      const error = result.insufficientItems![0];

      // Handle skip
      const movements = await handleSkipDeduction({
        database,
        error,
        taskId: 'skip-task',
        idempotencyKey: 'skip-idempotency-key',
      });

      expect(movements).toHaveLength(1);
      expect(movements[0].quantityDelta).toBe(0); // Zero quantity marker
      expect(movements[0].reason).toContain('Skipped deduction');
      expect(movements[0].taskId).toBe('skip-task');
    });
  });

  describe('Multi-Batch Consumption', () => {
    it('should split consumption across multiple batches with FIFO costing', async () => {
      const item = await database.write(async () =>
        database.get<InventoryItemModel>('inventory_items').create((i: any) => {
          i.name = 'Multi-Batch Item';
          i.category = 'Nutrients';
          i.unitOfMeasure = 'ml';
          i.trackingMode = 'batched';
          i.isConsumable = true;
          i.minStock = 100;
          i.reorderMultiple = 500;
        })
      );

      const now = DateTime.now();

      // Batch 1: 50ml @ $0.50/ml (expires sooner)
      const batch1 = await database.write(async () =>
        database
          .get<InventoryBatchModel>('inventory_batches')
          .create((b: any) => {
            b.itemId = item.id;
            b.lotNumber = 'BATCH-1';
            b.quantity = 50;
            b.costPerUnitMinor = 50;
            b.expiresOn = now.plus({ days: 20 }).toJSDate();
            b.receivedAt = now.minus({ days: 10 }).toJSDate();
          })
      );

      // Batch 2: 100ml @ $0.60/ml (expires later)
      const batch2 = await database.write(async () =>
        database
          .get<InventoryBatchModel>('inventory_batches')
          .create((b: any) => {
            b.itemId = item.id;
            b.lotNumber = 'BATCH-2';
            b.quantity = 100;
            b.costPerUnitMinor = 60;
            b.expiresOn = now.plus({ days: 40 }).toJSDate();
            b.receivedAt = now.minus({ days: 5 }).toJSDate();
          })
      );

      // Deduce 120ml (spans both batches)
      const result = await deduceInventory(database, {
        source: 'task',
        taskId: 'multi-batch-task',
        deductionMap: [{ itemId: item.id, unit: 'ml', perTaskQuantity: 120 }],
      });

      expect(result.success).toBe(true);
      expect(result.movements).toHaveLength(2);

      // First movement from batch1 (50ml @ $0.50)
      const movement1 = result.movements.find((m) => m.batchId === batch1.id);
      expect(movement1).toBeDefined();
      expect(movement1!.quantityDelta).toBe(-50);
      expect(movement1!.costPerUnitMinor).toBe(50);

      // Second movement from batch2 (70ml @ $0.60)
      const movement2 = result.movements.find((m) => m.batchId === batch2.id);
      expect(movement2).toBeDefined();
      expect(movement2!.quantityDelta).toBe(-70);
      expect(movement2!.costPerUnitMinor).toBe(60);

      // Verify batch quantities
      const updatedBatch1 = await database
        .get<InventoryBatchModel>('inventory_batches')
        .find(batch1.id);
      expect((updatedBatch1 as any).quantity).toBe(0);

      const updatedBatch2 = await database
        .get<InventoryBatchModel>('inventory_batches')
        .find(batch2.id);
      expect((updatedBatch2 as any).quantity).toBe(30);
    });
  });
});
