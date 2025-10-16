/**
 * Harvest Cost Calculator
 *
 * Calculates supply costs for harvest tasks by querying movements
 * linked to task_id and summing costs with FIFO valuation integrity.
 *
 * Requirements:
 * - 9.3: FIFO costing at batch level
 * - 9.4: Preserved batch valuation in movements
 */

import type { Database } from '@nozbe/watermelondb';

import {
  getHarvestCostSummary,
  type HarvestCostSummary,
} from './cost-analysis-service';

/**
 * Calculate total supply cost for a harvest task
 *
 * Queries all consumption movements linked to the task and sums
 * costs using preserved batch valuations (FIFO integrity).
 *
 * @param database - WatermelonDB instance
 * @param taskId - Harvest task ID
 * @returns Harvest cost summary with item breakdown
 *
 * @example
 * ```typescript
 * const costSummary = await calculateHarvestCost(database, 'task-123');
 * console.log(`Total harvest cost: $${costSummary.totalCostMinor / 100}`);
 * ```
 */
export async function calculateHarvestCost(
  database: Database,
  taskId: string
): Promise<HarvestCostSummary> {
  return getHarvestCostSummary(database, taskId);
}

/**
 * Calculate costs for multiple harvest tasks
 *
 * @param database - WatermelonDB instance
 * @param taskIds - Array of task IDs
 * @returns Array of harvest cost summaries
 *
 * @example
 * ```typescript
 * const summaries = await calculateMultipleHarvestCosts(database, ['task-1', 'task-2']);
 * const totalCost = summaries.reduce((sum, s) => sum + s.totalCostMinor, 0);
 * ```
 */
export async function calculateMultipleHarvestCosts(
  database: Database,
  taskIds: string[]
): Promise<HarvestCostSummary[]> {
  return Promise.all(
    taskIds.map((taskId) => getHarvestCostSummary(database, taskId))
  );
}

/**
 * Get average cost per harvest over a set of tasks
 *
 * @param database - WatermelonDB instance
 * @param taskIds - Array of task IDs
 * @returns Average cost in minor units
 */
export async function getAverageHarvestCost(
  database: Database,
  taskIds: string[]
): Promise<number> {
  if (taskIds.length === 0) return 0;

  const summaries = await calculateMultipleHarvestCosts(database, taskIds);
  const totalCost = summaries.reduce((sum, s) => sum + s.totalCostMinor, 0);

  return Math.round(totalCost / taskIds.length);
}
