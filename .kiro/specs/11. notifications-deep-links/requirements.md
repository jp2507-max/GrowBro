# Requirements Document

## Introduction

This feature implements a comprehensive notification system for GrowBro that includes local notifications, push notifications, deep linking capabilities, and user notification preferences management. The system will handle community interactions (replies, likes), cultivation reminders, and provide seamless navigation through deep links while respecting user privacy and platform-specific requirements.

## Platform-Specific Foundation

### Notification Channels & Categories

- **Android 8+**: Mandatory notification channels with predefined importance levels and localized names/descriptions
- **iOS 15+**: Notification categories with interruption levels (.active, .timeSensitive) and thread identifiers for grouping
- **Channel/Category Matrix**:
  - `community.interactions` (Android) / `COMMUNITY_INTERACTIONS` (iOS) - Medium importance/.active
  - `community.likes` (Android) / `COMMUNITY_LIKES` (iOS) - Low importance/.active
  - `cultivation.reminders` (Android) / `CULTIVATION_REMINDERS` (iOS) - High importance/.timeSensitive
  - `system.updates` (Android) / `SYSTEM_UPDATES` (iOS) - Medium importance/.active

### Token Management

- Device tokens rotate unpredictably; fetch on startup and token refresh events
- Sync tokens to server with timestamps; purge stale tokens on send failures
- Handle token rotation after app reinstalls and data clears

### Privacy & Security

- Minimize PII in push payloads; keep sensitive details server-side
- Validate all deep-link parameters and allowlist routes
- Reject external redirects to prevent open-redirect phishing

## Requirements

### Requirement 1

**User Story:** As a GrowBro user, I want to receive push notifications for community interactions, so that I can stay engaged with replies and reactions to my posts.

#### Acceptance Criteria

1. WHEN another user replies to my post THEN the system SHALL send a push notification using `community.interactions` channel with reply preview (max 100 chars)
2. WHEN another user likes my post THEN the system SHALL send a push notification using `community.likes` channel with FCM collapse_key/APNs apns-collapse-id for deduplication
3. WHEN I tap on a community notification THEN the app SHALL launch Activity directly via PendingIntent.getActivity (Android 12+ trampoline compliance)
4. WHEN multiple interactions occur THEN the system SHALL group using collapseKey (FCM) for deduplication and threadIdentifier per post (iOS); note that client-side grouping is limited by expo-notifications API constraints
5. WHEN notification payload is created THEN it SHALL include deep link, message_id for tracking, and iOS thread-id for grouping
6. WHEN channels don't exist before posting THEN the notification SHALL fail on Android 8+ (channels must be pre-created)
7. WHEN notification includes actions THEN the system SHALL provide Reply and View Profile using UNNotificationAction (iOS) and action buttons (Android)

### Requirement 2

**User Story:** As a cultivation enthusiast, I want to receive local reminders for my grow tasks, so that I never miss important cultivation activities.

#### Acceptance Criteria

1. WHEN a scheduled task is due THEN the system SHALL send a local notification using `cultivation.reminders` channel
2. WHEN on iOS THEN the system SHALL implement rolling scheduler for max 64 pending local notifications limit
3. WHEN on Android 13+ and exact timing required THEN the system SHALL request SCHEDULE_EXACT_ALARM permission with fallback to WorkManager for inexact timing
4. WHEN I have overdue tasks THEN the system SHALL send daily reminders respecting Doze mode delays on Android
5. WHEN I tap on a task reminder THEN the app SHALL navigate to specific task or calendar view
6. WHEN I complete a task THEN the system SHALL cancel pending notifications by notification ID
7. WHEN I reschedule a task THEN the system SHALL cancel old notifications and schedule new ones with updated timing

### Requirement 3

**User Story:** As a privacy-conscious user, I want to control my notification preferences by category, so that I only receive notifications that are relevant to me.

#### Acceptance Criteria

