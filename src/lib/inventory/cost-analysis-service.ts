/**
 * Cost Analysis Service
 *
 * Utilities for calculating and aggregating inventory costs with integer
 * minor currency units (cents). Ensures FIFO cost integrity and provides
 * cost breakdowns by category, time period, and harvest task.
 *
 * Requirements:
 * - 9.3: FIFO costing at batch level with cost_per_unit from batch at pick time
 * - 9.4: Display quantity and cost with preserved batch valuation
 */

import type { Database } from '@nozbe/watermelondb';
import { Q } from '@nozbe/watermelondb';
import { DateTime } from 'luxon';

import type { InventoryItemModel } from '@/lib/watermelon-models/inventory-item';
import type { InventoryMovementModel } from '@/lib/watermelon-models/inventory-movement';

/**
 * Cost summary for a single item
 */
export interface ItemCostSummary {
  /** Item ID */
  itemId: string;

  /** Item name */
  itemName: string;

  /** Total quantity consumed */
  totalQuantity: number;

  /** Total cost in minor units (cents) */
  totalCostMinor: number;

  /** Average cost per unit in minor units */
  avgCostPerUnitMinor: number;

  /** Number of consumption movements */
  movementCount: number;
}

/**
 * Cost summary by category
 */
export interface CategoryCostSummary {
  /** Category name */
  category: string;

  /** Total quantity consumed */
  totalQuantity: number;

  /** Total cost in minor units (cents) */
  totalCostMinor: number;

  /** Number of items in category */
  itemCount: number;

  /** Number of consumption movements */
  movementCount: number;
}

/**
 * Time-series cost data point
 */
export interface CostDataPoint {
  /** Period start date */
  date: Date;

  /** Period label (e.g., "W1", "Jan") */
  label: string;

  /** Total cost in minor units for period */
  costMinor: number;

  /** Total quantity consumed in period */
  quantity: number;
}

/**
 * Cost summary by time period and category
 */
export interface TimeSerieCostData {
  /** Category name */
  category: string;

  /** Data points over time */
  dataPoints: CostDataPoint[];
}

/**
 * Harvest cost summary
 */
export interface HarvestCostSummary {
  /** Task ID */
  taskId: string;

  /** Total cost in minor units */
  totalCostMinor: number;

  /** Item-level breakdown */
  items: {
    itemId: string;
    itemName: string;
    quantity: number;
    costMinor: number;
  }[];

  /** Number of movements */
  movementCount: number;
}

/**
 * Calculate cost summary for an item over a time period
 *
 * @param database - WatermelonDB instance
 * @param itemId - Item ID
 * @param options - Optional date range filters
 * @returns Cost summary
 */
export async function getItemCostSummary(
  database: Database,
  itemId: string,
  options?: { startDate?: Date; endDate?: Date }
): Promise<ItemCostSummary> {
  const { startDate, endDate } = options ?? {};

  // Build query
  const conditions: Q.Clause[] = [
    Q.where('item_id', itemId),
    Q.where('type', 'consumption'),
  ];

  if (startDate) {
    conditions.push(Q.where('created_at', Q.gte(startDate.getTime())));
  }

  if (endDate) {
    conditions.push(Q.where('created_at', Q.lte(endDate.getTime())));
  }

  const movements = await database
    .get<InventoryMovementModel>('inventory_movements')
    .query(...conditions)
    .fetch();

  // Get item name
  const item = await database
    .get<InventoryItemModel>('inventory_items')
    .find(itemId);

  // Aggregate costs
  let totalQuantity = 0;
  let totalCostMinor = 0;

  for (const movement of movements) {
    const quantity = Math.abs(movement.quantityDelta);
    const costPerUnit = movement.costPerUnitMinor ?? 0;
    totalQuantity += quantity;
    totalCostMinor += quantity * costPerUnit;
  }

  const avgCostPerUnitMinor =
    totalQuantity > 0 ? Math.round(totalCostMinor / totalQuantity) : 0;

  return {
    itemId: item.id,
    itemName: item.name,
    totalQuantity,
    totalCostMinor,
    avgCostPerUnitMinor,
    movementCount: movements.length,
  };
}

