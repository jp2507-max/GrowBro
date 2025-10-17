/**
 * Exact Alarm Permission Utilities
 *
 * Android 13+ requires SCHEDULE_EXACT_ALARM permission for precise notifications.
 * Provides permission checking, request flow, and fallback strategies.
 *
 * Requirements: 4.2
 */

import { Platform } from 'react-native';

import { PermissionManager } from './permission-manager';

export type ExactAlarmPermissionStatus =
  | 'granted'
  | 'denied'
  | 'not-applicable'
  | 'unknown';

/**
 * Check if exact alarm permission is granted (Android 13+).
 * Returns 'not-applicable' on iOS or Android <13.
 */
export async function checkExactAlarmPermission(): Promise<ExactAlarmPermissionStatus> {
  if (Platform.OS !== 'android') {
    return 'not-applicable';
  }

  if (Platform.Version < 31) {
    // Android <12 doesn't require SCHEDULE_EXACT_ALARM
    return 'not-applicable';
  }

  try {
    const result = await PermissionManager.handleExactAlarmPermission();
    if (result.status === 'granted') {
      return 'granted';
    }
    if (result.status === 'denied') {
      return 'denied';
    }
    return 'not-applicable';
  } catch (error) {
    console.error('Failed to check exact alarm permission:', error);
    return 'unknown';
  }
}

/**
 * Request exact alarm permission (Android 13+).
 * On Android 13+, this should direct users to system settings.
 */
export async function requestExactAlarmPermission(): Promise<ExactAlarmPermissionStatus> {
  if (Platform.OS !== 'android') {
    return 'not-applicable';
  }

  if (Platform.Version < 31) {
    return 'not-applicable';
  }

  try {
    const result = await PermissionManager.requestExactAlarmIfJustified();
    if (result.status === 'granted') {
      return 'granted';
    }
    if (result.status === 'denied') {
      return 'denied';
    }
    return 'not-applicable';
  } catch (error) {
    console.error('Failed to request exact alarm permission:', error);
    return 'denied';
  }
}

/**
 * Check if we should show the exact alarm permission prompt.
 * Only show on Android 12+ when permission is denied.
 */
export function shouldShowExactAlarmPrompt(
  status: ExactAlarmPermissionStatus
): boolean {
  return (
    Platform.OS === 'android' && Platform.Version >= 31 && status === 'denied'
  );
}