1. WHEN I first install the app THEN the system SHALL show pre-permission education screen following Apple HIG before requesting permissions
2. WHEN on iOS THEN the system SHALL support provisional authorization for "Deliver Quietly" mode
3. WHEN I access notification settings THEN I SHALL see toggles mapped to channels (Android) and categories (iOS) with deep links to system settings
4. WHEN I disable a notification category THEN the system SHALL stop posting to that channel/category
5. WHEN I enable quiet hours THEN the system SHALL implement app-level suppression (not OS-level DND override)
6. WHEN on Android THEN the system SHALL list visible channels with deep links to system channel settings
7. WHEN permissions are denied THEN the system SHALL provide in-app "Enable notifications" CTA with deep link to app settings

### Requirement 4

**User Story:** As a mobile user, I want deep links to work seamlessly, so that I can navigate directly to specific content from notifications or shared links.

#### Acceptance Criteria

1. WHEN I receive a Universal Link (iOS) or App Link (Android) THEN the system SHALL verify domain with apple-app-site-association and assetlinks.json
2. WHEN the app is closed and I tap a deep link THEN the app SHALL launch and navigate to target content
3. WHEN the app is backgrounded and I tap a deep link THEN the app SHALL come to foreground and navigate appropriately
4. WHEN deep link points to protected content THEN the system SHALL stash target URL, authenticate user, then route to content
5. WHEN deep link is invalid or expired THEN the system SHALL show error message and fallback to home screen
6. WHEN app isn't installed THEN Universal/App Links SHALL open website with Smart App Banner (iOS) or Play Store redirect
7. WHEN domain verification is required THEN the system SHALL serve AASA with correct MIME type and no redirects
8. WHEN testing deep links THEN the system SHALL handle re-install scenarios requiring domain re-verification

### Requirement 5

**User Story:** As a user on Android 13+, I want the app to properly request notification permissions, so that I can make informed decisions about receiving notifications.

#### Acceptance Criteria

1. WHEN I'm on Android 13+ THEN the system SHALL request POST_NOTIFICATIONS permission with educational context before system dialog
2. WHEN I deny notification permission THEN the app SHALL continue functioning with in-app notification center and badges
3. WHEN I previously denied permissions THEN the system SHALL provide "Enable notifications" CTA with deep link to app settings
4. WHEN notification permission is denied THEN the system SHALL show in-app alternatives for important updates
5. WHEN permission is granted THEN the system SHALL immediately enable selected notification categories
6. WHEN on Android 13+/14 and exact alarms needed THEN the system SHALL request SCHEDULE_EXACT_ALARM/USE_EXACT_ALARM with clear justification

### Requirement 6

**User Story:** As a user, I want to see all my notifications in one place within the app, so that I can catch up on missed updates even when push notifications are disabled.

#### Acceptance Criteria

1. WHEN I open the in-app notification center THEN I SHALL see notifications stored in WatermelonDB with read_at, deleted_at timestamps
2. WHEN I tap on an in-app notification THEN the system SHALL use same deep link routing as push notifications
3. WHEN I mark notifications as read THEN they SHALL be visually distinguished with read_at timestamp
4. WHEN I have unread notifications THEN the system SHALL show badge count matching server unread count
5. WHEN notifications are older than 30 days THEN the system SHALL archive them (configurable per user)
6. WHEN offline THEN the system SHALL cache notifications locally and sync with server cursor/pagination
7. WHEN GDPR delete is requested THEN the system SHALL provide notification deletion flow

### Requirement 7

**User Story:** As a product manager, I want to track notification delivery and engagement metrics, so that I can optimize the notification strategy.

#### Acceptance Criteria

