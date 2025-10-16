/**
 * Inventory Valuation Service
 *
 * Calculates real-time inventory value using FIFO costing principles.
 * All costs are tracked in minor currency units (cents) to avoid float drift.
 *
 * Requirements:
 * - 9.1: Unit costs in minor currency units, total value across batches
 * - 9.2: Real-time inventory value by category and overall
 * - 9.6: FIFO costing with cost_per_unit_minor at batch creation
 */

import type { Database } from '@nozbe/watermelondb';
import { Q } from '@nozbe/watermelondb';

import type { InventoryBatchModel } from '@/lib/watermelon-models/inventory-batch';
import type { InventoryItemModel } from '@/lib/watermelon-models/inventory-item';

/**
 * Valuation for a single inventory item
 */
export interface ItemValuation {
  /** Item ID */
  itemId: string;

  /** Item name */
  itemName: string;

  /** Item category */
  category: string;

  /** Total quantity across all batches */
  totalQuantity: number;

  /** Total value in minor units (cents) */
  totalValueMinor: number;

  /** Average cost per unit in minor units */
  avgCostPerUnitMinor: number;

  /** Number of batches */
  batchCount: number;
}

/**
 * Valuation summary by category
 */
export interface CategoryValuation {
  /** Category name */
  category: string;

  /** Total quantity across all items */
  totalQuantity: number;

  /** Total value in minor units (cents) */
  totalValueMinor: number;

  /** Number of items in category */
  itemCount: number;

  /** Number of batches in category */
  batchCount: number;
}

/**
 * Overall inventory valuation
 */
export interface InventoryValuation {
  /** Total value across all items in minor units */
  totalValueMinor: number;

  /** Number of items */
  itemCount: number;

  /** Number of batches */
  batchCount: number;

  /** Category-level breakdowns */
  categories: CategoryValuation[];

  /** Timestamp of calculation */
  calculatedAt: Date;
}

/**
 * Calculate valuation for a single inventory item
 *
 * Uses FIFO costing: value = sum of (batch quantity * batch cost_per_unit_minor)
 *
 * @param database - WatermelonDB instance
 * @param itemId - Item ID
 * @returns Item valuation
 */
export async function getItemValuation(
  database: Database,
  itemId: string
): Promise<ItemValuation> {
  // Get item details
  const item = await database
    .get<InventoryItemModel>('inventory_items')
    .find(itemId);

  // Get all active batches (non-deleted, quantity > 0)
  const batches = await database
    .get<InventoryBatchModel>('inventory_batches')
    .query(
      Q.where('item_id', itemId),
      Q.where('deleted_at', null),
      Q.where('quantity', Q.gt(0))
    )
    .fetch();

  // Calculate totals using FIFO costing
  let totalQuantity = 0;
  let totalValueMinor = 0;

  for (const batch of batches) {
    const quantity = batch.quantity;
    const costPerUnit = batch.costPerUnitMinor ?? 0;

    totalQuantity += quantity;
    totalValueMinor += quantity * costPerUnit;
  }

  const avgCostPerUnitMinor =
    totalQuantity > 0 ? Math.round(totalValueMinor / totalQuantity) : 0;

  return {
    itemId: item.id,
    itemName: item.name,
    category: item.category,
    totalQuantity,
    totalValueMinor,
    avgCostPerUnitMinor,
    batchCount: batches.length,
  };
}

/**
 * Calculate valuation for all inventory items grouped by category
 *
 * @param database - WatermelonDB instance
 * @returns Array of category valuations
 */
export async function getCategoryValuations(
  database: Database
): Promise<CategoryValuation[]> {
  // Get all active items (non-deleted)
  const items = await database
    .get<InventoryItemModel>('inventory_items')
    .query(Q.where('deleted_at', null))
    .fetch();

  if (items.length === 0) {
    return [];
  }

  // Get all active batches for these items
  const itemIds = items.map((item) => item.id);
  const batches = await database
    .get<InventoryBatchModel>('inventory_batches')
    .query(
      Q.where('item_id', Q.oneOf(itemIds)),
      Q.where('deleted_at', null),
      Q.where('quantity', Q.gt(0))
    )
    .fetch();

  // Map batches by item ID for quick lookup
  const batchesByItem = new Map<string, InventoryBatchModel[]>();
  for (const batch of batches) {
    const itemBatches = batchesByItem.get(batch.itemId) ?? [];
    itemBatches.push(batch);
    batchesByItem.set(batch.itemId, itemBatches);
  }

  // Aggregate by category
  const categoryMap = new Map<
    string,
    {
      quantity: number;
      valueMinor: number;
      itemIds: Set<string>;
      batchCount: number;
    }
  >();

  for (const item of items) {
    const itemBatches = batchesByItem.get(item.id) ?? [];
    const category = item.category;

    const current = categoryMap.get(category) ?? {
      quantity: 0,
      valueMinor: 0,
      itemIds: new Set<string>(),
      batchCount: 0,
    };

    // Sum batch values using FIFO costing
    for (const batch of itemBatches) {
      const quantity = batch.quantity;
      const costPerUnit = batch.costPerUnitMinor ?? 0;

      current.quantity += quantity;
      current.valueMinor += quantity * costPerUnit;
      current.batchCount += 1;
    }

    current.itemIds.add(item.id);
    categoryMap.set(category, current);
  }

  // Convert to array and sort by value descending
  return Array.from(categoryMap.entries())
    .map(([category, data]) => ({
      category,
      totalQuantity: data.quantity,
      totalValueMinor: data.valueMinor,
      itemCount: data.itemIds.size,
      batchCount: data.batchCount,
    }))
    .sort((a, b) => b.totalValueMinor - a.totalValueMinor);
}

/**
 * Calculate overall inventory valuation with category breakdown
 *
 * This provides a complete snapshot of inventory value at current moment.
 * Updates automatically when batches change due to receipts, consumption,
 * or adjustments.
 *
 * @param database - WatermelonDB instance
 * @returns Complete inventory valuation
 */
export async function getInventoryValuation(
  database: Database
): Promise<InventoryValuation> {
  // Get category valuations
  const categories = await getCategoryValuations(database);

  // Calculate totals
  let totalValueMinor = 0;
  let totalBatchCount = 0;

  for (const category of categories) {
    totalValueMinor += category.totalValueMinor;
    totalBatchCount += category.batchCount;
  }

  // Get unique item count across all categories
  const items = await database
    .get<InventoryItemModel>('inventory_items')
    .query(Q.where('deleted_at', null))
    .fetch();

  return {
    totalValueMinor,
    itemCount: items.length,
    batchCount: totalBatchCount,
    categories,
    calculatedAt: new Date(),
  };
}

/**
 * Format value from minor units to display string
 *
 * @param valueMinor - Value in minor units (cents)
 * @param currency - Currency symbol (default: '$')
 * @returns Formatted value string
 */
export function formatValue(
  valueMinor: number,
  currency: string = '$'
): string {
  const dollars = valueMinor / 100;
  return `${currency}${dollars.toFixed(2)}`;
}

/**
 * Calculate percentage of total value for a category
 *
 * @param categoryValue - Category value in minor units
 * @param totalValue - Total inventory value in minor units
 * @returns Percentage (0-100)
 */
export function calculateValuePercentage(
  categoryValue: number,
  totalValue: number
): number {
  if (totalValue === 0) return 0;
  return Math.round((categoryValue / totalValue) * 100);
}
