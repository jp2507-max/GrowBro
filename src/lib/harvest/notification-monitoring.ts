/**
 * Notification Monitoring Service
 *
 * Requirements:
 * - 16.5: Create monitoring for notification delivery and rehydration success
 * - 14.3: Monitor notification rehydration on app start
 * - 14.1, 14.2: Track notification scheduling success rates
 *
 * Features:
 * - Track notification scheduling success/failure rates
 * - Monitor rehydration performance and errors
 * - Collect metrics on notification delivery
 * - Alert on systematic failures
 */

import { NoopAnalytics } from '@/lib/analytics';

import type {
  NotificationScheduleResult,
  RehydrationStats,
} from './harvest-notification-service';

/**
 * Notification event types for monitoring
 */
export type NotificationEvent =
  | 'schedule_target_success'
  | 'schedule_target_failure'
  | 'schedule_overdue_success'
  | 'schedule_overdue_failure'
  | 'cancel_success'
  | 'cancel_failure'
  | 'rehydration_started'
  | 'rehydration_completed'
  | 'rehydration_failed';

/**
 * Track notification scheduling attempt
 */
export async function trackNotificationSchedule(params: {
  type: 'target' | 'overdue';
  result: NotificationScheduleResult;
  harvestId: string;
  stage: string;
}): Promise<void> {
  try {
    const event: NotificationEvent = params.result.scheduled
      ? params.type === 'target'
        ? 'schedule_target_success'
        : 'schedule_overdue_success'
      : params.type === 'target'
        ? 'schedule_target_failure'
        : 'schedule_overdue_failure';

    await NoopAnalytics.track('harvest_notification_schedule', {
      event,
      success: params.result.scheduled,
      error: params.result.error,
    });

    if (!params.result.scheduled) {
      console.warn('[NotificationMonitoring] Schedule failed:', {
        type: params.type,
        harvestId: params.harvestId,
        stage: params.stage,
        error: params.result.error,
      });
    }
  } catch (error) {
    console.warn('Failed to track notification schedule:', error);
  }
}

/**
 * Track notification cancellation
 */
export async function trackNotificationCancellation(params: {
  harvestId: string;
  success: boolean;
  error?: string;
}): Promise<void> {
  try {
    await NoopAnalytics.track('harvest_notification_cancel', {
      success: params.success,
      error: params.error,
    });
  } catch (error) {
    console.warn('Failed to track notification cancellation:', error);
  }
}

/**
 * Track notification rehydration process
 */
export async function trackNotificationRehydration(
  stats: RehydrationStats,
  durationMs: number
): Promise<void> {
  try {
    await NoopAnalytics.track('harvest_notification_rehydration', {
      total_harvests: stats.totalHarvests,
      notifications_scheduled: stats.notificationsScheduled,
      notifications_cancelled: stats.notificationsCancelled,
      errors: stats.errors,
      duration_ms: Math.round(durationMs),
      success_rate:
        stats.totalHarvests > 0
          ? (stats.notificationsScheduled / stats.totalHarvests) * 100
          : 100,
    });

    // Log summary
    console.log('[NotificationMonitoring] Rehydration completed:', {
      ...stats,
      durationMs: Math.round(durationMs),
      successRate:
        stats.totalHarvests > 0
          ? `${((stats.notificationsScheduled / stats.totalHarvests) * 100).toFixed(1)}%`
          : 'N/A',
    });

    // Alert on high error rate
    if (stats.totalHarvests > 0 && stats.errors / stats.totalHarvests > 0.3) {
      console.error(
        '[NotificationMonitoring] HIGH ERROR RATE in rehydration:',
        {
          errorRate: `${((stats.errors / stats.totalHarvests) * 100).toFixed(1)}%`,
          totalErrors: stats.errors,
          totalHarvests: stats.totalHarvests,
        }
      );
    }
  } catch (error) {
    console.warn('Failed to track notification rehydration:', error);
  }
}

/**
 * Track notification delivery (when user interacts with notification)
 */