1. WHEN a push notification is sent THEN the system SHALL include message_id in payload for tracking push → open correlation
2. WHEN a user opens a notification THEN the system SHALL record engagement event in-app (APNs doesn't report device-level delivery)
3. WHEN a user dismisses a notification on Android THEN the system SHALL track via deleteIntent (iOS has no dismissal callback)
4. WHEN using FCM THEN the system SHALL leverage BigQuery/diagnostics for delivery data where available
5. WHEN generating analytics reports THEN the system SHALL provide opt-in rates, delivery rates (limited), and engagement rates by category
6. WHEN delivery rate falls below 95% THEN the system SHALL alert administrators (noting platform limitations)

### Requirement 8

**User Story:** As a user, I want universal links to work across platforms, so that shared GrowBro content opens correctly regardless of how I access it.

#### Acceptance Criteria

1. WHEN I click a GrowBro link in browser THEN Universal/App Links SHALL open app if installed, otherwise show website with store redirect
2. WHEN I share a post link THEN other users SHALL open it directly in GrowBro app via verified domain links
3. WHEN I'm not logged in and click deep link THEN the system SHALL authenticate first using deferred navigation pattern
4. WHEN linked content is unavailable THEN the system SHALL show appropriate message and fallback
5. WHEN configuring Universal Links THEN the system SHALL serve apple-app-site-association with correct MIME, no redirects
6. WHEN configuring App Links THEN the system SHALL place assetlinks.json at .well-known/ with SHA-256 fingerprints
7. WHEN domain verification passes THEN the system SHALL handle both production and staging environment domains
8. WHEN testing after re-install THEN the system SHALL re-verify domain associations

### Requirement 9

**User Story:** As a user, I want background notification handling to work reliably, so that I receive timely updates even when the app is not active.

#### Acceptance Criteria

1. WHEN on iOS THEN the system SHALL use silent push with content-available: 1 and Background Modes → Remote notifications (execution not guaranteed)
2. WHEN on Android THEN the system SHALL use data messages with foreground service/WorkManager as needed
3. WHEN notification arrives in background THEN the system SHALL update local data respecting platform limitations
4. WHEN I return to app after notifications THEN content SHALL be up-to-date within platform constraints
5. WHEN app is force-quit or in Low Power Mode THEN the system SHALL set realistic SLAs for background updates
6. WHEN handling background notifications THEN the system SHALL respect Doze mode and battery optimization settings
7. WHEN user taps notification THEN the system SHALL avoid notification trampolines (Android 12+)

### Requirement 10

**User Story:** As a user, I want granular control over notification opt-in and opt-out, so that I can customize my experience without losing access to important features.

#### Acceptance Criteria

1. WHEN I first use community features THEN the system SHALL offer contextual opt-in for community notifications with clear benefits
2. WHEN I create my first grow plan THEN the system SHALL suggest enabling task reminders at relevant moment
3. WHEN I opt out of notification type THEN the system SHALL tie toggles to channels (Android) and categories (iOS)
4. WHEN I opt out THEN the system SHALL confirm action and show alternatives (in-app inbox, badges only)
5. WHEN I want to re-enable notifications THEN the system SHALL provide visible re-enable paths in Settings with deep links to OS settings
6. WHEN I opt out of all notifications THEN the system SHALL maintain in-app notification center and badge functionality
7. WHEN managing preferences THEN the system SHALL localize channel names/descriptions (Android) and category/action titles (iOS)

### Requirement 11

**User Story:** As a user, I want reliable and secure notification delivery, so that I can trust the system to work consistently across different scenarios.

#### Acceptance Criteria

1. WHEN measuring end-to-end latency THEN community notifications SHALL deliver within 5 seconds when online
2. WHEN validating deep-link parameters THEN the system SHALL allowlist routes and reject external redirects to prevent phishing
3. WHEN localizing notifications THEN the system SHALL localize channel names/descriptions (Android) and category/action titles (iOS)
4. WHEN testing the system THEN it SHALL handle cold start, background, killed app, DND/Focus, Doze, battery saver scenarios
5. WHEN testing permissions THEN the system SHALL handle revoked permissions, re-install, multi-account, and multi-device scenarios
6. WHEN processing notifications THEN the system SHALL validate all input parameters and sanitize content
7. WHEN handling errors THEN the system SHALL provide graceful degradation and appropriate fallback behaviors
