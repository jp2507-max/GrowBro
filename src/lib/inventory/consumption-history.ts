/**
 * Consumption History Utilities
 *
 * Query and aggregate inventory consumption movements for history display.
 * Supports filtering by item, task, date range, and consumption type.
 *
 * Requirements:
 * - 3.5: Display consumption entries with dates, quantities, tasks, and costs
 */

import type { Database } from '@nozbe/watermelondb';
import { Q } from '@nozbe/watermelondb';
import { DateTime } from 'luxon';

import type { InventoryItemModel } from '@/lib/watermelon-models/inventory-item';
import type { InventoryMovementModel } from '@/lib/watermelon-models/inventory-movement';

/**
 * Consumption history entry for display
 */
export interface ConsumptionHistoryEntry {
  /** Movement ID */
  id: string;

  /** Item ID */
  itemId: string;

  /** Item name */
  itemName: string;

  /** Quantity consumed (absolute value) */
  quantity: number;

  /** Unit of measure */
  unit: string;

  /** Cost per unit in minor currency units (cents) */
  costPerUnitMinor: number;

  /** Total cost in minor currency units */
  totalCostMinor: number;

  /** Human-readable reason */
  reason: string;

  /** Linked task ID (null if manual) */
  taskId: string | null;

  /** Created timestamp */
  createdAt: Date;

  /** Movement type */
  type: 'consumption' | 'adjustment';
}

/**
 * Filters for consumption history query
 */
export interface ConsumptionHistoryFilters {
  /** Filter by item ID */
  itemId?: string;

  /** Filter by task ID */
  taskId?: string;

  /** Filter by date range (start) */
  startDate?: Date;

  /** Filter by date range (end) */
  endDate?: Date;

  /** Filter by consumption type */
  type?: 'consumption' | 'adjustment';

  /** Limit number of results */
  limit?: number;
}

/**
 * Get consumption history with filters
 *
 * @param database - WatermelonDB instance
 * @param filters - Query filters
 * @returns Array of consumption history entries
 */
export async function getConsumptionHistory(
  database: Database,
  filters: ConsumptionHistoryFilters = {}
): Promise<ConsumptionHistoryEntry[]> {
  // Build query with filters
  const conditions: any[] = [];

  // Only consumption and adjustment movements (exclude receipts)
  if (filters.type) {
    conditions.push(Q.where('type', filters.type));
  } else {
    conditions.push(Q.where('type', Q.oneOf(['consumption', 'adjustment'])));
  }

  // Filter by item ID
  if (filters.itemId) {
    conditions.push(Q.where('item_id', filters.itemId));
  }

  // Filter by task ID
  if (filters.taskId) {
    conditions.push(Q.where('task_id', filters.taskId));
  }

  // Filter by date range
  if (filters.startDate) {
    const startMs = filters.startDate.getTime();
    conditions.push(Q.where('created_at', Q.gte(startMs)));
  }

  if (filters.endDate) {
    const endMs = filters.endDate.getTime();
    conditions.push(Q.where('created_at', Q.lte(endMs)));
  }

  // Query movements
  let query = database
    .get<InventoryMovementModel>('inventory_movements')
    .query(...conditions, Q.sortBy('created_at', Q.desc));

  if (filters.limit) {
    query = query.extend(Q.take(filters.limit));
  }

  const movements = await query.fetch();

  // Fetch associated items for names and units
  const itemIds = [...new Set(movements.map((m) => m.itemId))];
  let items: InventoryItemModel[] = [];

  if (itemIds.length > 0) {
    items = await database
      .get<InventoryItemModel>('inventory_items')
      .query(Q.where('id', Q.oneOf(itemIds)))
      .fetch();
  }

  const itemMap = new Map(items.map((item) => [item.id, item]));

  // Map movements to history entries
  return movements.map((movement) => {
    const item = itemMap.get(movement.itemId);
    const quantity = Math.abs(movement.quantityDelta);
    const costPerUnit = movement.costPerUnitMinor ?? 0;
    const totalCost = quantity * costPerUnit;

    return {
      id: movement.id,
      itemId: movement.itemId,
      itemName: item?.name ?? 'Unknown Item',
      quantity,
      unit: item?.unitOfMeasure ?? '',
      costPerUnitMinor: costPerUnit,
      totalCostMinor: totalCost,
      reason: movement.reason,
      taskId: movement.taskId ?? null,
      createdAt: movement.createdAt,
      type: movement.type as 'consumption' | 'adjustment',
    };
  });
}

/**
 * Get consumption summary for an item
 *
 * @param database - WatermelonDB instance
 * @param itemId - Item ID
 * @param days - Number of days to look back (default 30)
 * @returns Consumption summary
 */
export async function getItemConsumptionSummary(
  database: Database,
  itemId: string,
  days: number = 30
): Promise<{
  totalQuantity: number;
  totalCostMinor: number;
  averagePerDay: number;
  entryCount: number;
}> {
  const safeDays = Math.max(1, Math.floor(days));
  const startDate = DateTime.now().minus({ days: safeDays }).toJSDate();

  const history = await getConsumptionHistory(database, {
    itemId,
    startDate,
    type: 'consumption',
  });

  const totalQuantity = history.reduce((sum, entry) => sum + entry.quantity, 0);
  const totalCostMinor = history.reduce(
    (sum, entry) => sum + entry.totalCostMinor,
    0
  );
  const averagePerDay = totalQuantity / safeDays;

  return {
    totalQuantity,
    totalCostMinor,
    averagePerDay,
    entryCount: history.length,
  };
}

/**
 * Get consumption by category
 *
 * @param database - WatermelonDB instance
 * @param filters - Query filters
 * @returns Map of category to total consumption
 */
export async function getConsumptionByCategory(
  database: Database,
  filters: Omit<ConsumptionHistoryFilters, 'itemId'> = {}
): Promise<Map<string, { quantity: number; costMinor: number }>> {
  const history = await getConsumptionHistory(database, filters);

  // Get all items to map categories
  const itemIds = [...new Set(history.map((h) => h.itemId))];

  // Short-circuit if no items to avoid invalid Q.oneOf([]) query
  if (itemIds.length === 0) {
    return new Map<string, { quantity: number; costMinor: number }>();
  }

  const items = await database
    .get<InventoryItemModel>('inventory_items')
    .query(Q.where('id', Q.oneOf(itemIds)))
    .fetch();

  const itemCategoryMap = new Map(
    items.map((item) => [item.id, item.category])
  );

  // Aggregate by category
  const categoryTotals = new Map<
    string,
    { quantity: number; costMinor: number }
  >();

  for (const entry of history) {
    const category = itemCategoryMap.get(entry.itemId) ?? 'Unknown';
    const current = categoryTotals.get(category) ?? {
      quantity: 0,
      costMinor: 0,
    };

    categoryTotals.set(category, {
      quantity: current.quantity + entry.quantity,
      costMinor: current.costMinor + entry.totalCostMinor,
    });
  }

  return categoryTotals;
}
