/**
 * Chart Data Utilities
 *
 * Utilities for filtering, aggregating, and transforming harvest data for charts
 *
 * Requirements:
 * - 4.3: Plant-specific filtering
 * - 4.4: Batch aggregation
 */

import type { ChartDataPoint, HarvestStage, TimeRange } from '@/types/harvest';

/**
 * Filter chart data by plant ID
 *
 * Requirement 4.3: Plant-specific view
 *
 * @param data - Array of chart data points
 * @param plantId - Plant ID to filter by
 * @returns Filtered array containing only data for the specified plant
 */
export function filterByPlant(
  data: ChartDataPoint[],
  plantId: string
): ChartDataPoint[] {
  return data.filter((point) => point.plant_id === plantId);
}

/**
 * Aggregate weights by date across multiple plants (batch view)
 *
 * Requirement 4.4: Batch aggregation
 *
 * @param data - Array of chart data points from multiple plants
 * @returns Aggregated data with combined weights per date
 */
export function aggregateByDate(data: ChartDataPoint[]): ChartDataPoint[] {
  // Group by date (normalized to day)
  const grouped = new Map<string, ChartDataPoint[]>();

  for (const point of data) {
    const dateKey = point.date.toISOString().split('T')[0]; // YYYY-MM-DD
    if (!grouped.has(dateKey)) {
      grouped.set(dateKey, []);
    }
    grouped.get(dateKey)!.push(point);
  }

  // Aggregate weights for each date
  const aggregated: ChartDataPoint[] = [];

  for (const [dateKey, points] of grouped.entries()) {
    const totalWeight = points.reduce((sum, p) => sum + p.weight_g, 0);

    // Use first point's stage (or most common stage if needed)
    const stage = points[0].stage;

    aggregated.push({
      date: new Date(dateKey),
      weight_g: totalWeight,
      stage,
      // plant_id is omitted for batch view
    });
  }

  // Sort by date ascending
  return aggregated.sort((a, b) => a.date.getTime() - b.date.getTime());
}

/**
 * Filter data by time range
 *
 * @param data - Array of chart data points
 * @param range - Time range to filter ('7d', '30d', '90d', '365d', 'all')
 * @returns Filtered array within the specified time range
 */
export function filterByTimeRange(
  data: ChartDataPoint[],
  range: TimeRange
): ChartDataPoint[] {
  if (range === 'all') {
    return data;
  }

  const now = new Date();
  const daysMap: Record<Exclude<TimeRange, 'all'>, number> = {
    '7d': 7,
    '30d': 30,
    '90d': 90,
    '365d': 365,
  };

  const daysToSubtract = daysMap[range];
  const cutoffDate = new Date(now);
  cutoffDate.setDate(cutoffDate.getDate() - daysToSubtract);

  return data.filter((point) => point.date >= cutoffDate);
}

/**
 * Convert harvest data to chart data points
 *
 * @param harvests - Array of harvest records
 * @param weightField - Which weight field to use ('wet_weight_g' | 'dry_weight_g' | 'trimmings_weight_g')
 * @returns Array of chart data points
 */
export function harvestsToChartData(
  harvests: {
    stage_started_at: Date;
    stage: HarvestStage;
    wet_weight_g?: number;
    dry_weight_g?: number;
    trimmings_weight_g?: number;
    plant_id?: string;
  }[],
  weightField:
    | 'wet_weight_g'
    | 'dry_weight_g'
    | 'trimmings_weight_g' = 'dry_weight_g'
): ChartDataPoint[] {
  return harvests
    .filter((h) => h[weightField] !== null && h[weightField] !== undefined)
    .map((h) => ({
      date: h.stage_started_at,
      weight_g: h[weightField]!,
      stage: h.stage,
      plant_id: h.plant_id,
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

/**
 * Get time range label for display
 *
 * @param range - Time range
 * @returns Display label
 */
export function getTimeRangeLabel(range: TimeRange): string {
  const labels: Record<TimeRange, string> = {
    '7d': 'Last 7 days',
    '30d': 'Last 30 days',
    '90d': 'Last 90 days',
    '365d': 'Last year',
    all: 'All time',
  };
  return labels[range];
}

/**
 * Get time range days count
 *
 * @param range - Time range
 * @returns Number of days, or null for 'all'
 */
export function getTimeRangeDays(range: TimeRange): number | null {
  const daysMap: Record<TimeRange, number | null> = {
    '7d': 7,
    '30d': 30,
    '90d': 90,
    '365d': 365,
    all: null,
  };
  return daysMap[range];
}
