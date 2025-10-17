/**
 * Inventory Item Forecast Hook
 *
 * Fetches consumption history and generates forecasts for a single item.
 * Integrates with forecasting service for reorder recommendations.
 *
 * Requirements: 6.2, 6.3, 6.5, 6.6
 */

import { Q } from '@nozbe/watermelondb';
import { useDatabase } from '@nozbe/watermelondb/react';
import { useCallback, useEffect, useState } from 'react';

import type { InventoryMovementModel } from '@/lib/watermelon-models/inventory-movement';

import { ForecastingService } from './forecasting-service';
import type { ReorderRecommendation } from './types/forecasting';

export interface ConsumptionDataPoint {
  /** Movement timestamp */
  timestamp: number;
  /** Quantity consumed (positive value) */
  quantityUsed: number;
}

export interface UseInventoryItemForecastResult {
  /** Weekly consumption data for chart */
  consumptionHistory: ConsumptionDataPoint[];
  /** Forecast-based reorder recommendation */
  reorderRecommendation: ReorderRecommendation | null;
  /** Whether data is loading */
  isLoading: boolean;
  /** Error if forecast failed */
  error: Error | null;
  /** Refresh forecast data */
  refresh: () => Promise<void>;
}

/**
 * Hook to fetch consumption history and generate reorder forecast
 *
 * @param itemId - Inventory item ID
 *
 * @example
 * ```tsx
 * const { consumptionHistory, reorderRecommendation } =
 *   useInventoryItemForecast('abc123');
 * ```
 */
export function useInventoryItemForecast(
  itemId: string
): UseInventoryItemForecastResult {
  const database = useDatabase();
  const [consumptionHistory, setConsumptionHistory] = useState<
    ConsumptionDataPoint[]
  >([]);
  const [reorderRecommendation, setReorderRecommendation] =
    useState<ReorderRecommendation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadForecastData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load consumption movements (last 90 days for chart visibility)
      const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
      const movementsCollection = database.get<InventoryMovementModel>(
        'inventory_movements'
      );

      const movements = await movementsCollection
        .query(
          Q.where('item_id', itemId),
          Q.where('movement_type', 'consumption'),
          Q.where('created_at', Q.gte(ninetyDaysAgo)),
          Q.where('deleted_at', null),
          Q.sortBy('created_at', Q.asc)
        )
        .fetch();

      // Build consumption data points
      const dataPoints: ConsumptionDataPoint[] = movements.map((m) => ({
        timestamp: m.createdAt.getTime(),
        quantityUsed: Math.abs(m.quantityDelta),
      }));

      setConsumptionHistory(dataPoints);

      // Generate reorder recommendation
      const forecastService = new ForecastingService(database);
      const recommendation =
        await forecastService.generateReorderRecommendation(itemId);

      setReorderRecommendation(recommendation);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error('Failed to load forecast data')
      );
    } finally {
      setIsLoading(false);
    }
  }, [database, itemId]);

  useEffect(() => {
    loadForecastData();
  }, [loadForecastData]);

  return {
    consumptionHistory,
    reorderRecommendation,
    isLoading,
    error,
    refresh: loadForecastData,
  };
}
