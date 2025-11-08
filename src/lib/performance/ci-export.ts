/**
 * CI/CD Performance Artifact Export Utilities
 * Exports performance metrics and reports for CI pipeline consumption
 */

import { Platform } from 'react-native';

import type { PerformanceArtifact, RNPerformanceReport } from './types';

/**
 * Export RN Performance report to JSON for CI artifacts
 */
export function exportPerformanceReportJSON(
  reports: RNPerformanceReport[]
): string {
  return JSON.stringify(
    {
      timestamp: new Date().toISOString(),
      reports,
      metadata: {
        platform: Platform.OS,
        version: Platform.Version,
      },
    },
    null,
    2
  );
}

/**
 * Create a performance artifact metadata object
 */
export function createPerformanceArtifact(options: {
  type: PerformanceArtifact['type'];
  metadata: Record<string, unknown>;
  filePath?: string;
  url?: string;
}): PerformanceArtifact {
  return {
    type: options.type,
    filePath: options.filePath,
    url: options.url,
    metadata: {
      ...options.metadata,
      timestamp: new Date().toISOString(),
      platform: Platform.OS,
      platformVersion: Platform.Version,
    },
  };
}

/**
 * Export performance metrics summary for CI
 */
export function exportPerformanceMetricsSummary(data: {
  buildHash?: string;
  device?: string;
  reports: RNPerformanceReport[];
  sentryTransactionUrls?: string[];
}): string {
  const summary = {
    buildHash: data.buildHash || 'unknown',
    device: data.device || `${Platform.OS} ${Platform.Version}`,
    timestamp: new Date().toISOString(),
    reports: data.reports,
    sentryTransactionUrls: data.sentryTransactionUrls || [],
    metadata: {
      platform: Platform.OS,
      platformVersion: Platform.Version,
    },
  };

  return JSON.stringify(summary, null, 2);
}

/**
 * Log performance artifact for CI consumption
 * Outputs in a format that CI can parse and collect
 */
export function logPerformanceArtifact(artifact: PerformanceArtifact): void {
  const logMessage = `[PERFORMANCE_ARTIFACT] ${JSON.stringify(artifact)}`;
  console.log(logMessage);
}

/**
 * Log Sentry transaction URL for CI collection
 */
export function logSentryTransactionUrl(transactionUrl: string): void {
  const logMessage = `[SENTRY_TRANSACTION_URL] ${transactionUrl}`;
  console.log(logMessage);
}

/**
 * Log performance metrics for CI parsing
 */
export function logPerformanceMetrics(metrics: {
  name: string;
  value: number;
  unit: string;
  threshold?: number;
  passed?: boolean;
}): void {
  const logMessage = `[PERFORMANCE_METRIC] ${JSON.stringify(metrics)}`;
  console.log(logMessage);
}
