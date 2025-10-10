/**
 * Alert notification service
 *
 * Handles notification delivery for pH/EC deviation alerts.
 * Supports Android 13/14 POST_NOTIFICATIONS permission and offline alerts.
 */

import { Platform } from 'react-native';

import { LocalNotificationService } from '@/lib/notifications/local-service';
import { PermissionManager } from '@/lib/permissions/permission-manager';
import { captureCategorizedErrorSync } from '@/lib/sentry-utils';

import type {
  AlertType,
  DeviationAlert,
  PhEcReading,
  Reservoir,
} from '../types';
import { ecToPpm } from '../utils/conversions';

// ============================================================================
// Notification Scheduling
// ============================================================================

/**
 * Schedules a notification for a deviation alert
 *
 * Handles permission requests for Android 13+ and formats notification content
 * with proper units (EC primary, PPM with scale indicator).
 *
 * @param alert - The deviation alert to notify about
 * @param reading - The pH/EC reading that triggered the alert
 * @param reservoir - Reservoir configuration for context
 * @returns Promise<string | null> - Notification ID if scheduled, null if failed
 */
export async function scheduleAlertNotification(
  alert: DeviationAlert,
  reading: PhEcReading,
  reservoir: Reservoir
): Promise<string | null> {
  try {
    // Check/request notification permission
    const hasPermission = await ensureNotificationPermission();
    if (!hasPermission) {
      console.warn(
        'Notification permission denied - alert will be shown in-app only'
      );
      return null;
    }

    // Format notification content
    const { title, body } = formatAlertNotification(alert, reading, reservoir);

    // Schedule immediate notification (trigger in 1 second)
    const triggerDate = new Date(Date.now() + 1000);

    const notificationId =
      await LocalNotificationService.scheduleExactNotification({
        idTag: `alert_${alert.id}`,
        title,
        body,
        data: {
          type: 'nutrient_alert',
          alertId: alert.id,
          readingId: reading.id,
          reservoirId: reservoir.id,
          alertType: alert.type,
        },
        triggerDate,
        androidChannelKey: 'cultivation.alerts',
        threadId: `reservoir_${reservoir.id}`,
      });

    return notificationId;
  } catch (error) {
    captureCategorizedErrorSync(error, {
      operation: 'schedule_alert_notification',
      alertType: alert.type,
      reservoirId: reservoir.id,
    });
    return null;
  }
}

/**
 * Formats alert notification title and body with proper units
 */
function formatAlertNotification(
  alert: DeviationAlert,
  reading: PhEcReading,
  reservoir: Reservoir
): { title: string; body: string } {
  const title = getAlertTitle(alert.type);

  let body: string;

  switch (alert.type) {
    case 'ph_high':
    case 'ph_low':
      body = `${reservoir.name}: pH ${reading.ph.toFixed(1)} (target ${reservoir.targetPhMin.toFixed(1)}-${reservoir.targetPhMax.toFixed(1)}) • Tap for recommendations`;
      break;

    case 'ec_high':
    case 'ec_low': {
      const ppm = ecToPpm(reading.ec25c, reading.ppmScale);
      body = `${reservoir.name}: ${reading.ec25c.toFixed(2)} mS/cm @25°C • ${ppm} ppm [${reading.ppmScale}] (target ${reservoir.targetEcMin25c.toFixed(2)}-${reservoir.targetEcMax25c.toFixed(2)}) • Tap for recommendations`;
      break;
    }

    case 'temp_high':
      body = `${reservoir.name}: Temperature ${reading.tempC.toFixed(1)}°C is high - readings may be less accurate`;
      break;

    case 'calibration_stale':
      body = `${reservoir.name}: Meter calibration is stale - consider recalibrating`;
      break;

    default:
      body = `${reservoir.name}: ${alert.message}`;
  }

  return { title, body };
}

/**
 * Gets user-friendly title for alert type
 */
function getAlertTitle(type: AlertType): string {
  switch (type) {
    case 'ph_high':
      return 'pH Too High';
    case 'ph_low':
      return 'pH Too Low';
    case 'ec_high':
      return 'EC Too High';
    case 'ec_low':
      return 'EC Too Low';
    case 'temp_high':
      return 'Temperature Warning';
    case 'calibration_stale':
      return 'Calibration Needed';
    default:
      return 'Nutrient Alert';
  }
}

// ============================================================================
// Permission Management
// ============================================================================

/**
 * Ensures notification permission is granted
 * Requests permission on first use (Android 13+)
 *
 * @returns Promise<boolean> - true if permission granted
 */
async function ensureNotificationPermission(): Promise<boolean> {
  try {
    // Check if already granted
    const isGranted = await PermissionManager.isNotificationPermissionGranted();
    if (isGranted) {
      return true;
    }

    // Request permission if not granted
    const result = await PermissionManager.requestNotificationPermission();
    return result === 'granted';
  } catch (error) {
    captureCategorizedErrorSync(error, {
      operation: 'ensure_notification_permission',
    });
    return false;
  }
}

// ============================================================================
// Notification Cancellation
// ============================================================================

/**
 * Cancels a scheduled alert notification
 *
 * @param notificationId - The notification ID returned from scheduleAlertNotification
 */
export async function cancelAlertNotification(
  notificationId: string
): Promise<void> {
  try {
    await LocalNotificationService.cancelScheduledNotification(notificationId);
  } catch (error) {
    captureCategorizedErrorSync(error, {
      operation: 'cancel_alert_notification',
      notificationId,
    });
  }
}

/**
 * Cancels all alert notifications for a reservoir
 * Used when reservoir is deleted or deactivated
 *
 * @param reservoirId - Reservoir ID
 */
export async function cancelReservoirAlerts(
  reservoirId: string
): Promise<void> {
  try {
    // Note: LocalNotificationService doesn't have a way to query by threadId
    // This is a placeholder for future enhancement
    console.log(`Canceling alerts for reservoir ${reservoirId}`);
    // In production, you'd need to track notification IDs separately
  } catch (error) {
    captureCategorizedErrorSync(error, {
      operation: 'cancel_reservoir_alerts',
      reservoirId,
    });
  }
}

// ============================================================================
// Offline Alert Handling
// ============================================================================

/**
 * Handles alert notification delivery for offline mode
 * Stores delivered_at_local timestamp for sync mirroring
 *
 * @param alert - The alert to deliver
 * @param reading - Associated reading
 * @param reservoir - Associated reservoir
 * @returns Promise<boolean> - true if delivered successfully
 */
export async function deliverOfflineAlert(
  alert: DeviationAlert,
  reading: PhEcReading,
  reservoir: Reservoir
): Promise<boolean> {
  try {
    const notificationId = await scheduleAlertNotification(
      alert,
      reading,
      reservoir
    );

    // Return true if notification was scheduled
    // The alert service will set delivered_at_local timestamp
    return notificationId !== null;
  } catch (error) {
    captureCategorizedErrorSync(error, {
      operation: 'deliver_offline_alert',
      alertId: alert.id,
    });
    return false;
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Checks if notification permission is available and granted
 * Used by UI to show permission prompts
 */
export async function canSendNotifications(): Promise<boolean> {
  if (Platform.OS === 'android' && Platform.Version < 33) {
    return true; // No permission needed
  }

  return PermissionManager.isNotificationPermissionGranted();
}

/**
 * Opens system settings for notification permissions
 * Used when user denies permission and wants to enable later
 */
export function openNotificationSettings(): void {
  PermissionManager.provideFallbackExperience('notifications');
}
