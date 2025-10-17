/**
 * Exact Alarm Permission Status Hook
 *
 * Tracks Android 13+ exact alarm permission status and provides
 * state management for fallback banner display.
 *
 * Requirements: 4.2
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { ExactAlarmCoordinator } from './notifications/exact-alarm-coordinator';

const BANNER_DISMISSED_KEY = 'inventory.exactAlarmBannerDismissed';

export interface UseExactAlarmPermissionStatusResult {
  /** Whether user has exact alarm permission */
  hasPermission: boolean;
  /** Whether to show fallback banner (denied + not dismissed) */
  shouldShowBanner: boolean;
  /** Dismiss the fallback banner */
  dismissBanner: () => Promise<void>;
  /** Refresh permission status */
  refresh: () => Promise<void>;
  /** Whether initial check is loading */
  isLoading: boolean;
}

/**
 * Hook to track exact alarm permission status for inventory alerts
 *
 * Shows fallback banner when:
 * - Android 13+ device
 * - Permission denied
 * - User hasn't dismissed banner
 *
 * @example
 * ```tsx
 * const { shouldShowBanner, dismissBanner } = useExactAlarmPermissionStatus();
 *
 * {shouldShowBanner && (
 *   <ExactAlarmFallbackBanner onDismiss={dismissBanner} />
 * )}
 * ```
 */
export function useExactAlarmPermissionStatus(): UseExactAlarmPermissionStatusResult {
  const [hasPermission, setHasPermission] = useState(true);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const checkPermission = useCallback(async () => {
    try {
      setIsLoading(true);

      // Only relevant for Android 13+
      if (Platform.OS !== 'android' || Platform.Version < 33) {
        setHasPermission(true);
        setBannerDismissed(true);
        return;
      }

      // Check permission status
      const granted = await ExactAlarmCoordinator.canScheduleExactAlarms();
      setHasPermission(granted);

      // Check if user dismissed banner
      const dismissed = await AsyncStorage.getItem(BANNER_DISMISSED_KEY);
      setBannerDismissed(dismissed === 'true');
    } catch {
      // Fail safe - assume permission granted
      setHasPermission(true);
      setBannerDismissed(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const dismissBanner = useCallback(async () => {
    try {
      await AsyncStorage.setItem(BANNER_DISMISSED_KEY, 'true');
      setBannerDismissed(true);
    } catch {
      // Ignore - banner will persist
    }
  }, []);

  const refresh = useCallback(async () => {
    await checkPermission();
  }, [checkPermission]);

  useEffect(() => {
    checkPermission();
  }, [checkPermission]);

  const shouldShowBanner = !hasPermission && !bannerDismissed && !isLoading;

  return {
    hasPermission,
    shouldShowBanner,
    dismissBanner,
    refresh,
    isLoading,
  };
}
