import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import type { DeviceContext } from '@/types/support';

/**
 * Capture device context for support tickets
 * Minimizes PII collection while providing debugging context
 */
export async function captureDeviceContext(
  lastRoute?: string,
  sentryLastErrorId?: string
): Promise<DeviceContext> {
  const context: DeviceContext = {
    appVersion: Constants.expoConfig?.version || 'unknown',
    osVersion: `${Platform.OS} ${Platform.Version}`,
    deviceModel: await getDeviceModel(),
    locale: await getDeviceLocale(),
    lastRoute,
    sentryLastErrorId,
  };

  return context;
}

/**
 * Get device model (anonymized for privacy)
 */
async function getDeviceModel(): Promise<string> {
  try {
    const modelName = await Device.modelName;
    const deviceType = Device.deviceType;

    // Return generic device type instead of specific model for privacy
    if (Platform.OS === 'ios') {
      if (deviceType === Device.DeviceType.PHONE) {
        return 'iPhone';
      } else if (deviceType === Device.DeviceType.TABLET) {
        return 'iPad';
      }
      return 'iOS Device';
    } else if (Platform.OS === 'android') {
      if (deviceType === Device.DeviceType.PHONE) {
        return 'Android Phone';
      } else if (deviceType === Device.DeviceType.TABLET) {
        return 'Android Tablet';
      }
      return 'Android Device';
    }

    return modelName || 'Unknown Device';
  } catch {
    return 'Unknown Device';
  }
}

/**
 * Get device locale
 */
async function getDeviceLocale(): Promise<string> {
  try {
    const { getLocales } = await import('expo-localization');
    const locales = getLocales();
    return locales[0]?.languageTag || 'en';
  } catch {
    return 'en';
  }
}

/**
 * Format device context for display
 */
export function formatDeviceContext(context: DeviceContext): string {
  const lines = [
    `App Version: ${context.appVersion}`,
    `OS: ${context.osVersion}`,
    `Device: ${context.deviceModel}`,
    `Locale: ${context.locale}`,
  ];

  if (context.lastRoute) {
    lines.push(`Last Screen: ${context.lastRoute}`);
  }

  if (context.sentryLastErrorId) {
    lines.push(`Error ID: ${context.sentryLastErrorId}`);
  }

  return lines.join('\n');
}

/**
 * Validate device context for PII
 */
export function validateDeviceContext(context: DeviceContext): {
  isValid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];

  // Check for potential PII in last route
  if (context.lastRoute && containsPII(context.lastRoute)) {
    warnings.push('Last route may contain personal information');
  }

  return {
    isValid: warnings.length === 0,
    warnings,
  };
}

/**
 * Simple PII detection in strings
 */
function containsPII(text: string): boolean {
  // Check for email patterns
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  if (emailPattern.test(text)) {
    return true;
  }

  // Check for UUID patterns (might be user IDs)
  const uuidPattern =
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  if (uuidPattern.test(text)) {
    return true;
  }

  return false;
}
