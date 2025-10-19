/**
 * Calibration reminder service
 *
 * Provides functions to schedule and manage calibration reminder notifications.
 * Integrates with local notifications system for Android 13/14 compatibility.
 *
 * Requirements: 8.4
 */

import * as Notifications from 'expo-notifications';

import type { CalibrationModel } from '@/lib/watermelon-models/calibration';

import {
  calculateDaysUntilExpiry,
  getCalibrationQualityStatus,
} from '../utils/calibration-calculations';

// ============================================================================
// Constants
// ============================================================================

/**
 * Reminder thresholds in days before expiration
 */
const REMINDER_THRESHOLDS = {
  FIRST_WARNING: 7, // First reminder at 7 days before expiry
  FINAL_WARNING: 1, // Final reminder at 1 day before expiry
} as const;

/**
 * Notification identifier prefixes
 */
const NOTIFICATION_ID_PREFIX = {
  CALIBRATION_WARNING: 'calibration-warning-',
  CALIBRATION_EXPIRED: 'calibration-expired-',
} as const;

// ============================================================================
// Reminder Scheduling
// ============================================================================

/**
 * Schedules calibration reminder notifications for a calibration
 * Creates notifications for both warning and expiry events
 *
 * @param calibration - Calibration model to schedule reminders for
 * @returns Promise<string[]> - Array of scheduled notification IDs
 */
export async function scheduleCalibrationReminders(
  calibration: CalibrationModel
): Promise<string[]> {
  const notificationIds: string[] = [];

  const daysUntilExpiry = calculateDaysUntilExpiry(calibration.expiresAt);
  const status = getCalibrationQualityStatus(daysUntilExpiry);

  // Don't schedule if already expired
  if (status === 'expired') {
    return notificationIds;
  }

  // Schedule first warning (7 days before expiry)
  const firstWarningId = await scheduleFirstWarningNotification(calibration);
  if (firstWarningId) {
    notificationIds.push(firstWarningId);
  }

  // Schedule final warning (1 day before expiry)
  const finalWarningId = await scheduleFinalWarningNotification(calibration);
  if (finalWarningId) {
    notificationIds.push(finalWarningId);
  }

  // Schedule expiry notification
  const expiryId = await scheduleExpiryNotification(calibration);
  if (expiryId) {
    notificationIds.push(expiryId);
  }

  return notificationIds;
}

/**
 * Schedules the first warning notification (7 days before expiry)
 */
async function scheduleFirstWarningNotification(
  calibration: CalibrationModel
): Promise<string | null> {
  const firstWarningDate = new Date(
    calibration.expiresAt -
      REMINDER_THRESHOLDS.FIRST_WARNING * 24 * 60 * 60 * 1000
  );

  if (firstWarningDate.getTime() <= Date.now()) {
    return null;
  }

  return scheduleNotification({
    identifier: `${NOTIFICATION_ID_PREFIX.CALIBRATION_WARNING}${calibration.id}-first`,
    title: 'Meter Calibration Reminder',
    body: `Your ${calibration.type.toUpperCase()} meter calibration expires in ${REMINDER_THRESHOLDS.FIRST_WARNING} days. Consider recalibrating soon.`,
    trigger: firstWarningDate,
    data: {
      calibrationId: calibration.id,
      meterId: calibration.meterId,
      type: calibration.type,
      reminderType: 'first_warning',
    },
  });
}

/**
 * Schedules the final warning notification (1 day before expiry)
 */
async function scheduleFinalWarningNotification(
  calibration: CalibrationModel
): Promise<string | null> {
  const finalWarningDate = new Date(
    calibration.expiresAt -
      REMINDER_THRESHOLDS.FINAL_WARNING * 24 * 60 * 60 * 1000
  );

  if (finalWarningDate.getTime() <= Date.now()) {
    return null;
  }

  return scheduleNotification({
    identifier: `${NOTIFICATION_ID_PREFIX.CALIBRATION_WARNING}${calibration.id}-final`,
    title: 'Urgent: Meter Calibration Expiring',
    body: `Your ${calibration.type.toUpperCase()} meter calibration expires tomorrow. Recalibrate before your next measurement.`,
    trigger: finalWarningDate,
    data: {
      calibrationId: calibration.id,
      meterId: calibration.meterId,
      type: calibration.type,
      reminderType: 'final_warning',
    },
  });
}

/**
 * Schedules the expiry notification
 */
async function scheduleExpiryNotification(
  calibration: CalibrationModel
): Promise<string | null> {
  const expiryDate = new Date(calibration.expiresAt);

  if (expiryDate.getTime() <= Date.now()) {
    return null;
  }

  return scheduleNotification({
    identifier: `${NOTIFICATION_ID_PREFIX.CALIBRATION_EXPIRED}${calibration.id}`,
    title: 'Meter Calibration Expired',
    body: `Your ${calibration.type.toUpperCase()} meter calibration has expired. Recalibrate for accurate measurements.`,
    trigger: expiryDate,
    data: {
      calibrationId: calibration.id,
      meterId: calibration.meterId,
      type: calibration.type,
      reminderType: 'expired',
    },
  });
}

