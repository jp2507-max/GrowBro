/**
 * Performance Time Series Uploader
 *
 * Uploads performance metrics to Sentry as custom measurements
 * for trend analysis and dashboard visualization.
 *
 * Requirements: Spec 21, Task 12 - Performance Trend Analysis
 */

import * as Sentry from '@sentry/react-native';

import { isSentryPerformanceInitialized } from './sentry-integration';
import type { PerformanceTimeSeriesPoint } from './trend-analysis';

/**
 * Upload configuration for time series data
 */
export interface TimeSeriesUploadConfig {
  batchSize?: number; // Number of points to upload in a single batch (default: 50)
  retryAttempts?: number; // Number of retry attempts on failure (default: 3)
  retryDelayMs?: number; // Delay between retries in milliseconds (default: 1000)
}

/**
 * Result of time series upload operation
 */
export interface TimeSeriesUploadResult {
  success: boolean;
  pointsUploaded: number;
  errors: string[];
}

/**
 * Upload a single performance metric to Sentry
 *
 * @param point - Time series data point
 * @returns True if upload succeeded
 */
export function uploadMetricPoint(point: PerformanceTimeSeriesPoint): boolean {
  if (!isSentryPerformanceInitialized()) {
    return false;
  }

  try {
    // Set custom measurement on current transaction
    Sentry.setMeasurement(point.metric, point.value, 'millisecond');

    // Add context tags for filtering
    Sentry.setTag('device', point.device);
    Sentry.setTag('platform', point.platform);
    Sentry.setTag('build_hash', point.buildHash);

    // Add timestamp as context
    Sentry.setContext('performance_metric', {
      metric: point.metric,
      value: point.value,
      timestamp: point.timestamp,
      device: point.device,
      platform: point.platform,
      buildHash: point.buildHash,
    });

    return true;
  } catch (error) {
    console.error('Failed to upload metric point:', error);
    return false;
  }
}

/**
 * Upload multiple performance metrics to Sentry in batches
 *
 * @param points - Array of time series data points
 * @param config - Upload configuration
 * @returns Upload result with success status and error details
 */
export async function uploadTimeSeriesBatch(
  points: PerformanceTimeSeriesPoint[],
  config: TimeSeriesUploadConfig = {}
): Promise<TimeSeriesUploadResult> {
  const batchSize = config.batchSize ?? 50;
  const retryAttempts = config.retryAttempts ?? 3;
  const retryDelayMs = config.retryDelayMs ?? 1000;

  if (!isSentryPerformanceInitialized()) {
    return {
      success: false,
      pointsUploaded: 0,
      errors: ['Sentry performance monitoring not initialized'],
    };
  }

  const errors: string[] = [];
  let pointsUploaded = 0;

  // Process points in batches
  for (let i = 0; i < points.length; i += batchSize) {
    const batch = points.slice(i, i + batchSize);

    // Retry logic for each batch
    let attempt = 0;
    let batchSuccess = false;

    while (attempt < retryAttempts && !batchSuccess) {
      try {
        // Upload each point in the batch
        for (const point of batch) {
          const success = uploadMetricPoint(point);
          if (success) {
            pointsUploaded++;
          } else {
            errors.push(`Failed to upload metric: ${point.metric}`);
          }
        }

        batchSuccess = true;
      } catch (error) {
        attempt++;
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Batch upload attempt ${attempt} failed: ${errorMessage}`);

        if (attempt < retryAttempts) {
          // Wait before retrying
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        }
      }
    }
  }

  return {
    success: errors.length === 0,
    pointsUploaded,
    errors,
  };
}

/**
 * Options for creating a time series point
 */
export interface CreateTimeSeriesPointOptions {
  buildHash: string;
  device: string;
  platform: 'ios' | 'android';
}

/**
 * Create a time series point from performance metrics
 *
 * @param metric - Metric name
 * @param value - Metric value
 * @param options - Additional options for the point
 * @returns Time series data point
 */
export function createTimeSeriesPoint(
  metric: string,
  value: number,
  options: CreateTimeSeriesPointOptions
): PerformanceTimeSeriesPoint {
  return {
    timestamp: Date.now(),
    metric,
    value,
    buildHash: options.buildHash,
    device: options.device,
    platform: options.platform,
  };
}

/**
 * Upload performance metrics from CI test results
 *
 * @param metrics - Map of metric name to value
 * @param options - Additional options for the upload
 * @returns Upload result
 */
export async function uploadCIMetrics(
  metrics: Map<string, number>,
  options: CreateTimeSeriesPointOptions
): Promise<TimeSeriesUploadResult> {
  const points: PerformanceTimeSeriesPoint[] = [];

  for (const [metric, value] of metrics.entries()) {
    points.push(createTimeSeriesPoint(metric, value, options));
  }

  return uploadTimeSeriesBatch(points);
}

/**
 * Upload metrics with transaction context
 *
 * Creates a Sentry transaction to group related metrics together
 *
 * @param transactionName - Name of the transaction
 * @param points - Time series data points
 * @param config - Upload configuration
 * @returns Upload result
 */
export async function uploadWithTransaction(
  transactionName: string,
  points: PerformanceTimeSeriesPoint[],
  config: TimeSeriesUploadConfig = {}
): Promise<TimeSeriesUploadResult> {
  if (!isSentryPerformanceInitialized()) {
    return {
      success: false,
      pointsUploaded: 0,
      errors: ['Sentry performance monitoring not initialized'],
    };
  }

  return Sentry.startSpan(
    {
      op: 'performance.upload',
      name: transactionName,
    },
    async () => {
      return uploadTimeSeriesBatch(points, config);
    }
  );
}
