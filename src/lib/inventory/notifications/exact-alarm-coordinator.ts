/**
 * Exact Alarm Coordinator
 *
 * Manages Android 13+ (API 33+) SCHEDULE_EXACT_ALARM permission for
 * time-sensitive low-stock notifications.
 *
 * Compliance: Play Store policy requires user-visible rationale before
 * requesting permission, with fallback to inexact alarms when denied.
 *
 * Requirements: 4.2
 */

import { Alert, Linking, NativeModules, Platform } from 'react-native';

import { captureCategorizedErrorSync } from '@/lib/sentry-utils';

import { trackExactAlarmPermission } from '../telemetry/stock-telemetry';

export type ExactAlarmPermissionStatus =
  | { status: 'granted' }
  | { status: 'denied'; fallbackAvailable: true }
  | { status: 'unavailable' };

export interface ExactAlarmCoordinatorAPI {
  /**
   * Check if exact alarms can be scheduled
   *
   * @returns True if permission granted or not required (pre-API 33)
   */
  canScheduleExactAlarms(): Promise<boolean>;

  /**
   * Get detailed permission status
   *
   * @returns Permission status with fallback info
   */
  getPermissionStatus(): Promise<ExactAlarmPermissionStatus>;

  /**
   * Request exact alarm permission (Android 13+ only)
   *
   * Shows user-visible rationale before launching permission screen.
   * Complies with Play Store policy by providing clear use case explanation.
   *
   * @param rationale - Optional custom rationale text
   * @returns True if permission granted after request
   */
  requestPermission(rationale?: string): Promise<boolean>;

  /**
   * Open app settings for manual permission grant
   *
   * Used as secondary option when user dismisses rationale.
   */
  openAppSettings(): Promise<void>;
}

const DEFAULT_RATIONALE =
  'GrowBro needs exact alarm permission to send timely low-stock alerts for your cultivation supplies. Without it, notifications may be delayed by up to 15 minutes.';

/**
 * Check if exact alarms are available on this platform
 */
function isExactAlarmSupported(): boolean {
  if (Platform.OS !== 'android') return false;
  if (typeof Platform.Version !== 'number') return false;
  return Platform.Version >= 33; // Android 13+
}

/**
 * Check via native module if exact alarms can be scheduled
 */
async function nativeCanScheduleExactAlarms(): Promise<boolean> {
  if (!isExactAlarmSupported()) return true; // Not required on older versions

  try {
    // Try to use native AlarmManager check if available
    const { AlarmManager } = NativeModules;
    if (
      AlarmManager &&
      typeof AlarmManager.canScheduleExactAlarms === 'function'
    ) {
      return await AlarmManager.canScheduleExactAlarms();
    }

    // Fallback: Assume permission is required but not granted
    // This conservative approach defaults to inexact alarms
    return false;
  } catch (error) {
    captureCategorizedErrorSync(error, {
      category: 'inventory',
      context: { method: 'nativeCanScheduleExactAlarms' },
    });
    return false;
  }
}

/**
 * Launch exact alarm permission settings screen
 */
async function launchExactAlarmPermissionScreen(): Promise<boolean> {
  try {
    const intent = 'android.settings.REQUEST_SCHEDULE_EXACT_ALARM';
    const supported = await Linking.canOpenURL(`intent://${intent}`);

    if (supported) {
      await Linking.openSettings();
      // Wait a bit for user to interact with settings
      await new Promise((resolve) => setTimeout(resolve, 500));
      // Check new status
      return await nativeCanScheduleExactAlarms();
    }

    return false;
  } catch (error) {
    captureCategorizedErrorSync(error, {
      category: 'inventory',
      context: { method: 'launchExactAlarmPermissionScreen' },
    });
    return false;
  }
}

export const ExactAlarmCoordinator: ExactAlarmCoordinatorAPI = {
  async canScheduleExactAlarms(): Promise<boolean> {
    return nativeCanScheduleExactAlarms();
  },

  async getPermissionStatus(): Promise<ExactAlarmPermissionStatus> {
    if (!isExactAlarmSupported()) {
      return { status: 'unavailable' };
    }

    const canSchedule = await nativeCanScheduleExactAlarms();

    if (canSchedule) {
      return { status: 'granted' };
    }

    return { status: 'denied', fallbackAvailable: true };
  },

  async requestPermission(rationale?: string): Promise<boolean> {
    if (!isExactAlarmSupported()) {
      return true; // Not required
    }

    // Check if already granted
    const alreadyGranted = await nativeCanScheduleExactAlarms();
    if (alreadyGranted) return true;

    // Show rationale dialog (required by Play Store policy)
    return new Promise((resolve) => {
      Alert.alert(
        'Enable Timely Alerts',
        rationale || DEFAULT_RATIONALE,
        [
          {
            text: 'Use Flexible Notifications',
            style: 'cancel',
            onPress: () => resolve(false),
          },
          {
            text: 'Enable',
            onPress: async () => {
              const granted = await launchExactAlarmPermissionScreen();
              // Track permission outcome
              await trackExactAlarmPermission(granted, 'initial');
              resolve(granted);
            },
          },
        ],
        { cancelable: true, onDismiss: () => resolve(false) }
      );
    });
  },

  async openAppSettings(): Promise<void> {
    try {
      await Linking.openSettings();
    } catch (error) {
      captureCategorizedErrorSync(error, {
        category: 'inventory',
        context: { method: 'openAppSettings' },
      });
    }
  },
};
