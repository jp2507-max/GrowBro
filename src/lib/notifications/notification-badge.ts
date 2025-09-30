/**
 * Notification badge management with platform-specific constraints
 *
 * Platform Limitations (CRITICAL):
 *
 * iOS:
 * - Numeric badge count supported via setBadgeCountAsync()
 * - Badge appears on app icon reliably
 * - Syncs with server unread notification count
 *
 * Android:
 * - Numeric icon badges NOT guaranteed across launchers
 * - Samsung/Nova launchers MAY show badges (launcher-dependent)
 * - Stock Android/Pixel launchers typically DO NOT show numeric badges
 * - Some launchers only show dot indicator (no number)
 *
 * Implementation Strategy:
 * - Always update badge count on iOS (reliable)
 * - Attempt badge update on Android (best-effort, launcher-dependent)
 * - ALWAYS render in-app badge UI (primary indicator for Android)
 * - Do NOT rely on launcher badges for critical notifications
 *
 * Testing Notes:
 * - Test badge clearing on iOS (setBadgeCountAsync(0))
 * - Test in-app badge UI on Android (don't assume launcher badge)
 * - Document that Android launcher badges are unreliable
 *
 * @see https://developer.android.com/develop/ui/views/notifications/badges
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

type SetBadgeCountFn = (count: number) => Promise<void>;

const notificationsModule = Notifications as unknown as {
  setBadgeCountAsync?: SetBadgeCountFn;
};

const setBadgeCountAsync: SetBadgeCountFn =
  notificationsModule.setBadgeCountAsync ?? (async () => {});

const BADGE_TAG = '[notification-badge]';

function sanitizeCount(count: number): number {
  if (!Number.isFinite(count) || count <= 0) {
    return 0;
  }
  return Math.floor(count);
}

/**
 * Update app badge count
 *
 * iOS: Reliably updates numeric badge on app icon
 * Android: Best-effort attempt; launcher-dependent (NOT GUARANTEED)
 *
 * IMPORTANT: For Android, always render in-app badge UI as primary indicator.
 * Launcher badges are unreliable and should be treated as a bonus feature.
 */
export async function updateAppBadgeCount(count: number): Promise<void> {
  const sanitized = sanitizeCount(count);

  // Always attempt to set badge count
  // iOS: Will update app icon badge reliably
  // Android: May update launcher badge depending on launcher implementation
  try {
    await setBadgeCountAsync(sanitized);

    if (Platform.OS === 'android') {
      // Log Android badge update attempts for debugging
      // Note: This does NOT guarantee visible badge on all launchers
      if (sanitized > 0 && __DEV__) {
        console.log(
          `${BADGE_TAG} Android badge count set to ${sanitized} (launcher-dependent visibility)`
        );
      }
    }
  } catch (error) {
    const message =
      error instanceof Error
        ? `${error.name}: ${error.message}`
        : String(error);
    console.warn(`${BADGE_TAG} failed to update badge`, message);
  }
}

export function __sanitizeBadgeCount(count: number): number {
  return sanitizeCount(count);
}
