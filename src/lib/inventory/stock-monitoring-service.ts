/**
 * Stock Monitoring Service
 *
 * Detects low-stock items, calculates reorder recommendations,
 * and triggers notifications.
 *
 * Requirements: 4.1, 4.3, 4.4, 4.5, 4.6
 */

import type { Database } from '@nozbe/watermelondb';

import { ForecastingService } from './forecasting-service';
import type { StockForecast } from './types/forecasting';

export interface LowStockItem {
  itemId: string;
  name: string;
  category: string;
  unitOfMeasure: string;
  currentStock: number;
  minStock: number;
  daysToZero: number | null;
  percentBelowThreshold: number;
  forecast: StockForecast | null;
}

export class StockMonitoringService {
  private forecastingService: ForecastingService;

  constructor(private database: Database) {
    this.forecastingService = new ForecastingService(database);
  }

  /**
   * Check for low-stock items across all inventory
   *
   * Returns items where currentStock <= minStock,
   * sorted by urgency (days-to-zero ASC, then % below threshold DESC)
   *
   * @returns Array of low-stock items sorted by urgency
   */
  async checkLowStock(): Promise<LowStockItem[]> {
    // TODO: Implement in Step 2
    // 1. Query all items from inventory_items table
    // 2. For each item, calculate currentStock from batches/movements
    // 3. Filter where currentStock <= minStock
    // 4. For each low-stock item:
    //    - Call forecastingService.getStockForecast()
    //    - Calculate percentBelowThreshold
    // 5. Sort by daysToZero ASC NULLS LAST, percentBelowThreshold DESC
    return [];
  }

  /**
   * Get detailed forecast for a single item
   *
   * @param itemId - Inventory item ID
   * @returns Stock forecast or null
   */
  async getItemForecast(itemId: string): Promise<StockForecast | null> {
    return this.forecastingService.getStockForecast(itemId);
  }

  /**
   * Check if an item is currently low on stock
   *
   * @param _itemId - Inventory item ID
   * @returns True if currentStock <= minStock
   */
  async isLowStock(_itemId: string): Promise<boolean> {
    // TODO: Implement in Step 2
    return false;
  }

  /**
   * Calculate percentage below threshold
   *
   * @param currentStock - Current stock level
   * @param minStock - Minimum threshold
   * @returns Percentage below (0-100)
   */
  calculatePercentBelowThreshold(
    currentStock: number,
    minStock: number
  ): number {
    if (minStock === 0) return 0;
    if (currentStock >= minStock) return 0;

    return ((minStock - currentStock) / minStock) * 100;
  }
}
