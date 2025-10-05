/**
 * Metrics aggregation and reporting
 */

import { notificationMetrics } from './notification-metrics';
import { syncMetrics } from './sync-metrics';
import type {
  ConflictMetrics,
  NotificationMetrics,
  SyncMetrics,
} from './types';

export interface AggregatedMetrics {
  notifications: NotificationMetrics;
  sync: SyncMetrics;
  conflicts: ConflictMetrics;
  timestamp: number;
}

export interface HealthStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  notifications: 'healthy' | 'degraded' | 'unhealthy';
  sync: 'healthy' | 'degraded' | 'unhealthy';
  issues: string[];
}

class MetricsAggregator {
  /**
   * Get all metrics in one call
   */
  getAggregatedMetrics(): AggregatedMetrics {
    return {
      notifications: notificationMetrics.getMetrics(),
      sync: syncMetrics.getSyncMetrics(),
      conflicts: syncMetrics.getConflictMetrics(),
      timestamp: Date.now(),
    };
  }

  /**
   * Get health status based on metrics
   */
  getHealthStatus(): HealthStatus {
    const metrics = this.getAggregatedMetrics();
    const issues: string[] = [];

    // Check notification health
    let notificationHealth: HealthStatus['notifications'] = 'healthy';
    if (
      metrics.notifications.deliveryRate < 0.95 &&
      metrics.notifications.totalScheduled > 10
    ) {
      notificationHealth = 'degraded';
      issues.push(
        `Low notification delivery rate: ${(metrics.notifications.deliveryRate * 100).toFixed(1)}%`
      );
    }
    if (
      metrics.notifications.deliveryRate < 0.85 &&
      metrics.notifications.totalScheduled > 10
    ) {
      notificationHealth = 'unhealthy';
    }
    if (metrics.notifications.averageDelayMs > 300000) {
      // 5 minutes
      notificationHealth = 'degraded';
      issues.push(
        `High notification delay: ${(metrics.notifications.averageDelayMs / 1000 / 60).toFixed(1)} minutes`
      );
    }

    // Check sync health
    let syncHealth: HealthStatus['sync'] = 'healthy';
    if (metrics.sync.failRate > 0.1 && metrics.sync.totalSyncs > 10) {
      syncHealth = 'degraded';
      issues.push(
        `High sync failure rate: ${(metrics.sync.failRate * 100).toFixed(1)}%`
      );
    }
    if (metrics.sync.failRate > 0.25 && metrics.sync.totalSyncs > 10) {
      syncHealth = 'unhealthy';
    }
    if (metrics.sync.averageLatencyMs > 5000) {
      // 5 seconds
      syncHealth = 'degraded';
      issues.push(
        `High sync latency: ${(metrics.sync.averageLatencyMs / 1000).toFixed(1)}s`
      );
    }

    // Determine overall health
    let overall: HealthStatus['overall'] = 'healthy';
    if (notificationHealth === 'unhealthy' || syncHealth === 'unhealthy') {
      overall = 'unhealthy';
    } else if (notificationHealth === 'degraded' || syncHealth === 'degraded') {
      overall = 'degraded';
    }

    return {
      overall,
      notifications: notificationHealth,
      sync: syncHealth,
      issues,
    };
  }

  /**
   * Emit summary of all metrics
   */
  emitSummary(): void {
    const metrics = this.getAggregatedMetrics();
    const health = this.getHealthStatus();

    console.log('[MetricsAggregator] Summary:', {
      health,
      metrics,
    });

    // Emit notification summary
    notificationMetrics.emitSummary();

    // Log health issues
    if (health.issues.length > 0) {
      console.warn('[MetricsAggregator] Health issues:', health.issues);
    }
  }

  /**
   * Get metrics report for display
   */
  getMetricsReport(): string {
    const metrics = this.getAggregatedMetrics();
    const health = this.getHealthStatus();

    const lines = [
      '=== Playbook Metrics Report ===',
      '',
      `Overall Health: ${health.overall.toUpperCase()}`,
      '',
      '--- Notifications ---',
      `Delivery Rate: ${(metrics.notifications.deliveryRate * 100).toFixed(1)}%`,
      `Average Delay: ${(metrics.notifications.averageDelayMs / 1000).toFixed(1)}s`,
      `Total Scheduled: ${metrics.notifications.totalScheduled}`,
      `Total Delivered: ${metrics.notifications.totalDelivered}`,
      `Total Missed: ${metrics.notifications.totalMissed}`,
      '',
      '--- Sync ---',
      `Success Rate: ${((1 - metrics.sync.failRate) * 100).toFixed(1)}%`,
      `Average Latency: ${(metrics.sync.averageLatencyMs / 1000).toFixed(1)}s`,
      `Total Syncs: ${metrics.sync.totalSyncs}`,
      `Successful: ${metrics.sync.successfulSyncs}`,
      `Failed: ${metrics.sync.failedSyncs}`,
      '',
      '--- Conflicts ---',
      `Total Conflicts: ${metrics.conflicts.totalConflicts}`,
      `Resolved by Server: ${metrics.conflicts.resolvedByServer}`,
      `Resolved by Client: ${metrics.conflicts.resolvedByClient}`,
      `Manual Resolutions: ${metrics.conflicts.manualResolutions}`,
      `Restored: ${metrics.conflicts.restoredCount}`,
    ];

    if (health.issues.length > 0) {
      lines.push('', '--- Issues ---');
      health.issues.forEach((issue) => lines.push(`- ${issue}`));
    }

    return lines.join('\n');
  }

  /**
   * Reset all metrics
   */
  resetAllMetrics(): void {
    notificationMetrics.resetMetrics();
    syncMetrics.resetMetrics();
    console.log('[MetricsAggregator] All metrics reset');
  }
}

// Singleton instance
export const metricsAggregator = new MetricsAggregator();
