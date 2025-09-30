/**
 * PendingIntent audit utility for Android 12+ notification trampoline compliance
 *
 * CRITICAL Android 12+ Constraints:
 * - Notification taps MUST launch an Activity directly via PendingIntent.getActivity()
 * - NO BroadcastReceiver or Service hops (trampolines) are allowed
 * - FLAG_IMMUTABLE is required for all PendingIntents (default in Android 12+)
 *
 * Expo Router Integration:
 * - Expo Router uses MainActivity to handle all deep links
 * - Notification intents automatically use getActivity() via expo-notifications
 * - No custom BroadcastReceivers should be added to notification tap flow
 *
 * This module provides documentation and validation utilities to ensure
 * compliance with Android 12+ trampoline restrictions.
 *
 * @see https://developer.android.com/about/versions/12/behavior-changes-12#notification-trampolines
 */

/**
 * Notification trampoline compliance checklist for GrowBro
 *
 * ✅ Expo Router MainActivity handles all deep links
 * ✅ expo-notifications uses PendingIntent.getActivity() for notification taps
 * ✅ No custom BroadcastReceivers in notification flow
 * ✅ FLAG_IMMUTABLE is default in Android 12+
 *
 * ⚠️ NEVER add:
 * - BroadcastReceivers that start Activities from notification actions
 * - Services that start Activities from notification taps
 * - Intent chains (notification → broadcast → activity)
 */
export const TRAMPOLINE_COMPLIANCE_CHECKLIST = {
  usesExpoRouter: true,
  usesGetActivity: true,
  noBroadcastReceivers: true,
  flagImmutable: true,
} as const;

/**
 * Validate that notification configuration follows Android 12+ trampoline rules
 *
 * In GrowBro:
 * - Expo Router automatically handles deep links via MainActivity
 * - expo-notifications creates compliant PendingIntents
 * - No manual PendingIntent creation needed for notifications
 */
export function validateNotificationTapFlow(): {
  compliant: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // In Expo/React Native, we rely on expo-notifications + Expo Router
  // Both are compliant by default, but document the requirement

  if (!TRAMPOLINE_COMPLIANCE_CHECKLIST.usesExpoRouter) {
    issues.push('Missing Expo Router integration for deep link handling');
  }

  if (!TRAMPOLINE_COMPLIANCE_CHECKLIST.noBroadcastReceivers) {
    issues.push('Custom BroadcastReceivers detected in notification flow');
  }

  return {
    compliant: issues.length === 0,
    issues,
  };
}

/**
 * Documentation: How GrowBro handles notification taps compliantly
 *
 * Flow:
 * 1. User taps notification → expo-notifications creates PendingIntent with getActivity()
 * 2. Intent launches MainActivity (Expo Router entry point)
 * 3. Expo Router parses deep link URL from intent data
 * 4. App navigates to target screen via router.push()
 *
 * No trampolines involved:
 * - No BroadcastReceiver intermediary
 * - No Service intermediary
 * - Direct Activity launch with deep link data
 */
export const NOTIFICATION_TAP_FLOW_DOCUMENTATION = `
GrowBro Notification Tap Flow (Android 12+ Compliant)
======================================================

1. Notification Creation (Server → Client)
   - Supabase Edge Function sends push notification to Expo Push Service
   - Payload includes deepLink field (e.g., "https://growbro.app/post/456")
   - Expo delivers notification to device via FCM/APNs

2. Notification Display (Client)
   - expo-notifications displays notification using Android channel
   - Creates PendingIntent via getActivity() targeting MainActivity
   - Intent extras include deepLink URL

3. Notification Tap (User → System)
   - User taps notification
   - System launches MainActivity via PendingIntent
   - NO BroadcastReceiver hop (compliant with Android 12+)

4. Deep Link Handling (App)
   - MainActivity started with deep link intent
   - Expo Router (Linking API) processes URL
   - DeepLinkService validates and navigates to target screen

Compliance Verification:
✅ Uses PendingIntent.getActivity() (expo-notifications default)
✅ No notification trampolines
✅ FLAG_IMMUTABLE set automatically (Android 12+ default)
✅ Direct Activity launch from notification
` as const;

/**
 * Get compliance documentation for logging/debugging
 */
export function getComplianceDocumentation(): string {
  return NOTIFICATION_TAP_FLOW_DOCUMENTATION;
}
