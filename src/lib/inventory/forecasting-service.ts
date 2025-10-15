/**
 * Forecasting Service
 *
 * Consumption forecasting engine using Simple Moving Average (SMA) and
 * Simple Exponential Smoothing (SES) for inventory stock predictions.
 *
 * Strategy:
 * - Default: 8-week SMA for all items
 * - Upgrade: SES when ≥12 weeks of consumption history available
 * - Confidence: High (≥12wk SES), Medium (8-12wk SMA), Low (<8wk or sparse)
 *
 * Requirements: 6.2, 6.3, 6.5, 6.6
 */

import type { Database } from '@nozbe/watermelondb';
import { Q } from '@nozbe/watermelondb';
import { DateTime } from 'luxon';

import type { InventoryItemModel } from '@/lib/watermelon-models/inventory-item';
import type { InventoryMovementModel } from '@/lib/watermelon-models/inventory-movement';

import type {
  ConsumptionDataPoint,
  ConsumptionRate,
  DaysToZeroForecast,
  ForecastingConfig,
  ReorderRecommendation,
  StockForecast,
} from './types/forecasting';

/** Default forecasting configuration */
const DEFAULT_CONFIG: ForecastingConfig = {
  smaWindowDays: 56, // 8 weeks
  smaMinDataPoints: 14, // 2 weeks minimum
  sesAlpha: 0.3,
  sesMinDays: 84, // 12 weeks
  safetyBufferPercent: 0.1, // 10%
  predictionIntervalZScore: 1.28, // 80% interval
};

export class ForecastingService {
  constructor(
    private database: Database,
    private config: ForecastingConfig = DEFAULT_CONFIG
  ) {}

  /**
   * Calculate consumption rate for an item
   *
   * Uses SMA by default, upgrades to SES when sufficient data available.
   *
   * @param itemId - Inventory item ID
   * @returns Consumption rate with confidence level
   */
  async calculateConsumptionRate(
    itemId: string
  ): Promise<ConsumptionRate | null> {
    const movements = await this.getConsumptionMovements(itemId);

    if (movements.length < this.config.smaMinDataPoints) {
      return null; // Insufficient data
    }

    const dataPoints = this.aggregateByDay(movements);
    const daySpan = this.calculateDaySpan(dataPoints);

    // Upgrade to SES if sufficient historical data
    if (daySpan >= this.config.sesMinDays) {
      return this.calculateSES(dataPoints);
    }

    // Default to SMA
    return this.calculateSMA(dataPoints);
  }

  /**
   * Calculate days until stock reaches zero
   *
   * @param itemId - Inventory item ID
   * @returns Days-to-zero forecast with prediction interval
   */
  async calculateDaysToZero(
    itemId: string
  ): Promise<DaysToZeroForecast | null> {
    const currentStock = await this.getCurrentStock(itemId);
    const rate = await this.calculateConsumptionRate(itemId);

    if (!rate || rate.dailyRate <= 0) {
      return {
        days: null,
        confidence: 'low',
        stockoutDate: null,
        usesSafetyBuffer: false,
      };
    }

    // Apply safety buffer
    const safetyBuffer = currentStock * this.config.safetyBufferPercent;
    const effectiveStock = Math.max(0, currentStock - safetyBuffer);

    const days = Math.floor(effectiveStock / rate.dailyRate);
    const stockoutDate = DateTime.now().plus({ days }).toJSDate();

    // Calculate prediction interval for SES
    let predictionInterval: [number, number] | undefined;
    if (rate.method === 'SES' && rate.standardDeviation) {
      const margin =
        this.config.predictionIntervalZScore * rate.standardDeviation;
      const lowerDays = Math.max(
        0,
        Math.floor((effectiveStock - margin) / rate.dailyRate)
      );
      const upperDays = Math.floor((effectiveStock + margin) / rate.dailyRate);
      predictionInterval = [lowerDays, upperDays];
    }

    return {
      days,
      predictionInterval,
      confidence: rate.confidence,
      stockoutDate,
      usesSafetyBuffer: true,
    };
  }

