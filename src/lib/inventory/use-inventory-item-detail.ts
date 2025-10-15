/**
 * Inventory Item Detail Hook
 *
 * Fetches item details and associated batches with FEFO ordering.
 *
 * Requirements: 1.3, 2.2
 */

import { Q } from '@nozbe/watermelondb';
import { useDatabase } from '@nozbe/watermelondb/react';
import React from 'react';

import type {
  InventoryBatchWithStatus,
  InventoryItemWithStock,
} from '@/types/inventory';

interface UseInventoryItemDetailResult {
  item: InventoryItemWithStock | null;
  batches: InventoryBatchWithStatus[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Build item with stock from raw WatermelonDB model
 */
function buildItemWithStock(rawItem: any): InventoryItemWithStock {
  return {
    id: rawItem.id,
    name: rawItem.name,
    category: rawItem.category,
    unitOfMeasure: rawItem.unitOfMeasure,
    trackingMode: rawItem.trackingMode,
    isConsumable: rawItem.isConsumable,
    minStock: rawItem.minStock,
    reorderMultiple: rawItem.reorderMultiple,
    leadTimeDays: rawItem.leadTimeDays,
    sku: rawItem.sku,
    barcode: rawItem.barcode,
    userId: rawItem.userId,
    createdAt: rawItem.createdAt,
    updatedAt: rawItem.updatedAt,
    deletedAt: rawItem.deletedAt,
    currentStock: 0, // TODO
    unitCost: 0, // TODO
    totalValue: 0, // TODO
    isLowStock: false, // TODO
  };
}

/**
 * Build batch with status from raw WatermelonDB model
 */
function buildBatchWithStatus(batch: any): InventoryBatchWithStatus {
  return {
    id: batch.id,
    itemId: batch.itemId,
    lotNumber: batch.lotNumber,
    expiresOn: batch.expiresOn,
    quantity: batch.quantity,
    costPerUnitMinor: batch.costPerUnitMinor,
    receivedAt: batch.receivedAt,
    userId: batch.userId,
    createdAt: batch.createdAt,
    updatedAt: batch.updatedAt,
    deletedAt: batch.deletedAt,
    isExpired: false, // TODO: Calculate
    daysToExpiry: undefined, // TODO: Calculate
    isExcludedFromPicking: false, // TODO: Calculate
  };
}

/**
 * Hook for fetching inventory item details with batches
 *
 * TODO: Implement stock calculations and batch expiry status
 */
export function useInventoryItemDetail(
  itemId: string
): UseInventoryItemDetailResult {
  const database = useDatabase();
  const [item, setItem] = React.useState<InventoryItemWithStock | null>(null);
  const [batches, setBatches] = React.useState<InventoryBatchWithStatus[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  const loadData = React.useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load item
      const itemsCollection = database.get('inventory_items');
      const rawItem: any = await itemsCollection.find(itemId);

      if (!rawItem || rawItem.deletedAt) {
        throw new Error('Item not found');
      }

      const itemWithStock = buildItemWithStock(rawItem);
      setItem(itemWithStock);

      // Load batches (FEFO ordered)
      const batchesCollection = database.get('inventory_batches');
      const rawBatches = await batchesCollection
        .query(
          Q.where('item_id', itemId),
          Q.where('deleted_at', null),
          Q.sortBy('expires_on', Q.asc)
        )
        .fetch();

      const batchesWithStatus = rawBatches.map(buildBatchWithStatus);
      setBatches(batchesWithStatus);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error('Failed to load item details')
      );
    } finally {
      setIsLoading(false);
    }
  }, [database, itemId]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    item,
    batches,
    isLoading,
    error,
    refetch: loadData,
  };
}
