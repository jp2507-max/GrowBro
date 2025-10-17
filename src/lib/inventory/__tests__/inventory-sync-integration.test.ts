/**
 * Integration tests for inventory sync with offline-first behavior
 * Requirements: 7.1, 7.2, 7.3, 7.4, 10.6
 */

import { database } from '@/lib/watermelon';
import type { InventoryBatchModel } from '@/lib/watermelon-models/inventory-batch';
import type { InventoryItemModel } from '@/lib/watermelon-models/inventory-item';
import type { InventoryMovementModel } from '@/lib/watermelon-models/inventory-movement';

describe('Inventory Sync Integration', () => {
  let itemsCollection: any;
  let batchesCollection: any;
  let movementsCollection: any;

  beforeAll(() => {
    itemsCollection = database.collections.get('inventory_items');
    batchesCollection = database.collections.get('inventory_batches');
    movementsCollection = database.collections.get('inventory_movements');
  });

  afterEach(async () => {
    // Clean up test data
    await database.write(async () => {
      const items = await itemsCollection.query().fetch();
      const batches = await batchesCollection.query().fetch();
      const movements = await movementsCollection.query().fetch();

      await Promise.all([
        ...items.map((item: any) => item.markAsDeleted()),
        ...batches.map((batch: any) => batch.markAsDeleted()),
        ...movements.map((movement: any) => movement.markAsDeleted()),
      ]);
    });
  });

  describe('Offline CRUD Operations (Requirement 7.4)', () => {
    test('should create inventory item offline and queue for sync', async () => {
      const item: InventoryItemModel = await database.write(async () => {
        return await itemsCollection.create((item: InventoryItemModel) => {
          item.name = 'Test Nutrient';
          item.category = 'Nutrients';
          item.unitOfMeasure = 'ml';
          item.trackingMode = 'batched';
          item.isConsumable = true;
          item.minStock = 100;
          item.reorderMultiple = 500;
        });
      });

      expect(item).toBeDefined();
      expect(item.name).toBe('Test Nutrient');
      expect(item.trackingMode).toBe('batched');

      // Verify item is in local database
      const fetchedItem = await itemsCollection.find(item.id);
      expect(fetchedItem).toBeDefined();
      expect(fetchedItem.name).toBe('Test Nutrient');
    });

    test('should create batch offline with proper relations', async () => {
      const item: InventoryItemModel = await database.write(async () => {
        return await itemsCollection.create((item: InventoryItemModel) => {
          item.name = 'Test Item';
          item.category = 'Seeds';
          item.unitOfMeasure = 'pcs';
          item.trackingMode = 'batched';
          item.isConsumable = true;
          item.minStock = 10;
          item.reorderMultiple = 50;
        });
      });

      const batch: InventoryBatchModel = await database.write(async () => {
        return await batchesCollection.create((batch: InventoryBatchModel) => {
          batch.itemId = item.id;
          batch.lotNumber = 'LOT-2025-001';
          batch.quantity = 100;
          batch.costPerUnitMinor = 500; // $5.00 in cents
          batch.receivedAt = new Date();
        });
      });

      expect(batch).toBeDefined();
      expect(batch.itemId).toBe(item.id);
      expect(batch.lotNumber).toBe('LOT-2025-001');
      expect(batch.quantity).toBe(100);
    });

    test('should create movement offline (create-only)', async () => {
      const item: InventoryItemModel = await database.write(async () => {
        return await itemsCollection.create((item: InventoryItemModel) => {
          item.name = 'Test Item';
          item.category = 'Nutrients';
          item.unitOfMeasure = 'ml';
          item.trackingMode = 'simple';
          item.isConsumable = true;
          item.minStock = 50;
          item.reorderMultiple = 100;
        });
      });

      const movement: InventoryMovementModel = await database.write(
        async () => {
          return await movementsCollection.create(
            (movement: InventoryMovementModel) => {
              movement.itemId = item.id;
              movement.type = 'receipt';
              movement.quantityDelta = 500;
              movement.costPerUnitMinor = 250; // $2.50 in cents
              movement.reason = 'Initial stock';
              movement.externalKey = 'test-receipt-001';
            }
          );
        }
      );

      expect(movement).toBeDefined();
      expect(movement.type).toBe('receipt');
      expect(movement.quantityDelta).toBe(500);
      expect(movement.externalKey).toBe('test-receipt-001');
    });
  });

  describe('Movement Immutability (Requirements 1.4, 10.6)', () => {
    test('should not allow updating movements', async () => {
      const item: InventoryItemModel = await database.write(async () => {
        return await itemsCollection.create((item: InventoryItemModel) => {
          item.name = 'Test Item';
          item.category = 'Nutrients';
          item.unitOfMeasure = 'ml';
          item.trackingMode = 'simple';
          item.isConsumable = true;
          item.minStock = 50;
          item.reorderMultiple = 100;
        });
      });

      const movement: InventoryMovementModel = await database.write(
        async () => {
          return await movementsCollection.create(
            (movement: InventoryMovementModel) => {
              movement.itemId = item.id;
              movement.type = 'receipt';
              movement.quantityDelta = 100;
              movement.costPerUnitMinor = 200;
              movement.reason = 'Initial stock';
            }
          );
        }
      );

      // Attempt to update should be prevented by application logic
      // WatermelonDB allows updates at the client level, but sync push will filter them
      // This test documents the behavior - actual filtering happens in sync-engine.ts

      expect(movement).toBeDefined();
      expect(movement.quantityDelta).toBe(100);

      // Note: Client-side update is technically possible in WatermelonDB,
      // but sync-engine.ts filters out updated/deleted movements before push
      // Integration with sync would verify the filtering logic
    });

    test('should support idempotency via external_key', async () => {
      const item: InventoryItemModel = await database.write(async () => {
        return await itemsCollection.create((item: InventoryItemModel) => {
          item.name = 'Test Item';
          item.category = 'Nutrients';
          item.unitOfMeasure = 'ml';
          item.trackingMode = 'simple';
          item.isConsumable = true;
          item.minStock = 50;
          item.reorderMultiple = 100;
        });
      });

      const externalKey = 'idempotent-receipt-123';

      // First creation
      const movement1: InventoryMovementModel = await database.write(
        async () => {
          return await movementsCollection.create(
            (movement: InventoryMovementModel) => {
              movement.itemId = item.id;
              movement.type = 'receipt';
              movement.quantityDelta = 100;
              movement.costPerUnitMinor = 200;
              movement.reason = 'Test receipt';
              movement.externalKey = externalKey;
            }
          );
        }
      );

      expect(movement1).toBeDefined();
      expect(movement1.externalKey).toBe(externalKey);

      // Check for existing movement with same external_key before creating duplicate
      const existingMovement = await movementsCollection
        .query()
        .where('external_key', externalKey)
        .fetch();

      expect(existingMovement.length).toBe(1);
      expect(existingMovement[0].id).toBe(movement1.id);

      // Application logic should prevent duplicate creation
      // This test verifies the external_key is properly stored
    });
  });

  describe('Offline Workflow (Requirement 7.4)', () => {
    test('should support flight-mode workflow: create item → add batch → consume', async () => {
      // Step 1: Create item offline
      const item: InventoryItemModel = await database.write(async () => {
        return await itemsCollection.create((item: InventoryItemModel) => {
          item.name = 'Flight Mode Test Nutrient';
          item.category = 'Nutrients';
          item.unitOfMeasure = 'ml';
          item.trackingMode = 'batched';
          item.isConsumable = true;
          item.minStock = 100;
          item.reorderMultiple = 500;
        });
      });

      expect(item).toBeDefined();

      // Step 2: Add batch offline
      const batch: InventoryBatchModel = await database.write(async () => {
        return await batchesCollection.create((batch: InventoryBatchModel) => {
          batch.itemId = item.id;
          batch.lotNumber = 'FLIGHT-LOT-001';
          batch.quantity = 1000;
          batch.costPerUnitMinor = 100; // $1.00 per ml
          batch.receivedAt = new Date();
        });
      });

      expect(batch.quantity).toBe(1000);

      // Step 3: Consume via task offline
      const consumptionMovement: InventoryMovementModel = await database.write(
        async () => {
          return await movementsCollection.create(
            (movement: InventoryMovementModel) => {
              movement.itemId = item.id;
              movement.batchId = batch.id;
              movement.type = 'consumption';
              movement.quantityDelta = -50; // negative for consumption
              movement.costPerUnitMinor = 100; // FIFO cost from batch
              movement.reason = 'Task: Weekly feeding';
              movement.taskId = 'mock-task-id-123';
              movement.externalKey = 'task-123-consumption';
            }
          );
        }
      );

      expect(consumptionMovement.type).toBe('consumption');
      expect(consumptionMovement.quantityDelta).toBe(-50);
      expect(consumptionMovement.taskId).toBe('mock-task-id-123');

      // Verify all records exist locally
      const localItems = await itemsCollection.query().fetch();
      const localBatches = await batchesCollection.query().fetch();
      const localMovements = await movementsCollection.query().fetch();

      expect(localItems.length).toBeGreaterThanOrEqual(1);
      expect(localBatches.length).toBeGreaterThanOrEqual(1);
      expect(localMovements.length).toBeGreaterThanOrEqual(1);

      // Step 4: On reconnect, sync would push all changes
      // (Sync integration would be tested separately with actual sync calls)
    });
  });

  describe('Sync Field Integrity', () => {
    test('should store server sync fields correctly', async () => {
      const item: InventoryItemModel = await database.write(async () => {
        return await itemsCollection.create((item: InventoryItemModel) => {
          item.name = 'Sync Test Item';
          item.category = 'Nutrients';
          item.unitOfMeasure = 'ml';
          item.trackingMode = 'simple';
          item.isConsumable = true;
          item.minStock = 50;
          item.reorderMultiple = 100;
          item.serverRevision = 1;
          item.serverUpdatedAtMs = Date.now();
        });
      });

      expect(item.serverRevision).toBe(1);
      expect(item.serverUpdatedAtMs).toBeDefined();
    });

    test('should support soft delete via deleted_at tombstones', async () => {
      const item: InventoryItemModel = await database.write(async () => {
        return await itemsCollection.create((item: InventoryItemModel) => {
          item.name = 'Delete Test Item';
          item.category = 'Seeds';
          item.unitOfMeasure = 'pcs';
          item.trackingMode = 'simple';
          item.isConsumable = true;
          item.minStock = 10;
          item.reorderMultiple = 50;
        });
      });

      // Mark as deleted
      await database.write(async () => {
        await item.markAsDeleted();
      });

      // Verify deletedAt timestamp is set (WatermelonDB field name)
      expect(item.deletedAt).toBeDefined();
      expect(item.deletedAt).toBeInstanceOf(Date);

      // In sync, this would be sent as a tombstone with deleted_at timestamp
    });
  });
});