export async function trackNotificationDelivery(params: {
  notificationId: string;
  harvestId: string;
  type: 'harvest_stage_target' | 'harvest_stage_overdue';
  delivered: boolean;
  timeSinceScheduleMs?: number;
}): Promise<void> {
  try {
    await NoopAnalytics.track('harvest_notification_delivery', {
      type: params.type,
      delivered: params.delivered,
      delay_ms: params.timeSinceScheduleMs
        ? Math.round(params.timeSinceScheduleMs)
        : undefined,
    });

    if (params.delivered) {
      console.log('[NotificationMonitoring] Notification delivered:', {
        harvestId: params.harvestId,
        type: params.type,
        delayMs: params.timeSinceScheduleMs,
      });
    }
  } catch (error) {
    console.warn('Failed to track notification delivery:', error);
  }
}

/**
 * Get notification health metrics summary
 */
export type NotificationHealthMetrics = {
  scheduleSuccessRate: number;
  rehydrationSuccessRate: number;
  averageRehydrationDurationMs: number;
  totalNotificationsScheduled: number;
  totalRehydrationErrors: number;
  lastRehydrationStats: RehydrationStats | null;
};

/**
 * In-memory metrics aggregator (reset on app restart)
 */
class NotificationMetricsAggregator {
  private scheduleAttempts = 0;
  private scheduleSuccesses = 0;
  private rehydrationAttempts = 0;
  private rehydrationSuccesses = 0;
  private rehydrationDurations: number[] = [];
  private totalScheduled = 0;
  private totalRehydrationErrors = 0;
  private lastRehydrationStats: RehydrationStats | null = null;

  recordSchedule(success: boolean): void {
    this.scheduleAttempts++;
    if (success) {
      this.scheduleSuccesses++;
      this.totalScheduled++;
    }
  }

  recordRehydration(stats: RehydrationStats, durationMs: number): void {
    this.rehydrationAttempts++;
    this.rehydrationSuccesses++;
    this.rehydrationDurations.push(durationMs);
    this.totalRehydrationErrors += stats.errors;
    this.lastRehydrationStats = stats;

    // Keep only last 10 durations to avoid memory bloat
    if (this.rehydrationDurations.length > 10) {
      this.rehydrationDurations.shift();
    }
  }

  getMetrics(): NotificationHealthMetrics {
    const avgDuration =
      this.rehydrationDurations.length > 0
        ? this.rehydrationDurations.reduce((a, b) => a + b, 0) /
          this.rehydrationDurations.length
        : 0;

    return {
      scheduleSuccessRate:
        this.scheduleAttempts > 0
          ? (this.scheduleSuccesses / this.scheduleAttempts) * 100
          : 100,
      rehydrationSuccessRate:
        this.rehydrationAttempts > 0
          ? (this.rehydrationSuccesses / this.rehydrationAttempts) * 100
          : 100,
      averageRehydrationDurationMs: Math.round(avgDuration),
      totalNotificationsScheduled: this.totalScheduled,
      totalRehydrationErrors: this.totalRehydrationErrors,
      lastRehydrationStats: this.lastRehydrationStats,
    };
  }

  reset(): void {
    this.scheduleAttempts = 0;
    this.scheduleSuccesses = 0;
    this.rehydrationAttempts = 0;
    this.rehydrationSuccesses = 0;
    this.rehydrationDurations = [];
    this.totalScheduled = 0;
    this.totalRehydrationErrors = 0;
    this.lastRehydrationStats = null;
  }
}

// Singleton instance
const metricsAggregator = new NotificationMetricsAggregator();

/**
 * Record schedule attempt in aggregator
 */
export function recordScheduleAttempt(success: boolean): void {
  metricsAggregator.recordSchedule(success);
}

/**
 * Record rehydration in aggregator
 */
export function recordRehydrationAttempt(
  stats: RehydrationStats,
  durationMs: number
): void {
  metricsAggregator.recordRehydration(stats, durationMs);
}

/**
 * Get current notification health metrics
 */
export function getNotificationHealthMetrics(): NotificationHealthMetrics {
  return metricsAggregator.getMetrics();
}

/**
 * Reset notification metrics (for testing)
 */
export function resetNotificationMetrics(): void {
  metricsAggregator.reset();
}