  /**
   * Generate reorder recommendation
   *
   * @param itemId - Inventory item ID
   * @returns Reorder recommendation or null if insufficient data
   */
  async generateReorderRecommendation(
    itemId: string
  ): Promise<ReorderRecommendation | null> {
    const item = await this.database
      .get<InventoryItemModel>('inventory_items')
      .find(itemId);

    const daysToZero = await this.calculateDaysToZero(itemId);
    const rate = await this.calculateConsumptionRate(itemId);

    if (
      !daysToZero ||
      daysToZero.days === null ||
      !rate ||
      rate.dailyRate <= 0
    ) {
      return null;
    }

    const leadTimeDays = item.leadTimeDays || 0;
    const reorderMultiple = item.reorderMultiple || 1;

    // Calculate quantity: cover usage until stockout + lead time
    const daysTocover = daysToZero.days + leadTimeDays;
    const rawQuantity = daysTocover * rate.dailyRate;
    const quantity = Math.ceil(rawQuantity / reorderMultiple) * reorderMultiple;

    // Reorder by: today + daysToZero - leadTime
    const daysUntilReorder = Math.max(1, daysToZero.days - leadTimeDays);
    const reorderByDate = DateTime.now()
      .plus({ days: daysUntilReorder })
      .toJSDate();

    const reasoning = `Based on ${rate.method} forecast of ${rate.dailyRate.toFixed(2)} ${item.unitOfMeasure}/day. Order ${quantity} ${item.unitOfMeasure} to cover ${daysTocover} days (including ${leadTimeDays}-day lead time).`;

    return {
      quantity,
      reorderByDate,
      reasoning,
      confidence: rate.confidence,
    };
  }

  /**
   * Get complete stock forecast for an item
   *
   * @param itemId - Inventory item ID
   * @returns Complete stock forecast
   */
  async getStockForecast(itemId: string): Promise<StockForecast | null> {
    const item = await this.database
      .get<InventoryItemModel>('inventory_items')
      .find(itemId);

    const currentStock = await this.getCurrentStock(itemId);
    const consumptionRate = await this.calculateConsumptionRate(itemId);
    const daysToZero = (await this.calculateDaysToZero(itemId)) || {
      days: null,
      confidence: 'low' as const,
      stockoutDate: null,
      usesSafetyBuffer: false,
    };
    const reorderRecommendation =
      await this.generateReorderRecommendation(itemId);

    return {
      itemId: item.id,
      itemName: item.name,
      currentStock,
      minStock: item.minStock,
      consumptionRate,
      daysToZero,
      reorderRecommendation,
      generatedAt: new Date(),
    };
  }

  // ========== Private Methods ==========

  /**
   * Get consumption movements for an item
   */
  private async getConsumptionMovements(
    itemId: string
  ): Promise<InventoryMovementModel[]> {
    return this.database
      .get<InventoryMovementModel>('inventory_movements')
      .query(
        Q.where('item_id', itemId),
        Q.where('type', 'consumption'),
        Q.sortBy('created_at', Q.asc)
      )
      .fetch();
  }

  /**
   * Get current stock level for an item
   */
  private async getCurrentStock(itemId: string): Promise<number> {
    const item = await this.database
      .get<InventoryItemModel>('inventory_items')
      .find(itemId);

    if (item.trackingMode === 'simple') {
      // Sum all movements
      const movements = await this.database
        .get<InventoryMovementModel>('inventory_movements')
        .query(Q.where('item_id', itemId))
        .fetch();

      return movements.reduce((sum, m) => sum + m.quantityDelta, 0);
    }

    // Batched mode: sum all batch quantities
    const batches = await this.database
      .get('inventory_batches')
      .query(Q.where('item_id', itemId), Q.where('deleted_at', Q.eq(null)))
      .fetch();

    return batches.reduce((sum: number, b: any) => sum + (b.quantity || 0), 0);
  }

