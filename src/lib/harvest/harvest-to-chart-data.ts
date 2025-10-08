/**
 * Helper: Transform harvest records to chart data points
 *
 * Ensures proper type conversion for HarvestModal historicalData prop
 */

import type { ChartDataPoint, Harvest, HarvestStage } from '@/types/harvest';

/**
 * Convert harvest records to chart data points with proper types
 *
 * @param harvests - Array of harvest records from database
 * @returns Properly typed chart data points
 *
 * @example
 * ```tsx
 * const harvests = await getHarvestsForPlant(plantId);
 * const chartData = harvestsToChartDataPoints(harvests);
 *
 * <HarvestModal
 *   plantId={plantId}
 *   historicalData={chartData}
 *   // ... other props
 * />
 * ```
 */
export function harvestsToChartDataPoints(
  harvests: Harvest[]
): ChartDataPoint[] {
  return harvests
    .filter((h) => h.deleted_at === null)
    .map((harvest) => ({
      date: new Date(harvest.stage_started_at),
      weight_g: harvest.dry_weight_g || harvest.wet_weight_g || 0,
      stage: harvest.stage as HarvestStage,
      plant_id: harvest.plant_id,
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}