/**
 * Calculate cost summaries by category
 *
 * @param database - WatermelonDB instance
 * @param options - Optional date range filters
 * @returns Array of category cost summaries
 */
export async function getCategoryCostSummaries(
  database: Database,
  options?: { startDate?: Date; endDate?: Date }
): Promise<CategoryCostSummary[]> {
  const { startDate, endDate } = options ?? {};

  // Query all consumption movements in period
  const conditions: Q.Clause[] = [Q.where('type', 'consumption')];

  if (startDate) {
    conditions.push(Q.where('created_at', Q.gte(startDate.getTime())));
  }

  if (endDate) {
    conditions.push(Q.where('created_at', Q.lte(endDate.getTime())));
  }

  const movements = await database
    .get<InventoryMovementModel>('inventory_movements')
    .query(...conditions)
    .fetch();

  // Get all items to map categories
  const itemIds = [...new Set(movements.map((m) => m.itemId))];

  if (itemIds.length === 0) {
    return [];
  }

  const items = await database
    .get<InventoryItemModel>('inventory_items')
    .query(Q.where('id', Q.oneOf(itemIds)))
    .fetch();

  const itemMap = new Map(items.map((item) => [item.id, item]));

  // Aggregate by category
  const categoryMap = new Map<
    string,
    {
      quantity: number;
      costMinor: number;
      itemIds: Set<string>;
      movementCount: number;
    }
  >();

  for (const movement of movements) {
    const item = itemMap.get(movement.itemId);
    if (!item) continue;

    const category = item.category;
    const current = categoryMap.get(category) ?? {
      quantity: 0,
      costMinor: 0,
      itemIds: new Set<string>(),
      movementCount: 0,
    };

    const quantity = Math.abs(movement.quantityDelta);
    const costPerUnit = movement.costPerUnitMinor ?? 0;

    current.quantity += quantity;
    current.costMinor += quantity * costPerUnit;
    current.itemIds.add(item.id);
    current.movementCount += 1;

    categoryMap.set(category, current);
  }

  // Convert to array
  return Array.from(categoryMap.entries()).map(([category, data]) => ({
    category,
    totalQuantity: data.quantity,
    totalCostMinor: data.costMinor,
    itemCount: data.itemIds.size,
    movementCount: data.movementCount,
  }));
}

/**
 * Calculate time-series cost data by category
 *
 * @param database - WatermelonDB instance
 * @param options - Bucket type and date range
 * @returns Time-series data by category
 */
/**
 * Helper: Group movements by category and time bucket
 */
function groupByCategoryAndTime(
  movements: InventoryMovementModel[],
  itemMap: Map<string, InventoryItemModel>,
  bucketType: 'week' | 'month'
): Map<
  string,
  Map<string, { costMinor: number; quantity: number; date: Date }>
> {
  const categoryBuckets = new Map<
    string,
    Map<string, { costMinor: number; quantity: number; date: Date }>
  >();

  for (const movement of movements) {
    const item = itemMap.get(movement.itemId);
    if (!item) continue;

    const category = item.category;
    const dt = DateTime.fromJSDate(movement.createdAt);

    // Calculate bucket key
    let bucketKey: string;
    let bucketDate: Date;

    if (bucketType === 'week') {
      const weekStart = dt.startOf('week');
      bucketKey = weekStart.toISODate() ?? '';
      bucketDate = weekStart.toJSDate();
    } else {
      const monthStart = dt.startOf('month');
      bucketKey = monthStart.toISODate() ?? '';
      bucketDate = monthStart.toJSDate();
    }

    // Get or create category bucket map
    if (!categoryBuckets.has(category)) {
      categoryBuckets.set(
        category,
        new Map<string, { costMinor: number; quantity: number; date: Date }>()
      );
    }

    const buckets = categoryBuckets.get(category)!;

    // Get or create bucket
    const bucket = buckets.get(bucketKey) ?? {
      costMinor: 0,
      quantity: 0,
      date: bucketDate,
    };

    // Add movement to bucket
    const quantity = Math.abs(movement.quantityDelta);
    const costPerUnit = movement.costPerUnitMinor ?? 0;

    bucket.quantity += quantity;
    bucket.costMinor += quantity * costPerUnit;

    buckets.set(bucketKey, bucket);
  }

  return categoryBuckets;
}

