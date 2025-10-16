/**
 * Stock Monitoring Telemetry
 *
 * Tracks notification delivery and forecast accuracy metrics.
 * Respects user analytics consent preferences.
 *
 * Requirements: Task 8 Step 7 - Telemetry for notifications and forecasts
 */

import * as Sentry from '@sentry/react-native';

import { hasConsent } from '@/lib/privacy-consent';

type NotificationDeliveryEvent = {
  itemId: string;
  itemName: string;
  notificationId: string;
  daysToZero: number | null;
  percentBelowThreshold: number;
  scheduled: boolean;
  error?: string;
};

type ForecastAccuracyEvent = {
  itemId: string;
  predictedDaysToZero: number;
  actualDaysToZero: number;
  accuracyError: number;
  forecastMethod: 'SMA' | 'SES';
  confidence: 'high' | 'medium' | 'low';
  dataPoints: number;
};

/**
 * Track low-stock notification delivery
 */
export async function trackNotificationDelivery(
  event: NotificationDeliveryEvent
): Promise<void> {
  if (!hasConsent('analytics')) return;

  try {
    Sentry.addBreadcrumb({
      category: 'inventory.notification',
      message: event.scheduled
        ? `Scheduled low-stock notification for ${event.itemName}`
        : `Failed to schedule notification for ${event.itemName}`,
      level: event.scheduled ? 'info' : 'warning',
      data: {
        itemId: event.itemId,
        notificationId: event.notificationId,
        daysToZero: event.daysToZero,
        percentBelowThreshold: event.percentBelowThreshold,
        error: event.error,
      },
    });

    // TODO: Re-enable when Sentry.metrics is available in @sentry/react-native
    // Track metric for monitoring dashboard
    // if (event.scheduled) {
    //   Sentry.metrics.increment('inventory.notification.scheduled', 1, {
    //     tags: {
    //       urgency:
    //         event.daysToZero !== null && event.daysToZero < 3
    //           ? 'critical'
    //           : 'normal',
    //     },
    //   });
    // } else {
    //   Sentry.metrics.increment('inventory.notification.failed', 1);
    // }
  } catch (error) {
    // Silently fail telemetry - don't disrupt user experience
    console.warn('Failed to track notification delivery:', error);
  }
}

/**
 * Track forecast accuracy when actual stockout occurs
 *
 * Call this when an item's stock reaches zero to measure prediction accuracy.
 */
export async function trackForecastAccuracy(
  event: ForecastAccuracyEvent
): Promise<void> {
  if (!hasConsent('analytics')) return;

  try {
    const accuracyPercent =
      Math.abs(event.accuracyError / event.predictedDaysToZero) * 100;

    Sentry.addBreadcrumb({
      category: 'inventory.forecast',
      message: `Forecast accuracy for item: ${accuracyPercent.toFixed(1)}% error`,
      level: accuracyPercent < 20 ? 'info' : 'warning',
      data: {
        itemId: event.itemId,
        predicted: event.predictedDaysToZero,
        actual: event.actualDaysToZero,
        error: event.accuracyError,
        method: event.forecastMethod,
        confidence: event.confidence,
        dataPoints: event.dataPoints,
      },
    });

    // TODO: Re-enable when Sentry.metrics is available in @sentry/react-native
    // Track forecast accuracy distribution
    // Sentry.metrics.distribution(
    //   'inventory.forecast.accuracy_error_days',
    //   Math.abs(event.accuracyError),
    //   {
    //     unit: 'day',
    //     tags: {
    //       method: event.forecastMethod,
    //       confidence: event.confidence,
    //       dataPoints: event.dataPoints >= 84 ? 'sufficient' : 'limited',
    //     },
    //   }
    // );
    //
    // Track method effectiveness
    // if (accuracyPercent < 20) {
    //   Sentry.metrics.increment('inventory.forecast.accurate', 1, {
    //     tags: { method: event.forecastMethod },
    //   });
    // }
  } catch (error) {
    console.warn('Failed to track forecast accuracy:', error);
  }
}

/**
 * Track notification interaction (user opened notification)
 */
export async function trackNotificationInteraction(
  itemId: string,
  itemName: string
): Promise<void> {
  if (!hasConsent('analytics')) return;

  try {
    Sentry.addBreadcrumb({
      category: 'inventory.notification',
      message: `User opened low-stock notification for ${itemName}`,
      level: 'info',
      data: { itemId },
    });

    // TODO: Re-enable when Sentry.metrics is available in @sentry/react-native
    // Sentry.metrics.increment('inventory.notification.opened', 1);
  } catch (error) {
    console.warn('Failed to track notification interaction:', error);
  }
}

/**
 * Track permission request outcome
 */
export async function trackExactAlarmPermission(
  granted: boolean,
  method: 'initial' | 'retry' | 'settings'
): Promise<void> {
  if (!hasConsent('analytics')) return;

  try {
    Sentry.addBreadcrumb({
      category: 'inventory.permission',
      message: `Exact alarm permission ${granted ? 'granted' : 'denied'} via ${method}`,
      level: granted ? 'info' : 'warning',
      data: { granted, method },
    });

    // TODO: Re-enable when Sentry.metrics is available in @sentry/react-native
    // Sentry.metrics.increment(
    //   `inventory.permission.exact_alarm.${granted ? 'granted' : 'denied'}`,
    //   1,
    //   {
    //     tags: { method },
    //   }
    // );
  } catch (error) {
    console.warn('Failed to track permission outcome:', error);
  }
}
