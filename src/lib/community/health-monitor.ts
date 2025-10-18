/**
 * Community feed health monitoring and alerting
 *
 * Monitors performance and operational metrics, generates alerts
 * for threshold violations, and integrates with Sentry for error tracking.
 *
 * Requirements: 10.5, 10.6
 */

import type { CommunityMetrics } from './metrics-tracker';
import { communityMetrics } from './metrics-tracker';

export type HealthStatus = 'healthy' | 'degraded' | 'critical';

export interface Alert {
  severity: 'warning' | 'critical';
  message: string;
  threshold: number;
  actual: number;
  metric: string;
}

export interface HealthCheckResult {
  status: HealthStatus;
  metrics: CommunityMetrics;
  alerts: Alert[];
  timestamp: number;
}

// Performance and operational thresholds
const THRESHOLDS = {
  LATENCY_P95_WARNING_MS: 2000,
  LATENCY_P95_CRITICAL_MS: 3000,
  OUTBOX_DEPTH_WARNING: 30,
  OUTBOX_DEPTH_CRITICAL: 50,
  MUTATION_FAILURE_RATE_WARNING: 0.01, // 1%
  MUTATION_FAILURE_RATE_CRITICAL: 0.02, // 2%
  WS_RECONNECTS_WARNING: 3,
  WS_RECONNECTS_CRITICAL: 5,
} as const;

class CommunityHealthMonitor {
  /**
   * Get current health status with alerts
   * Requirement 10.5: Monitor all operational metrics
   */
  getHealthStatus(): HealthCheckResult {
    const metrics = communityMetrics.getMetrics();
    const alerts = this.generateAlerts(metrics);
    const status = this.determineStatus(alerts);

    return {
      status,
      metrics,
      alerts,
      timestamp: Date.now(),
    };
  }

  /**
   * Generate alerts for threshold violations
   */
  private generateAlerts(metrics: CommunityMetrics): Alert[] {
    const alerts: Alert[] = [];

    // Check P95 latency (Requirement 9.6: P95 < 3s)
    if (metrics.realtime_latency_p95 > THRESHOLDS.LATENCY_P95_CRITICAL_MS) {
      alerts.push({
        severity: 'critical',
        message: 'Real-time latency P95 exceeds 3s threshold',
        threshold: THRESHOLDS.LATENCY_P95_CRITICAL_MS,
        actual: metrics.realtime_latency_p95,
        metric: 'realtime_latency_p95',
      });
    } else if (
      metrics.realtime_latency_p95 > THRESHOLDS.LATENCY_P95_WARNING_MS
    ) {
      alerts.push({
        severity: 'warning',
        message: 'Real-time latency P95 approaching threshold',
        threshold: THRESHOLDS.LATENCY_P95_WARNING_MS,
        actual: metrics.realtime_latency_p95,
        metric: 'realtime_latency_p95',
      });
    }

    // Check outbox depth (Requirement 10.5: Alert when depth > 50)
    if (metrics.outbox_depth > THRESHOLDS.OUTBOX_DEPTH_CRITICAL) {
      alerts.push({
        severity: 'critical',
        message: 'Outbox queue depth exceeds critical threshold',
        threshold: THRESHOLDS.OUTBOX_DEPTH_CRITICAL,
        actual: metrics.outbox_depth,
        metric: 'outbox_depth',
      });
    } else if (metrics.outbox_depth > THRESHOLDS.OUTBOX_DEPTH_WARNING) {
      alerts.push({
        severity: 'warning',
        message: 'Outbox queue depth elevated',
        threshold: THRESHOLDS.OUTBOX_DEPTH_WARNING,
        actual: metrics.outbox_depth,
        metric: 'outbox_depth',
      });
    }

    // Check mutation failure rate (Requirement 10.5: <2% failures/day)
    if (
      metrics.mutation_failure_rate > THRESHOLDS.MUTATION_FAILURE_RATE_CRITICAL
    ) {
      alerts.push({
        severity: 'critical',
        message: 'Mutation failure rate exceeds 2% threshold',
        threshold: THRESHOLDS.MUTATION_FAILURE_RATE_CRITICAL,
        actual: metrics.mutation_failure_rate,
        metric: 'mutation_failure_rate',
      });
    } else if (
      metrics.mutation_failure_rate > THRESHOLDS.MUTATION_FAILURE_RATE_WARNING
    ) {
      alerts.push({
        severity: 'warning',
        message: 'Mutation failure rate elevated',
        threshold: THRESHOLDS.MUTATION_FAILURE_RATE_WARNING,
        actual: metrics.mutation_failure_rate,
        metric: 'mutation_failure_rate',
      });
    }

    // Check WebSocket reconnection frequency
    if (metrics.ws_reconnects_per_session > THRESHOLDS.WS_RECONNECTS_CRITICAL) {
      alerts.push({
        severity: 'critical',
        message: 'Excessive WebSocket reconnections detected',
        threshold: THRESHOLDS.WS_RECONNECTS_CRITICAL,
        actual: metrics.ws_reconnects_per_session,
        metric: 'ws_reconnects_per_session',
      });
    } else if (
      metrics.ws_reconnects_per_session > THRESHOLDS.WS_RECONNECTS_WARNING
    ) {
      alerts.push({
        severity: 'warning',
        message: 'Elevated WebSocket reconnection rate',
        threshold: THRESHOLDS.WS_RECONNECTS_WARNING,
        actual: metrics.ws_reconnects_per_session,
        metric: 'ws_reconnects_per_session',
      });
    }

    return alerts;
  }

