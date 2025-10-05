/* eslint-disable max-params */
/**
 * Notification delivery metrics tracker
 */

import { MMKV } from 'react-native-mmkv';

import { analyticsService } from './service';
import type {
  NotificationDeliveredEvent,
  NotificationMetrics,
  NotificationMissedEvent,
  NotificationScheduledEvent,
} from './types';

interface ScheduledNotification {
  notificationId: string;
  taskId: string;
  scheduledTime: number;
  isExactAlarm: boolean;
}

const STORAGE_KEY = 'notification_metrics';
const SCHEDULED_KEY = 'scheduled_notifications';
const LAST_SUMMARY_KEY = 'last_notification_summary';

class NotificationMetricsTracker {
  private storage: MMKV;
  private scheduledNotifications: Map<string, ScheduledNotification>;

  constructor() {
    this.storage = new MMKV({ id: 'notification-metrics' });
    this.scheduledNotifications = this.loadScheduledNotifications();
  }

  /**
   * Track a scheduled notification
   */
  trackScheduled(
    notificationId: string,
    taskId: string,
    scheduledTime: number,
    isExactAlarm: boolean = false
  ): void {
    const notification: ScheduledNotification = {
      notificationId,
      taskId,
      scheduledTime,
      isExactAlarm,
    };

    this.scheduledNotifications.set(notificationId, notification);
    this.persistScheduledNotifications();

    analyticsService.track<NotificationScheduledEvent>('notif_scheduled', {
      notificationId,
      taskId,
      scheduledTime,
      isExactAlarm,
    });
  }

  /**
   * Track a delivered notification
   */
  trackDelivered(notificationId: string, actualDeliveryTime: number): void {
    const scheduled = this.scheduledNotifications.get(notificationId);
    if (!scheduled) {
      console.warn(
        '[NotificationMetrics] Delivered notification not found in scheduled:',
        notificationId
      );
      return;
    }

    const delayMs = actualDeliveryTime - scheduled.scheduledTime;

    analyticsService.track<NotificationDeliveredEvent>('notif_delivered', {
      notificationId,
      taskId: scheduled.taskId,
      scheduledTime: scheduled.scheduledTime,
      actualDeliveryTime,
      delayMs,
    });

    // Remove from scheduled
    this.scheduledNotifications.delete(notificationId);
    this.persistScheduledNotifications();

    // Update metrics
    this.updateMetrics('delivered', delayMs);
  }

  /**
   * Track a missed notification
   */
  trackMissed(
    notificationId: string,
    reason: NotificationMissedEvent['reason']
  ): void {
    const scheduled = this.scheduledNotifications.get(notificationId);
    if (!scheduled) {
      console.warn(
        '[NotificationMetrics] Missed notification not found in scheduled:',
        notificationId
      );
      return;
    }

    analyticsService.track<NotificationMissedEvent>('notif_missed', {
      notificationId,
      taskId: scheduled.taskId,
      scheduledTime: scheduled.scheduledTime,
      reason,
    });

    // Remove from scheduled
    this.scheduledNotifications.delete(notificationId);
    this.persistScheduledNotifications();

    // Update metrics
    this.updateMetrics('missed', 0);
  }

  /**
   * Get current notification metrics
   */
  getMetrics(): NotificationMetrics {
    const stored = this.storage.getString(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }

    return {
      totalScheduled: 0,
      totalDelivered: 0,
      totalMissed: 0,
      deliveryRate: 0,
      averageDelayMs: 0,
      lastCalculated: Date.now(),
    };
  }

  /**
   * Emit summary metrics (called at app start and daily)
   */
  emitSummary(): void {
    const metrics = this.getMetrics();
    const lastSummary = this.storage.getNumber(LAST_SUMMARY_KEY) || 0;
    const now = Date.now();

    // Only emit if it's been at least 1 hour since last summary
    if (now - lastSummary < 3600000) {
      return;
    }

    console.log('[NotificationMetrics] Summary:', metrics);

    // Store last summary time
    this.storage.set(LAST_SUMMARY_KEY, now);

    // Send to analytics backend or monitoring service
    // This could trigger alerts if delivery rate is too low
    if (metrics.deliveryRate < 0.95 && metrics.totalScheduled > 10) {
      console.warn(
        '[NotificationMetrics] Low delivery rate:',
        metrics.deliveryRate
      );
    }
  }

  /**
   * Reset metrics (for testing or maintenance)
   */
  resetMetrics(): void {
    this.storage.delete(STORAGE_KEY);
    this.storage.delete(LAST_SUMMARY_KEY);
    this.storage.delete(SCHEDULED_KEY);
    this.scheduledNotifications.clear();
  }

  /**
   * Clean up old scheduled notifications (e.g., older than 7 days)
   */
  cleanupOldScheduled(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [id, notification] of this.scheduledNotifications.entries()) {
      if (now - notification.scheduledTime > maxAgeMs) {
        this.scheduledNotifications.delete(id);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.persistScheduledNotifications();
      console.log('[NotificationMetrics] Cleaned up old scheduled:', cleaned);
    }
  }

  // Private methods

  private updateMetrics(type: 'delivered' | 'missed', delayMs: number): void {
    const metrics = this.getMetrics();

    if (type === 'delivered') {
      metrics.totalDelivered++;
      // Update running average delay
      const totalDelay = metrics.averageDelayMs * (metrics.totalDelivered - 1);
      metrics.averageDelayMs = (totalDelay + delayMs) / metrics.totalDelivered;
    } else {
      metrics.totalMissed++;
    }

    // Recalculate delivery rate
    const total = metrics.totalDelivered + metrics.totalMissed;
    metrics.deliveryRate = total > 0 ? metrics.totalDelivered / total : 0;
    metrics.lastCalculated = Date.now();

    this.storage.set(STORAGE_KEY, JSON.stringify(metrics));
  }

  private loadScheduledNotifications(): Map<string, ScheduledNotification> {
    try {
      const stored = this.storage.getString(SCHEDULED_KEY);
      if (stored) {
        const array: ScheduledNotification[] = JSON.parse(stored);
        return new Map(array.map((n) => [n.notificationId, n]));
      }
    } catch (error) {
      console.error(
        '[NotificationMetrics] Failed to load scheduled notifications:',
        error
      );
    }
    return new Map();
  }

  private persistScheduledNotifications(): void {
    try {
      const array = Array.from(this.scheduledNotifications.values());
      this.storage.set(SCHEDULED_KEY, JSON.stringify(array));
    } catch (error) {
      console.error(
        '[NotificationMetrics] Failed to persist scheduled notifications:',
        error
      );
    }
  }
}

// Singleton instance
export const notificationMetrics = new NotificationMetricsTracker();
