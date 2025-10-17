/**
 * Forecasting Types
 *
 * Type definitions for consumption forecasting and stock predictions.
 *
 * Requirements: 6.2, 6.3, 6.5, 6.6
 */

export type ForecastMethod = 'SMA' | 'SES';

export type ForecastConfidence = 'high' | 'medium' | 'low';

/**
 * Consumption rate forecast result
 */
export interface ConsumptionRate {
  /** Average daily consumption rate */
  dailyRate: number;

  /** Forecast method used */
  method: ForecastMethod;

  /** Confidence level based on data completeness */
  confidence: ForecastConfidence;

  /** Number of days of historical data used */
  dataPoints: number;

  /** Standard deviation of consumption (for variance analysis) */
  standardDeviation?: number;
}

/**
 * Days-to-zero stock prediction
 */
export interface DaysToZeroForecast {
  /** Predicted days until stock reaches zero (null if insufficient data) */
  days: number | null;

  /** 80% prediction interval [lower, upper] for SES forecasts */
  predictionInterval?: [number, number];

  /** Confidence level */
  confidence: ForecastConfidence;

  /** Date when stock predicted to reach zero */
  stockoutDate: Date | null;

  /** Whether calculation included safety buffer */
  usesSafetyBuffer: boolean;
}

/**
 * Reorder recommendation
 */
export interface ReorderRecommendation {
  /** Recommended order quantity (aligned to reorder multiple) */
  quantity: number;

  /** Date by which item should be reordered */
  reorderByDate: Date;

  /** Explanation of calculation */
  reasoning: string;

  /** Confidence in recommendation */
  confidence: ForecastConfidence;
}

/**
 * Complete stock forecast for an item
 */
export interface StockForecast {
  itemId: string;
  itemName: string;
  currentStock: number;
  minStock: number;
  consumptionRate: ConsumptionRate | null;
  daysToZero: DaysToZeroForecast;
  reorderRecommendation: ReorderRecommendation | null;
  generatedAt: Date;
}

/**
 * Historical consumption data point for forecasting
 */
export interface ConsumptionDataPoint {
  date: Date;
  quantityConsumed: number;
}

/**
 * Forecasting service configuration
 */
export interface ForecastingConfig {
  /** SMA window size in days (default: 56 = 8 weeks) */
  smaWindowDays: number;

  /** Minimum data points required for SMA (default: 14 = 2 weeks) */
  smaMinDataPoints: number;

  /** SES alpha smoothing factor (default: 0.3) */
  sesAlpha: number;

  /** Minimum days required for SES upgrade (default: 84 = 12 weeks) */
  sesMinDays: number;

  /** Safety buffer percentage (default: 0.1 = 10%) */
  safetyBufferPercent: number;

  /** Z-score for 80% prediction interval (default: 1.28) */
  predictionIntervalZScore: number;
}