  /**
   * Aggregate movements by day
   */
  private aggregateByDay(
    movements: InventoryMovementModel[]
  ): ConsumptionDataPoint[] {
    const dailyMap = new Map<string, number>();

    for (const movement of movements) {
      const dateKey = DateTime.fromJSDate(movement.createdAt).toISODate();
      if (!dateKey) continue;

      const current = dailyMap.get(dateKey) || 0;
      dailyMap.set(dateKey, current + Math.abs(movement.quantityDelta));
    }

    return Array.from(dailyMap.entries())
      .map(([dateStr, quantity]) => ({
        date: DateTime.fromISO(dateStr).toJSDate(),
        quantityConsumed: quantity,
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  /**
   * Calculate day span of data points
   */
  private calculateDaySpan(dataPoints: ConsumptionDataPoint[]): number {
    if (dataPoints.length < 2) return 0;

    const first = DateTime.fromJSDate(dataPoints[0].date);
    const last = DateTime.fromJSDate(dataPoints[dataPoints.length - 1].date);

    return last.diff(first, 'days').days;
  }

  /**
   * Calculate Simple Moving Average (SMA)
   */
  private calculateSMA(
    dataPoints: ConsumptionDataPoint[]
  ): ConsumptionRate | null {
    if (dataPoints.length < this.config.smaMinDataPoints) {
      return null;
    }

    // Use last N days up to smaWindowDays
    const windowStart = DateTime.now().minus({
      days: this.config.smaWindowDays,
    });
    const windowData = dataPoints.filter(
      (dp) => DateTime.fromJSDate(dp.date).valueOf() >= windowStart.valueOf()
    );

    if (windowData.length < this.config.smaMinDataPoints) {
      return null;
    }

    const totalQuantity = windowData.reduce(
      (sum, dp) => sum + dp.quantityConsumed,
      0
    );
    const daySpan = this.calculateDaySpan(windowData);
    const dailyRate = daySpan > 0 ? totalQuantity / daySpan : 0;

    // Calculate standard deviation
    const mean = dailyRate;
    const variance =
      windowData.reduce((sum, dp) => {
        const diff = dp.quantityConsumed - mean;
        return sum + diff * diff;
      }, 0) / windowData.length;
    const standardDeviation = Math.sqrt(variance);

    const confidence =
      daySpan >= this.config.sesMinDays
        ? 'medium'
        : daySpan >= this.config.smaWindowDays / 2
          ? 'medium'
          : 'low';

    return {
      dailyRate,
      method: 'SMA',
      confidence,
      dataPoints: windowData.length,
      standardDeviation,
    };
  }

  /**
   * Calculate Simple Exponential Smoothing (SES)
   */
  private calculateSES(
    dataPoints: ConsumptionDataPoint[]
  ): ConsumptionRate | null {
    if (dataPoints.length < this.config.smaMinDataPoints) {
      return null;
    }

    const alpha = this.config.sesAlpha;
    let forecast = dataPoints[0].quantityConsumed;
    const errors: number[] = [];

    // Apply exponential smoothing
    for (let i = 1; i < dataPoints.length; i++) {
      const actual = dataPoints[i].quantityConsumed;
      const error = actual - forecast;
      errors.push(error);
      forecast = alpha * actual + (1 - alpha) * forecast;
    }

    // Calculate standard deviation of errors for prediction interval
    const meanError = errors.reduce((sum, e) => sum + e, 0) / errors.length;
    const variance =
      errors.reduce((sum, e) => sum + (e - meanError) ** 2, 0) / errors.length;
    const standardDeviation = Math.sqrt(variance);

    return {
      dailyRate: forecast,
      method: 'SES',
      confidence: 'high', // SES only used when ≥12 weeks data
      dataPoints: dataPoints.length,
      standardDeviation,
    };
  }
}
