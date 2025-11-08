/**
 * Performance Trend Analysis
 *
 * Implements 7-day moving average calculation and regression detection
 * for performance metrics. Detects when performance degrades by >10%
 * compared to the moving average baseline.
 *
 * Requirements: Spec 21, Task 12 - Performance Trend Analysis
 */

import type { PerformanceMetricCategory } from './sentry-dashboard-config';
import { SENTRY_DASHBOARD_CONFIG } from './sentry-dashboard-config';

/**
 * Time series data point for performance metrics
 */
export interface PerformanceTimeSeriesPoint {
  timestamp: number; // Unix timestamp in milliseconds
  metric: string; // Metric name (e.g., 'startup.tti', 'scroll.avgFps')
  value: number; // Metric value
  buildHash: string; // Git commit hash
  device: string; // Device model
  platform: 'ios' | 'android';
}

/**
 * Result of trend analysis for a specific metric
 */
export interface TrendAnalysisResult {
  metric: string;
  currentValue: number;
  movingAverage: number;
  delta: number; // Percentage change from moving average
  exceedsThreshold: boolean; // True if delta > threshold
  dataPoints: number; // Number of data points used in calculation
  windowDays: number;
  threshold: number;
}

/**
 * Configuration for trend analysis
 */
export interface TrendAnalysisConfig {
  windowDays: number; // Number of days for moving average
  deltaThreshold: number; // Percentage threshold (0.1 = 10%)
  minDataPoints?: number; // Minimum data points required (default: 3)
}

/**
 * Calculate 7-day moving average for a metric
 *
 * @param dataPoints - Time series data points sorted by timestamp (oldest first)
 * @param windowDays - Number of days for moving average window
 * @returns Moving average value or null if insufficient data
 */
export function calculateMovingAverage(
  dataPoints: PerformanceTimeSeriesPoint[],
  windowDays: number = 7
): number | null {
  if (dataPoints.length === 0) {
    return null;
  }

  // Calculate window start time (windowDays ago from most recent point)
  const mostRecentTimestamp = dataPoints[dataPoints.length - 1].timestamp;
  const windowStartTime =
    mostRecentTimestamp - windowDays * 24 * 60 * 60 * 1000;

  // Filter data points within the window
  const windowPoints = dataPoints.filter(
    (point) => point.timestamp >= windowStartTime
  );

  if (windowPoints.length === 0) {
    return null;
  }

  // Calculate average
  const sum = windowPoints.reduce((acc, point) => acc + point.value, 0);
  return sum / windowPoints.length;
}

/**
 * Calculate percentage delta between current value and baseline
 *
 * @param currentValue - Current metric value
 * @param baseline - Baseline value (e.g., moving average)
 * @returns Percentage change (0.1 = 10% increase)
 */
export function calculateDelta(currentValue: number, baseline: number): number {
  if (baseline === 0) {
    return currentValue === 0 ? 0 : 1; // 100% increase if baseline is 0
  }

  return (currentValue - baseline) / baseline;
}

/**
 * Analyze performance trend for a specific metric
 *
 * @param dataPoints - Historical time series data (sorted by timestamp, oldest first)
 * @param currentValue - Current metric value to compare
 * @param config - Trend analysis configuration
 * @returns Trend analysis result
 */
export function analyzeTrend(
  dataPoints: PerformanceTimeSeriesPoint[],
  currentValue: number,
  config: TrendAnalysisConfig = SENTRY_DASHBOARD_CONFIG.trendAnalysis
): TrendAnalysisResult {
  const minDataPoints = config.minDataPoints ?? 3;

  // Require minimum data points for reliable analysis
  if (dataPoints.length < minDataPoints) {
    return {
      metric: dataPoints[0]?.metric || 'unknown',
      currentValue,
      movingAverage: currentValue,
      delta: 0,
      exceedsThreshold: false,
      dataPoints: dataPoints.length,
      windowDays: config.windowDays,
      threshold: config.deltaThreshold,
    };
  }

  const movingAverage = calculateMovingAverage(dataPoints, config.windowDays);

  if (movingAverage === null) {
    return {
      metric: dataPoints[0]?.metric || 'unknown',
      currentValue,
      movingAverage: currentValue,
      delta: 0,
      exceedsThreshold: false,
      dataPoints: dataPoints.length,
      windowDays: config.windowDays,
      threshold: config.deltaThreshold,
    };
  }

  const delta = calculateDelta(currentValue, movingAverage);
  const exceedsThreshold = Math.abs(delta) > config.deltaThreshold;

  return {
    metric: dataPoints[0]?.metric || 'unknown',
    currentValue,
    movingAverage,
    delta,
    exceedsThreshold,
    dataPoints: dataPoints.length,
    windowDays: config.windowDays,
    threshold: config.deltaThreshold,
  };
}

