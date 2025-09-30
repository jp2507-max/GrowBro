# Notification System Platform Constraints

## Overview

This document outlines critical platform-specific constraints for the GrowBro notification system. Understanding these limitations is essential for setting realistic SLAs and implementing robust fallback strategies.

---

## Payload Size Limits

### APNs (iOS)

- **Hard limit**: 4096 bytes (4KB) total payload
- Includes: title, body, sound, badge, data fields, all metadata
- Exceeding limit: Notification silently dropped by APNs (no error to client)

### FCM (Android via Expo Push Service)

- **Similar constraints** to APNs (4KB recommended)
- Uses `collapse_key` for deduplication (counts toward payload size)

### Implementation

- **Server-side validation**: Edge Function checks payload size before sending
- **Truncation policy**: If body exceeds available space (after required metadata), truncate with "..." suffix
- **Safe limit**: 3800 bytes (leaves margin for overhead)
- **Long content**: Move full text behind deep links; notification shows preview only

### Testing

- Validate truncation at 3.5KB, 3.9KB, 4.1KB boundaries
- Test multi-byte UTF-8 characters (emojis, German umlauts)
- Ensure deep links always included (never truncated)

**Files:**

- `supabase/functions/send-push-notification/payload-validator.ts`
- `supabase/functions/send-push-notification/payload-validator.test.ts`

---

## Android 12+ Notification Trampoline Restrictions

### Critical Constraint

**Android 12+ blocks notification trampolines**: Notification taps MUST launch an Activity directly via `PendingIntent.getActivity()`. No BroadcastReceiver or Service hops allowed.

### What is a Notification Trampoline?

A notification trampoline is an indirect launch pattern:

1. User taps notification
2. System delivers intent to BroadcastReceiver or Service
3. Receiver/Service starts an Activity

**This pattern is BLOCKED on Android 12+.**

### GrowBro Implementation

✅ **Compliant by default**:

- Expo Router uses `MainActivity` to handle all deep links
- `expo-notifications` creates PendingIntents with `getActivity()` targeting MainActivity
- No custom BroadcastReceivers in notification tap flow
- `FLAG_IMMUTABLE` set automatically (Android 12+ default)

### Flow

1. User taps notification
2. System launches MainActivity via `PendingIntent.getActivity()`
3. Expo Router (Linking API) processes deep link URL
4. DeepLinkService validates and navigates to target screen

### Validation

- Audit: Ensure no BroadcastReceivers registered for notification actions
- Test: Verify notification taps on Android 12+ devices/emulators
- Documentation: Reviewed in `pending-intent-audit.ts`

**Files:**

- `src/lib/notifications/pending-intent-audit.ts`
- `src/lib/notifications/pending-intent-audit.test.ts`

---

## Badge Count Limitations

### iOS

✅ **Numeric badges supported reliably**:

- `Notifications.setBadgeCountAsync()` updates app icon badge
- Badge count persists until explicitly cleared or app uninstalled
- Syncs with server unread notification count

### Android

⚠️ **Numeric icon badges NOT guaranteed**:

- **Stock Android/Pixel launchers**: Typically do NOT show numeric badges
- **Samsung/Nova launchers**: MAY show numeric badges (launcher-dependent)
- **Some launchers**: Only show dot indicator (no number)
- **No API guarantee**: Android does not enforce badge behavior

### Implementation Strategy

1. **iOS**: Always update badge count via `setBadgeCountAsync()`
2. **Android**: Attempt badge update (best-effort), but DO NOT rely on visibility
3. **Primary indicator**: Always render in-app badge UI (works on all platforms)
4. **Fallback**: For critical notifications, use visible notifications (not just badge)

### Testing

- iOS: Verify badge appears on app icon; clears when set to 0
- Android: Test in-app badge UI; document launcher-specific badge unreliability
- Do NOT assert launcher badge visibility on Android in automated tests

**Files:**

- `src/lib/notifications/notification-badge.ts`
- `src/lib/notifications/notification-badge.test.ts`

