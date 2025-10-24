/**
 * Moderation Metrics Types
 *
 * Lightweight module exporting interfaces used across the moderation metrics
 * implementation. This file contains only types to keep runtime overhead minimal.
 */

export interface ModerationMetric {
  metricName: string;
  value: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface AppealMetrics {
  totalAppeals: number;
  upheldAppeals: number;
  rejectedAppeals: number;
  reversalRate: number;
}

export interface ODSMetrics {
  totalEscalations: number;
  upheldByODS: number;
  rejectedByODS: number;
  averageResolutionDays: number;
}