/**
 * Cancels all scheduled reminders for a calibration
 *
 * @param calibrationId - Calibration ID
 */
export async function cancelCalibrationReminders(
  calibrationId: string
): Promise<void> {
  try {
    // Get all scheduled notifications
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();

    // Find and cancel notifications for this calibration
    const idsToCancel = scheduled
      .filter(
        (notif) =>
          notif.identifier?.includes(calibrationId) ||
          ((notif as any).content?.data &&
            'calibrationId' in (notif as any).content.data &&
            (notif as any).content.data.calibrationId === calibrationId)
      )
      .map((notif) => notif.identifier);

    if (idsToCancel.length > 0) {
      for (const id of idsToCancel) {
        await Notifications.cancelScheduledNotificationAsync(id);
      }
    }
  } catch (error) {
    console.error('Error canceling calibration reminders:', error);
  }
}

/**
 * Cancels all calibration reminder notifications
 */
export async function cancelAllCalibrationReminders(): Promise<void> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();

    const idsToCancel = scheduled
      .filter(
        (notif) =>
          notif.identifier?.startsWith(
            NOTIFICATION_ID_PREFIX.CALIBRATION_WARNING
          ) ||
          notif.identifier?.startsWith(
            NOTIFICATION_ID_PREFIX.CALIBRATION_EXPIRED
          )
      )
      .map((notif) => notif.identifier);

    if (idsToCancel.length > 0) {
      for (const id of idsToCancel) {
        await Notifications.cancelScheduledNotificationAsync(id);
      }
    }
  } catch (error) {
    console.error('Error canceling all calibration reminders:', error);
  }
}

// ============================================================================
// Immediate Notifications
// ============================================================================

/**
 * Sends immediate notification for stale calibration
 * Used when a stale calibration is detected during reading input
 *
 * @param meterId - Meter ID
 * @param type - Calibration type
 * @param daysExpired - Number of days since expiration
 */
export async function notifyStaleCalibration(
  meterId: string,
  type: 'ph' | 'ec',
  daysExpired: number
): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Stale Meter Calibration Detected',
        body: `Your ${type.toUpperCase()} meter calibration expired ${Math.abs(daysExpired)} days ago. Recalibrate for accurate measurements.`,
        data: {
          meterId,
          type,
          daysExpired,
        },
      },
      trigger: null, // Immediate delivery
    });
  } catch (error) {
    console.error('Error sending stale calibration notification:', error);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Schedules a notification with proper error handling
 * Handles Android 13/14 permission requirements
 *
 * @param options - Notification options
 * @returns Promise<string | null> - Notification ID or null if failed
 */
async function scheduleNotification(options: {
  identifier: string;
  title: string;
  body: string;
  trigger: Date | null;
  data?: Record<string, any>;
}): Promise<string | null> {
  try {
    // Note: Permission checking should be done at app initialization
    // We assume permissions are already granted or will fail gracefully

    // Prepare trigger
    const triggerDate = options.trigger || new Date(Date.now() + 1000); // Immediate if no trigger specified

    // Schedule notification
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: options.title,
        body: options.body,
        data: {
          ...options.data,
          identifier: options.identifier, // Store identifier in data
        },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(
          1,
          Math.floor((triggerDate.getTime() - Date.now()) / 1000)
        ),
      },
    });

    return notificationId;
  } catch (error) {
    console.error('Error scheduling notification:', error);
    return null;
  }
}

/**
 * Gets all scheduled calibration reminder notifications
 * Useful for debugging and status checks
 *
 * @returns Promise<Array<{ id: string, calibrationId: string, scheduledFor: Date }>>
 */
export async function getScheduledCalibrationReminders(): Promise<
  { id: string; calibrationId: string; scheduledFor: Date }[]
> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();

    return scheduled
      .filter(
        (notif) =>
          notif.identifier?.startsWith(
            NOTIFICATION_ID_PREFIX.CALIBRATION_WARNING
          ) ||
          notif.identifier?.startsWith(
            NOTIFICATION_ID_PREFIX.CALIBRATION_EXPIRED
          )
      )
      .map((notif) => ({
        id: notif.identifier,
        calibrationId:
          ((notif as any).content?.data?.calibrationId as string) || 'unknown',
        scheduledFor: (notif as any).trigger
          ? new Date(((notif as any).trigger as any).value * 1000)
          : new Date(),
      }));
  } catch (error) {
    console.error('Error getting scheduled reminders:', error);
    return [];
  }
}