---

## Background Processing SLAs

### iOS Background Limitations

**Silent Push (content-available: 1)**:

- **Best-effort ONLY** - no guaranteed execution
- **Execution time limit**: <30 seconds per background session
- **Throttled by**:
  - App usage patterns (less usage = less background time)
  - Battery level (low battery = reduced background processing)
  - Low Power Mode (background processing severely limited)
  - Background App Refresh setting (user can disable)
- **Force-quit apps**: Do NOT receive background notifications
- **Not running = no background**: If app not in background/suspended, no silent push processing

**Realistic SLA**:

- Background updates: Hints only; no guaranteed delivery or timing
- Critical updates: Use visible notifications, not silent push
- Data consistency: Always reconcile on app resume/foreground

### Android Background Processing

**Data Messages**:

- Can trigger background sync via FCM data messages
- **Doze mode**: Severely limits background operations (batched delivery during maintenance windows)
- **App Standby**: Reduces background network access for infrequently used apps
- **Battery optimization**: User settings can further restrict background work

**WorkManager**:

- Provides deferred sync guarantee (not immediate)
- Subject to system constraints (Doze, battery optimization)
- Best for non-urgent background tasks

**Foreground Service**:

- Required for operations >30 seconds
- Requires visible notification (user knows app is working)
- Higher reliability than background processing

**Realistic SLA**:

- Background sync: Best-effort, subject to Doze and battery optimization
- Immediate sync: Requires foreground service (visible notification)
- Critical updates: Use foreground sync or visible notifications

### Implementation Strategy

1. **Use silent push as HINT for background sync**:
   - iOS: Attempt quick sync (<30s), fail gracefully
   - Android: Queue for WorkManager or foreground reconciliation

2. **Queue failed operations for foreground retry**:
   - Store pending sync operations in local queue
   - Process queue when app returns to foreground

3. **Always reconcile data on app open** (`notification-sync.ts`):
   - Fetch latest unread count from server
   - Sync missed notifications
   - Update badge count
   - **This is the source of truth**

4. **Set realistic user expectations**:
   - Do NOT promise immediate background sync
   - Document that force-quit apps won't receive background updates
   - Foreground reconciliation ensures eventual consistency

### Testing Scenarios

- **Force-quit**: App terminated by user → no background processing
- **Low Power Mode (iOS)**: Background App Refresh disabled → no silent push
- **Doze Mode (Android)**: Device idle → batched delivery only
- **Battery Saver**: Background processing restricted
- **Foreground reconciliation**: Always verify data syncs when app opens

**Files:**

- `src/lib/notifications/background-handler.ts`
- `src/lib/notifications/notification-sync.ts`

---

## Summary Table

| Constraint               | Platform    | Limitation                        | Mitigation                                               |
| ------------------------ | ----------- | --------------------------------- | -------------------------------------------------------- |
| Payload Size             | iOS/Android | 4KB total                         | Server-side truncation, deep links for full content      |
| Notification Trampolines | Android 12+ | No BroadcastReceiver/Service hops | Use `PendingIntent.getActivity()` (Expo default)         |
| Badge Count              | Android     | No guarantee across launchers     | In-app badge UI as primary indicator                     |
| Background Processing    | iOS         | Best-effort, <30s, throttled      | Foreground reconciliation on app open                    |
| Background Processing    | Android     | Doze mode, battery optimization   | WorkManager for deferred sync, foreground reconciliation |

---

## Key Takeaways

1. **Payload limits are hard**: Validate and truncate server-side; move long content to deep links
2. **Trampolines are blocked**: Expo Router compliant by default; no custom BroadcastReceivers
3. **Badge counts are unreliable on Android**: Always render in-app badges; launcher badges are bonus
4. **Background processing is unreliable**: Use as hints only; foreground reconciliation is source of truth
5. **Set realistic SLAs**: No guaranteed background sync; visible notifications for critical updates

**Last updated**: September 30, 2025