/**
 * Analyze trends for multiple metrics
 *
 * @param metricData - Map of metric name to time series data
 * @param currentValues - Map of metric name to current value
 * @param config - Trend analysis configuration
 * @returns Map of metric name to trend analysis result
 */
export function analyzeMultipleMetrics(
  metricData: Map<string, PerformanceTimeSeriesPoint[]>,
  currentValues: Map<string, number>,
  config: TrendAnalysisConfig = SENTRY_DASHBOARD_CONFIG.trendAnalysis
): Map<string, TrendAnalysisResult> {
  const results = new Map<string, TrendAnalysisResult>();

  for (const [metric, dataPoints] of metricData.entries()) {
    const currentValue = currentValues.get(metric);

    if (currentValue === undefined) {
      continue;
    }

    const result = analyzeTrend(dataPoints, currentValue, config);
    results.set(metric, result);
  }

  return results;
}

/**
 * Filter metrics that exceed the regression threshold
 *
 * @param results - Trend analysis results
 * @returns Array of metrics that exceed threshold
 */
export function filterRegressions(
  results: Map<string, TrendAnalysisResult>
): TrendAnalysisResult[] {
  return Array.from(results.values()).filter(
    (result) => result.exceedsThreshold
  );
}

/**
 * Format trend analysis result for logging/reporting
 *
 * @param result - Trend analysis result
 * @returns Formatted string
 */
export function formatTrendResult(result: TrendAnalysisResult): string {
  const deltaPercent = (result.delta * 100).toFixed(1);
  const direction = result.delta > 0 ? 'increased' : 'decreased';
  const status = result.exceedsThreshold ? '⚠️ REGRESSION' : '✓ OK';

  return (
    `${status} ${result.metric}: ${result.currentValue.toFixed(2)} ` +
    `(${direction} ${Math.abs(parseFloat(deltaPercent))}% from ${result.movingAverage.toFixed(2)} MA)`
  );
}

/**
 * Group time series points by metric name
 *
 * @param dataPoints - Array of time series data points
 * @returns Map of metric name to sorted data points
 */
export function groupByMetric(
  dataPoints: PerformanceTimeSeriesPoint[]
): Map<string, PerformanceTimeSeriesPoint[]> {
  const grouped = new Map<string, PerformanceTimeSeriesPoint[]>();

  for (const point of dataPoints) {
    const existing = grouped.get(point.metric) || [];
    existing.push(point);
    grouped.set(point.metric, existing);
  }

  // Sort each group by timestamp (oldest first)
  for (const [metric, points] of grouped.entries()) {
    points.sort((a, b) => a.timestamp - b.timestamp);
    grouped.set(metric, points);
  }

  return grouped;
}

/**
 * Get metrics for a specific category
 *
 * @param category - Performance metric category
 * @returns Array of metric names for the category
 */
export function getMetricsForCategory(
  category: PerformanceMetricCategory
): string[] {
  switch (category) {
    case 'startup':
      return ['startup.tti', 'startup.ttfd'];
    case 'navigation':
      return ['navigation.p95', 'navigation.avg'];
    case 'scroll':
      return [
        'scroll.avgFps',
        'scroll.p95FrameTime',
        'scroll.droppedFramesPct',
        'scroll.jankCount',
      ];
    case 'sync':
      return ['sync.p95', 'sync.avg'];
    default:
      return [];
  }
}
