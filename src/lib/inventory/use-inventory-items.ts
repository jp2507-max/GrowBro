/**
 * Inventory Items Hook
 *
 * React hook for managing inventory items with WatermelonDB.
 * Provides real-time reactive queries with offline-first support.
 *
 * Requirements:
 * - 1.1: Display list of inventory items with current stock levels
 * - 4.2: Track low stock count
 * - 10.1: Offline-first local storage with WatermelonDB
 */

import { Q } from '@nozbe/watermelondb';
import { useDatabase } from '@nozbe/watermelondb/react';
import React from 'react';

import type { InventoryItemModel } from '@/lib/watermelon-models/inventory-item';
import type {
  InventoryCategory,
  InventoryItemWithStock,
} from '@/types/inventory';

interface UseInventoryItemsResult {
  items: InventoryItemWithStock[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  lowStockCount: number;
}

/**
 * Hook for fetching inventory items with stock calculations
 *
 * TODO: Implement stock calculation queries once batch/movement services are integrated
 */
export function useInventoryItems(): UseInventoryItemsResult {
  const database = useDatabase();
  const [items, setItems] = React.useState<InventoryItemWithStock[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  const loadItems = React.useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const itemsCollection =
        database.get<InventoryItemModel>('inventory_items');
      const rawItems = await itemsCollection
        .query(Q.where('deleted_at', null))
        .fetch();

      // TODO: Calculate current stock by querying movements/batches
      // For now, return items with placeholder stock values
      const itemsWithStock: InventoryItemWithStock[] = rawItems.map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category as InventoryCategory,
        unitOfMeasure: item.unitOfMeasure,
        trackingMode: item.trackingMode,
        isConsumable: item.isConsumable,
        minStock: item.minStock,
        reorderMultiple: item.reorderMultiple,
        leadTimeDays: item.leadTimeDays,
        sku: item.sku,
        barcode: item.barcode,
        userId: item.userId,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        deletedAt: item.deletedAt,
        currentStock: 0, // TODO: Calculate from movements
        unitCost: 0, // TODO: Calculate from latest batch or average
        totalValue: 0, // currentStock * unitCost
        isLowStock: false, // TODO: Compare with minStock
      }));

      setItems(itemsWithStock);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error('Failed to load inventory items')
      );
    } finally {
      setIsLoading(false);
    }
  }, [database]);

  React.useEffect(() => {
    loadItems();
  }, [loadItems]);

  const lowStockCount = React.useMemo(
    () => items.filter((item) => item.isLowStock).length,
    [items]
  );

  return {
    items,
    isLoading,
    error,
    refetch: loadItems,
    lowStockCount,
  };
}