export async function getTimeSerieCostData(
  database: Database,
  options: {
    bucketType: 'week' | 'month';
    startDate: Date;
    endDate: Date;
  }
): Promise<TimeSerieCostData[]> {
  const { bucketType, startDate, endDate } = options;
  // Query movements in period
  const movements = await database
    .get<InventoryMovementModel>('inventory_movements')
    .query(
      Q.where('type', 'consumption'),
      Q.where('created_at', Q.gte(startDate.getTime())),
      Q.where('created_at', Q.lte(endDate.getTime())),
      Q.sortBy('created_at', Q.asc)
    )
    .fetch();

  // Get all items
  const itemIds = [...new Set(movements.map((m) => m.itemId))];

  if (itemIds.length === 0) {
    return [];
  }

  const items = await database
    .get<InventoryItemModel>('inventory_items')
    .query(Q.where('id', Q.oneOf(itemIds)))
    .fetch();

  const itemMap = new Map(items.map((item) => [item.id, item]));

  // Group by category and time bucket
  const categoryBuckets = groupByCategoryAndTime(
    movements,
    itemMap,
    bucketType
  );

  // Convert to TimeSerieCostData format
  return Array.from(categoryBuckets.entries()).map(([category, buckets]) => {
    const dataPoints = Array.from(buckets.entries())
      .map(([_key, data]) => {
        const dt = DateTime.fromJSDate(data.date);
        const label =
          bucketType === 'week' ? `W${dt.weekNumber}` : dt.toFormat('MMM');

        return {
          date: data.date,
          label,
          costMinor: data.costMinor,
          quantity: data.quantity,
        };
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    return { category, dataPoints };
  });
}

/**
 * Calculate total cost for a harvest task
 *
 * @param database - WatermelonDB instance
 * @param taskId - Task ID
 * @returns Harvest cost summary
 */
export async function getHarvestCostSummary(
  database: Database,
  taskId: string
): Promise<HarvestCostSummary> {
  // Query movements linked to task
  const movements = await database
    .get<InventoryMovementModel>('inventory_movements')
    .query(Q.where('task_id', taskId), Q.where('type', 'consumption'))
    .fetch();

  // Get all items
  const itemIds = [...new Set(movements.map((m) => m.itemId))];

  if (itemIds.length === 0) {
    return {
      taskId,
      totalCostMinor: 0,
      items: [],
      movementCount: 0,
    };
  }

  const items = await database
    .get<InventoryItemModel>('inventory_items')
    .query(Q.where('id', Q.oneOf(itemIds)))
    .fetch();

  const itemMap = new Map(items.map((item) => [item.id, item]));

  // Aggregate by item
  const itemCosts = new Map<
    string,
    { itemName: string; quantity: number; costMinor: number }
  >();

  let totalCostMinor = 0;

  for (const movement of movements) {
    const item = itemMap.get(movement.itemId);
    if (!item) continue;

    const quantity = Math.abs(movement.quantityDelta);
    const costPerUnit = movement.costPerUnitMinor ?? 0;
    const cost = quantity * costPerUnit;

    const current = itemCosts.get(item.id) ?? {
      itemName: item.name,
      quantity: 0,
      costMinor: 0,
    };

    current.quantity += quantity;
    current.costMinor += cost;

    itemCosts.set(item.id, current);
    totalCostMinor += cost;
  }

  // Convert to array
  const itemsArray = Array.from(itemCosts.entries()).map(([itemId, data]) => ({
    itemId,
    itemName: data.itemName,
    quantity: data.quantity,
    costMinor: data.costMinor,
  }));

  return {
    taskId,
    totalCostMinor,
    items: itemsArray,
    movementCount: movements.length,
  };
}

/**
 * Format cost from minor units to display string
 *
 * @param costMinor - Cost in minor units (cents)
 * @param currency - Currency symbol (default: '$')
 * @returns Formatted cost string
 */
export function formatCost(costMinor: number, currency: string = '$'): string {
  const dollars = costMinor / 100;
  return `${currency}${dollars.toFixed(2)}`;
}