  /**
   * Determine overall health status based on alerts
   */
  private determineStatus(alerts: Alert[]): HealthStatus {
    const hasCritical = alerts.some((a) => a.severity === 'critical');
    const hasWarning = alerts.some((a) => a.severity === 'warning');

    if (hasCritical) return 'critical';
    if (hasWarning) return 'degraded';
    return 'healthy';
  }

  /**
   * Send health alerts to Sentry
   * Requirement 10.6: Send error events and state transitions to Sentry
   */
  async reportToSentry(health: HealthCheckResult): Promise<void> {
    // Only report if degraded or critical
    if (health.status === 'healthy') return;

    try {
      // Dynamic import to avoid requiring Sentry at bundle time
      const Sentry = await import('@sentry/react-native');

      // Add breadcrumb for health status change
      Sentry.addBreadcrumb({
        category: 'community.health',
        message: `Health status: ${health.status}`,
        level: health.status === 'critical' ? 'error' : 'warning',
        data: this.sanitizeMetrics(health.metrics),
      });

      // Capture critical alerts as Sentry events
      for (const alert of health.alerts) {
        if (alert.severity === 'critical') {
          Sentry.captureMessage(alert.message, {
            level: 'warning', // Use warning level to avoid alarm fatigue
            tags: {
              category: 'community_health',
              metric: alert.metric,
              status: health.status,
            },
            extra: {
              threshold: alert.threshold,
              actual: alert.actual,
              all_metrics: this.sanitizeMetrics(health.metrics),
            },
          });
        }
      }
    } catch (error) {
      // Silently fail if Sentry is not available
      console.warn('[CommunityHealth] Failed to report to Sentry:', error);
    }
  }

  /**
   * Sanitize metrics for privacy-safe reporting
   * Requirement 10.6: Lightweight, privacy-safe context
   */
  private sanitizeMetrics(metrics: CommunityMetrics): Record<string, unknown> {
    return {
      // Performance metrics (no PII)
      latency_p50: Math.round(metrics.realtime_latency_p50),
      latency_p95: Math.round(metrics.realtime_latency_p95),

      // Operational metrics (no PII)
      ws_reconnects: metrics.ws_reconnects_per_session,
      dedupe_drops_per_min:
        Math.round(metrics.dedupe_drops_per_min * 100) / 100,
      outbox_depth: metrics.outbox_depth,
      outbox_pending: metrics.outbox_pending,
      outbox_failed: metrics.outbox_failed,

      // Usage metrics (no PII)
      undo_usage_rate: Math.round(metrics.undo_usage_rate * 100) / 100,
      mutation_failure_rate:
        Math.round(metrics.mutation_failure_rate * 100) / 100,

      // Timestamps for context (no PII)
      last_ws_reconnect_relative_ms: metrics.last_ws_reconnect_at
        ? Date.now() - metrics.last_ws_reconnect_at
        : null,
      last_reconciliation_relative_ms: metrics.last_reconciliation_at
        ? Date.now() - metrics.last_reconciliation_at
        : null,
    };
  }
}

// Singleton instance
export const communityHealth = new CommunityHealthMonitor();
