/**
 * Automatic Rollback Monitoring
 *
 * Monitors model performance and triggers automatic rollback on error rate spikes:
 * - Tracks error rates per model version
 * - Compares against rollback threshold
 * - Triggers rollback to previous stable version
 * - Alerts ops team
 *
 * Requirements:
 * - 10.2: Automatic rollback on error rates
 * - 9.3: Shadow mode testing and rollback capability
 */

import { storage } from '@/lib/storage';

import type { ModelRemoteConfig } from './model-remote-config';

type ErrorMetric = {
  modelVersion: string;
  timestamp: number;
  errorCode: string;
  category: string;
};

type ModelMetrics = {
  version: string;
  totalRequests: number;
  errorCount: number;
  errorRate: number;
  lastUpdated: number;
};

const METRICS_STORAGE_KEY = 'assessment.model-metrics.v1';
const METRICS_WINDOW_MS = 60 * 60 * 1000; // 1 hour rolling window
const MIN_REQUESTS_FOR_ROLLBACK = 10; // Minimum requests before considering rollback

/**
 * Record an error for a specific model version
 */
export function recordModelError(
  modelVersion: string,
  errorCode: string,
  category: string
): void {
  try {
    const metrics = loadMetrics();
    const error: ErrorMetric = {
      modelVersion,
      timestamp: Date.now(),
      errorCode,
      category,
    };

    // Add to error log
    const errors = metrics.errors || [];
    errors.push(error);

    // Keep only recent errors (within window)
    const cutoff = Date.now() - METRICS_WINDOW_MS;
    const recentErrors = errors.filter((e) => e.timestamp > cutoff);

    saveMetrics({
      ...metrics,
      errors: recentErrors,
      lastUpdated: Date.now(),
    });
  } catch (error) {
    console.error('[RollbackMonitor] Failed to record error:', error);
  }
}

/**
 * Record a successful request for a specific model version
 */
export function recordModelSuccess(modelVersion: string): void {
  try {
    const metrics = loadMetrics();
    const success = {
      modelVersion,
      timestamp: Date.now(),
    };

    // Add to success log
    const successes = metrics.successes || [];
    successes.push(success);

    // Keep only recent successes (within window)
    const cutoff = Date.now() - METRICS_WINDOW_MS;
    const recentSuccesses = successes.filter((s) => s.timestamp > cutoff);

    saveMetrics({
      ...metrics,
      successes: recentSuccesses,
      lastUpdated: Date.now(),
    });
  } catch (error) {
    console.error('[RollbackMonitor] Failed to record success:', error);
  }
}

/**
 * Calculate error rate for a specific model version
 */
export function calculateErrorRate(modelVersion: string): ModelMetrics {
  const metrics = loadMetrics();
  const cutoff = Date.now() - METRICS_WINDOW_MS;

  // Filter recent requests for this version
  const recentErrors = (metrics.errors || []).filter(
    (e) => e.modelVersion === modelVersion && e.timestamp > cutoff
  );

  const recentSuccesses = (metrics.successes || []).filter(
    (s) => s.modelVersion === modelVersion && s.timestamp > cutoff
  );

  const errorCount = recentErrors.length;
  const successCount = recentSuccesses.length;
  const totalRequests = errorCount + successCount;

  const errorRate = totalRequests > 0 ? errorCount / totalRequests : 0;

  return {
    version: modelVersion,
    totalRequests,
    errorCount,
    errorRate,
    lastUpdated: Date.now(),
  };
}

/**
 * Check if model should be rolled back based on error rate
 */
export function shouldRollback(
  modelVersion: string,
  config: ModelRemoteConfig
): {
  shouldRollback: boolean;
  reason?: string;
  metrics: ModelMetrics;
} {
  const metrics = calculateErrorRate(modelVersion);

  // Don't rollback if not enough data
  if (metrics.totalRequests < MIN_REQUESTS_FOR_ROLLBACK) {
    return {
      shouldRollback: false,
      reason: `Insufficient data (${metrics.totalRequests} requests, need ${MIN_REQUESTS_FOR_ROLLBACK})`,
      metrics,
    };
  }

  // Check if error rate exceeds threshold
  if (metrics.errorRate > config.rollbackThreshold) {
    return {
      shouldRollback: true,
      reason: `Error rate ${(metrics.errorRate * 100).toFixed(1)}% exceeds threshold ${(config.rollbackThreshold * 100).toFixed(1)}%`,
      metrics,
    };
  }

  return {
    shouldRollback: false,
    metrics,
  };
}

/**
 * Get metrics for all model versions
 */
export function getAllModelMetrics(): Record<string, ModelMetrics> {
  const metrics = loadMetrics();
  const cutoff = Date.now() - METRICS_WINDOW_MS;

  // Get unique model versions
  const versions = new Set<string>();
  (metrics.errors || []).forEach((e) => {
    if (e.timestamp > cutoff) versions.add(e.modelVersion);
  });
  (metrics.successes || []).forEach((s) => {
    if (s.timestamp > cutoff) versions.add(s.modelVersion);
  });

  // Calculate metrics for each version
  const result: Record<string, ModelMetrics> = {};
  versions.forEach((version) => {
    result[version] = calculateErrorRate(version);
  });

  return result;
}

/**
 * Clear metrics (useful for testing or manual reset)
 */
export function clearMetrics(): void {
  try {
    storage.delete(METRICS_STORAGE_KEY);
  } catch (error) {
    console.error('[RollbackMonitor] Failed to clear metrics:', error);
  }
}

/**
 * Load metrics from storage
 */
function loadMetrics(): {
  errors: ErrorMetric[];
  successes: { modelVersion: string; timestamp: number }[];
  lastUpdated: number;
} {
  try {
    const raw = storage.getString(METRICS_STORAGE_KEY);
    if (!raw) {
      return { errors: [], successes: [], lastUpdated: Date.now() };
    }

    const parsed = JSON.parse(raw);
    return {
      errors: parsed.errors || [],
      successes: parsed.successes || [],
      lastUpdated: parsed.lastUpdated || Date.now(),
    };
  } catch (error) {
    console.warn('[RollbackMonitor] Failed to load metrics:', error);
    return { errors: [], successes: [], lastUpdated: Date.now() };
  }
}

/**
 * Save metrics to storage
 */
function saveMetrics(metrics: {
  errors: ErrorMetric[];
  successes: { modelVersion: string; timestamp: number }[];
  lastUpdated: number;
}): void {
  try {
    storage.set(METRICS_STORAGE_KEY, JSON.stringify(metrics));
  } catch (error) {
    console.error('[RollbackMonitor] Failed to save metrics:', error);
  }
}

/**
 * Get error breakdown by category for a model version
 */
export function getErrorBreakdown(
  modelVersion: string
): Record<string, number> {
  const metrics = loadMetrics();
  const cutoff = Date.now() - METRICS_WINDOW_MS;

  const recentErrors = (metrics.errors || []).filter(
    (e) => e.modelVersion === modelVersion && e.timestamp > cutoff
  );

  const breakdown: Record<string, number> = {};
  recentErrors.forEach((error) => {
    breakdown[error.category] = (breakdown[error.category] || 0) + 1;
  });

  return breakdown;
}
