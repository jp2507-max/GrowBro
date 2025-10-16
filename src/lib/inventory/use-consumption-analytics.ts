/**
 * Consumption Analytics Hook
 *
 * React hook for fetching consumption history with advanced filtering
 * and cost analysis. Integrates with forecasting service for usage patterns.
 *
 * Requirements:
 * - 6.1: Display consumption entries with dates, quantities, tasks, costs
 * - 6.3: Calculate consumption rates using SMA/SES
 * - 9.4: Display quantity and cost with preserved batch valuation
 */

import { useDatabase } from '@nozbe/watermelondb/react';
import { useCallback, useEffect, useState } from 'react';

import {
  type ConsumptionHistoryEntry,
  type ConsumptionHistoryFilters,
  getConsumptionByCategory,
  getConsumptionHistory,
} from './consumption-history';
import {
  type CategoryCostSummary,
  getCategoryCostSummaries,
  getItemCostSummary,
  type ItemCostSummary,
} from './cost-analysis-service';
import { ForecastingService } from './forecasting-service';
import type { ConsumptionRate } from './types/forecasting';

/**
 * Consumption analytics filters
 */
export interface ConsumptionAnalyticsFilters {
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
 * Consumption analytics result
 */
export interface ConsumptionAnalyticsResult {
  /** Consumption history entries */
  history: ConsumptionHistoryEntry[];

  /** Item cost summary (when filtered by itemId) */
  itemCostSummary: ItemCostSummary | null;

  /** Category cost summaries */
  categorySummaries: CategoryCostSummary[];

  /** Category totals map */
  categoryTotals: Map<string, { quantity: number; costMinor: number }>;

  /** Consumption rate (when filtered by itemId) */
  consumptionRate: ConsumptionRate | null;

  /** Loading state */
  isLoading: boolean;

  /** Error state */
  error: Error | null;

  /** Refresh data */
  refresh: () => Promise<void>;
}

/**
 * Load analytics data for filters
 */
async function loadAnalyticsData(
  database: any,
  filters: ConsumptionAnalyticsFilters
) {
  // Convert filters to consumption history filters
  const historyFilters: ConsumptionHistoryFilters = {
    itemId: filters.itemId,
    taskId: filters.taskId,
    startDate: filters.startDate,
    endDate: filters.endDate,
    type: filters.type,
    limit: filters.limit,
  };

  // Fetch consumption history
  const historyData = await getConsumptionHistory(database, historyFilters);

  // Fetch item cost summary if filtering by item
  let itemSummary: ItemCostSummary | null = null;
  let rate: ConsumptionRate | null = null;

  if (filters.itemId) {
    itemSummary = await getItemCostSummary(database, filters.itemId, {
      startDate: filters.startDate,
      endDate: filters.endDate,
    });

    // Fetch consumption rate for item
    const forecastService = new ForecastingService(database);
    rate = await forecastService.calculateConsumptionRate(filters.itemId);
  }

  // Fetch category summaries
  const catSummaries = await getCategoryCostSummaries(database, {
    startDate: filters.startDate,
    endDate: filters.endDate,
  });

  // Fetch category totals
  const catTotals = await getConsumptionByCategory(database, {
    startDate: filters.startDate,
    endDate: filters.endDate,
    taskId: filters.taskId,
    type: filters.type,
  });

  return {
    history: historyData,
    itemCostSummary: itemSummary,
    categorySummaries: catSummaries,
    categoryTotals: catTotals,
    consumptionRate: rate,
  };
}

/**
 * Hook to fetch consumption analytics with advanced filtering
 *
 * @param filters - Analytics filters
 * @returns Consumption analytics data
 *
 * @example
 * ```tsx
 * const { history, categorySummaries, consumptionRate } = useConsumptionAnalytics({
 *   itemId: 'abc123',
 *   startDate: new Date('2024-01-01'),
 *   endDate: new Date('2024-12-31')
 * });
 * ```
 */
export function useConsumptionAnalytics(
  filters: ConsumptionAnalyticsFilters = {}
): ConsumptionAnalyticsResult {
  const database = useDatabase();

  const [history, setHistory] = useState<ConsumptionHistoryEntry[]>([]);
  const [itemCostSummary, setItemCostSummary] =
    useState<ItemCostSummary | null>(null);
  const [categorySummaries, setCategorySummaries] = useState<
    CategoryCostSummary[]
  >([]);
  const [categoryTotals, setCategoryTotals] = useState<
    Map<string, { quantity: number; costMinor: number }>
  >(new Map());
  const [consumptionRate, setConsumptionRate] =
    useState<ConsumptionRate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadAnalytics = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const result = await loadAnalyticsData(database, filters);

      setHistory(result.history);
      setItemCostSummary(result.itemCostSummary);
      setCategorySummaries(result.categorySummaries);
      setCategoryTotals(result.categoryTotals);
      setConsumptionRate(result.consumptionRate);
    } catch (err) {
      setError(
        err instanceof Error
          ? err
          : new Error('Failed to load consumption analytics')
      );
    } finally {
      setIsLoading(false);
    }
  }, [database, filters]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  return {
    history,
    itemCostSummary,
    categorySummaries,
    categoryTotals,
    consumptionRate,
    isLoading,
    error,
    refresh: loadAnalytics,
  };
}
