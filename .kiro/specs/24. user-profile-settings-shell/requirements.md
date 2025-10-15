# Requirements Document

## Introduction

The User Profile & Settings Shell feature consolidates all user-facing compliance, privacy, and preference management into a cohesive, accessible settings experience. This feature brings together age verification, legal confirmations, localization preferences, notification settings, privacy controls, data export/deletion, and support access into a unified interface that prioritizes user control, regulatory compliance, and ease of use. The system ensures GDPR compliance, cannabis policy adherence, and provides transparent data management while maintaining an intuitive user experience.

## Scope

**In-scope:** Onboarding age/legals, settings shell, localization, notifications, privacy/data, support, legal docs, profile, security, accessibility/compliance, offline behavior.

**Out-of-scope:** Moderation tooling beyond reporting, billing/subscriptions, enterprise SSO.

## Non-Functional Requirements

**Offline-first:** All settings usable offline unless network is strictly required; queue-and-sync with deterministic conflict resolution (last-write-wins per key; legals re-prompt on version bump).

**Privacy-by-design:** Store only isOfAge boolean + policyVersion + verifiedAt; birthdate stored only if user opts into profile; never store raw IP on device; server may log IP for audits only with consent and retention limits.

**Accessibility:** WCAG 2.1 AA; 44pt targets; Dynamic Type; screen reader announcements for names, values, and state changes; logical focus order with visible focus rings.

**Internationalization:** All strings translatable (EN/DE); runtime language switch; locale-aware dates/numbers (Luxon); no hardcoded strings.

**Security:** Sensitive actions require step-up auth; credentials/tokens stored in SecureStore; network HTTPS only; Supabase RLS; audit logs for consent/export/deletion.

**Defaults by region:** Non-essential processing defaults OFF in EU; marketing notifications opt-in everywhere.

**Versioning:** Terms/Privacy/Cannabis policy records keep semantic version + lastUpdated; trigger re-consent on major bumps.

**Performance:** Settings TTI ≤ 200ms on mid-tier devices; stats computed with cached queries and incremental updates.

**Data retention:** Consent/legal records retained up to 5y (configurable); exports ≤ 7d; deletion grace period 30d (configurable).

**Regional:** Age policy defaults to 18+ but configurable to 21+; if region unknown, apply stricter policy.

## Requirements

### Requirement 1

**User Story:** As a new GrowBro user, I want to complete age verification and legal confirmations during onboarding, so that I can access the app in compliance with cannabis regulations.

#### Acceptance Criteria

1. WHEN a user first launches the app THEN the system SHALL present an age gate requiring birth date entry (day, month, year) before any other content is accessible
2. WHEN the user submits their birth date THEN the system SHALL verify the user is 18+ years old and display appropriate error messages for underage or invalid entries
3. WHEN age verification succeeds THEN the system SHALL store the verification status locally with timestamp and policy version per compliance requirements
4. WHEN presenting the age gate THEN the system SHALL display clear disclaimers about cannabis cultivation legality, educational purpose, and re-verification requirements in the user's language
5. WHEN the user completes age verification THEN the system SHALL present legal confirmations including terms of service, privacy policy, and cannabis cultivation responsibility acknowledgment
6. WHEN legal confirmations are presented THEN the system SHALL require explicit acceptance with checkboxes and "I Agree" action before proceeding to the app
7. WHEN storing legal acceptance THEN the system SHALL record acceptance timestamp, policy versions, and IP address (if telemetry enabled) for audit purposes
8. WHEN the region is unknown or geofencing is unavailable THEN the system SHALL apply the strictest configured age threshold (e.g., 21+)
9. WHEN a major legal document version increases THEN the system SHALL require re-acceptance before granting app access
10. WHEN onboarding is interrupted THEN the system SHALL resume at the last incomplete step on next launch
11. WHEN recording legal acceptance THEN the system SHALL include appVersion and locale; any IP logging occurs server-side only with explicit consent

### Requirement 2

**User Story:** As a GrowBro user, I want to access a centralized settings screen, so that I can manage all my preferences and account options in one place.

#### Acceptance Criteria

1. WHEN the user navigates to Settings THEN the system SHALL display a scrollable list organized into logical sections: Profile, Preferences, Privacy & Data, Notifications, Legal & Compliance, Support, and Account
2. WHEN displaying settings sections THEN the system SHALL use clear section headers, icons for visual hierarchy, and descriptive subtitles for each setting option
3. WHEN the user taps any setting option THEN the system SHALL navigate to the appropriate detail screen or modal with smooth transitions
4. WHEN rendering the settings screen THEN the system SHALL use consistent UI patterns (list items, toggles, navigation chevrons) following the app's design system
5. WHEN the settings screen loads THEN the system SHALL display current values for all settings (language, notification status, privacy toggles) without requiring navigation
6. WHEN the user is offline THEN the system SHALL still allow access to settings that don't require network connectivity (language, local preferences)
7. WHEN a deep link targets a settings subsection (e.g., growbro://settings/notifications) THEN the system SHALL navigate directly to that subsection and preserve back navigation
8. WHEN a settings value fails to sync THEN the system SHALL show a non-blocking inline error with a retry action; the local value remains applied until resolved
9. WHEN a setting requires network connectivity THEN the system SHALL display an "Offline" badge and defer backend sync until online

### Requirement 3

**User Story:** As a multilingual user, I want to change the app language, so that I can use GrowBro in my preferred language (German or English).

#### Acceptance Criteria

1. WHEN the user accesses language settings THEN the system SHALL display available languages (English, German) with current selection indicated
2. WHEN the user selects a new language THEN the system SHALL immediately update all UI text, navigation labels, and content to the selected language
3. WHEN language changes THEN the system SHALL persist the selection locally and apply it on subsequent app launches
4. WHEN displaying language options THEN the system SHALL show language names in their native form (English, Deutsch) for clarity
5. WHEN the app first launches THEN the system SHALL default to the device's system language if supported, otherwise default to English
6. WHEN language changes THEN the system SHALL update date/time formatting, number formatting, and other locale-specific displays accordingly
7. WHEN changing language THEN the system SHALL update navigation titles, toasts, and date/number formatting on currently mounted screens without app restart
8. WHEN the device language is unsupported THEN the system SHALL fall back to stored preference or English in that order
9. WHEN locale changes THEN the system SHALL apply locale-specific week start and formatting rules via the date/time library

### Requirement 4

**User Story:** As a GrowBro user, I want to manage my notification preferences, so that I can control which alerts I receive and when.

#### Acceptance Criteria

1. WHEN the user accesses notification settings THEN the system SHALL display toggles for each notification category: Task Reminders, Harvest Alerts, Community Activity, System Updates, and Marketing (opt-in only)
2. WHEN the user toggles a notification category THEN the system SHALL immediately update the preference and apply it to future notifications
3. WHEN notification permissions are not granted THEN the system SHALL display a prompt to enable system notifications with a link to device settings
4. WHEN displaying notification settings THEN the system SHALL show the current system permission status (Enabled/Disabled) with clear instructions for enabling
5. WHEN the user enables task reminders THEN the system SHALL provide additional options for reminder timing (e.g., 1 hour before, day before, custom)
6. WHEN the user disables all notifications THEN the system SHALL confirm the action and explain that time-sensitive task reminders will not be delivered
7. WHEN notification preferences change THEN the system SHALL sync the preferences to the backend (if online) to maintain consistency across devices
8. WHEN "Marketing" notifications are displayed THEN the system SHALL default them to OFF and require explicit opt-in
9. WHEN quiet hours are configured THEN the system SHALL suppress non-critical local notifications during that window, honoring DST transitions
10. WHEN the OS-level notification channel is disabled on Android THEN the system SHALL display the category as disabled with a "Manage in system settings" action
11. WHEN notification preferences change THEN the system SHALL record lastUpdated and deviceId and resolve multi-device conflicts using last-write-wins

### Requirement 5

**User Story:** As a privacy-conscious user, I want to access comprehensive privacy controls, so that I can manage my data processing consents and understand how my data is used.

#### Acceptance Criteria

1. WHEN the user accesses privacy settings THEN the system SHALL display the existing PrivacySettings component with all consent toggles: Crash Reporting, Analytics, Personalized Data, and Session Replay
2. WHEN displaying privacy toggles THEN the system SHALL show current consent status, last updated timestamp, and clear descriptions of what each toggle controls
3. WHEN the user taps a privacy toggle label THEN the system SHALL display a detailed explanation modal covering purpose, data collected, retention period, and third parties involved
4. WHEN the user changes any privacy toggle THEN the system SHALL immediately update consent status, persist the change locally, and propagate to relevant SDKs
5. WHEN privacy settings load THEN the system SHALL display quick action buttons: "Reject All", "Accept All", "Export My Data", and "Delete Account"
6. WHEN the user taps "Export My Data" THEN the system SHALL initiate the data export flow from the existing privacy-export-service and present the file via system share sheet
7. WHEN the user taps "Delete Account" THEN the system SHALL navigate to a dedicated account deletion flow with confirmation steps
8. WHEN "Reject All" is selected THEN the system SHALL disable all non-essential processing immediately and attempt to flush/disable SDK buffers where supported
9. WHEN showing toggle details THEN the system SHALL include purpose, data categories, retention period, and third-party processors with links to the DPA/processor list
10. WHEN export completes THEN the system SHALL package JSON + media ZIP (if applicable), exclude secrets/tokens, and present via the system share sheet with expiry notice

### Requirement 6

**User Story:** As a GrowBro user, I want to request account deletion, so that I can permanently remove my data from the platform when I no longer wish to use the service.

#### Acceptance Criteria

1. WHEN the user initiates account deletion THEN the system SHALL present a dedicated screen explaining the consequences: permanent data loss, irreversible action, and 30-day grace period
2. WHEN explaining deletion THEN the system SHALL list what will be deleted: profile, plants, tasks, harvests, community posts, media files, and all associated data
3. WHEN the user confirms deletion intent THEN the system SHALL require re-authentication (password or biometric) to prevent accidental deletion
4. WHEN re-authentication succeeds THEN the system SHALL present a final confirmation with a text input requiring the user to type "DELETE" to proceed
5. WHEN deletion is confirmed THEN the system SHALL initiate the deletion process: mark account for deletion, schedule cascade deletion jobs, and log the request with timestamp
6. WHEN deletion is initiated THEN the system SHALL immediately log the user out, clear local data, and display a confirmation message with the 30-day grace period information
7. WHEN within the grace period THEN the system SHALL allow the user to cancel deletion by logging in again, which SHALL restore account access and cancel scheduled deletion jobs
8. WHEN the grace period expires THEN the system SHALL execute permanent deletion: cascade across WatermelonDB, Supabase tables, blob storage, and third-party processors with audit logging
9. WHEN account deletion is scheduled THEN the system SHALL display a "Restore account" banner upon login within the grace period to cancel deletion
10. WHEN the user is anonymous (no registered account) THEN the system SHALL delete local data only and present a confirmation
11. WHEN deletion is requested repeatedly THEN the system SHALL enforce rate limiting and display the earliest pending request timestamp
12. WHEN deletion starts THEN the system SHALL create an audit log entry including requestId, userId, requestedAt, and policyVersion

### Requirement 7

**User Story:** As a GrowBro user, I want to access support resources, so that I can get help with issues, provide feedback, or report problems.

#### Acceptance Criteria

1. WHEN the user accesses support settings THEN the system SHALL display options: Help Center, Contact Support, Report a Bug, Send Feedback, and Community Guidelines
2. WHEN the user taps "Help Center" THEN the system SHALL open an in-app browser or external browser to the GrowBro help documentation
3. WHEN the user taps "Contact Support" THEN the system SHALL open the device's email client with pre-filled support email address and device/app information in the body
4. WHEN the user taps "Report a Bug" THEN the system SHALL present a form to describe the issue with optional screenshot attachment and automatic inclusion of device diagnostics (if consent given)
5. WHEN the user taps "Send Feedback" THEN the system SHALL present a form for general feedback with category selection (Feature Request, Improvement, Compliment, Other)
6. WHEN the user taps "Community Guidelines" THEN the system SHALL display the community guidelines in a modal or navigate to a dedicated screen
7. WHEN submitting support requests THEN the system SHALL include app version, device model, OS version, and a non-reversible hashedId (if authenticated) for troubleshooting purposes; raw user identifiers SHALL only be included with explicit user consent via settings toggle
8. WHEN submitting "Report a Bug" THEN the system SHALL attach environment metadata (appVersion, buildNumber, device model, OS, locale, free storage, last sync time) and an optional Sentry eventId if crash reporting consent is enabled; full diagnostics and raw identifiers SHALL require explicit consent via in-flow checkbox and settings toggle
9. WHEN attaching screenshots or logs THEN the system SHALL redact secrets and sensitive data, allow users to deselect diagnostics, and SHALL gate metadata/email attachments on user consent preferences stored in settings
10. WHEN the user accesses support settings THEN the system SHALL display a "Include Diagnostics in Reports" toggle that controls whether raw identifiers and full diagnostics are attached to support requests
11. WHEN submitting bug reports or support requests THEN the system SHALL display an in-flow consent checkbox for attaching full diagnostics and raw identifiers, defaulting to the user's settings preference
12. WHEN consent for diagnostics is granted THEN the system SHALL store the consent preference in user settings and apply it to future support submissions
13. WHEN processing support attachments THEN the system SHALL hash all user identifiers using a non-reversible algorithm and redact any secrets, API keys, or sensitive data before transmission

### Requirement 8

**User Story:** As a GrowBro user, I want to view legal documents and app information, so that I can understand my rights, responsibilities, and the app's policies.

#### Acceptance Criteria

1. WHEN the user accesses legal settings THEN the system SHALL display options: Terms of Service, Privacy Policy, Cannabis Policy, Licenses, and About
2. WHEN the user taps any legal document THEN the system SHALL display the document in the user's selected language with proper formatting and scrollable content
3. WHEN displaying legal documents THEN the system SHALL show the document version number and last updated date at the top
4. WHEN the user taps "About" THEN the system SHALL display app version, build number, copyright information, and links to the GrowBro website and social media
5. WHEN displaying the About screen THEN the system SHALL include a "Check for Updates" button that verifies the latest app version via EAS Updates
6. WHEN the user taps "Licenses" THEN the system SHALL display open source licenses for all third-party libraries used in the app
7. WHEN legal documents are updated THEN the system SHALL notify users on next app launch and require re-acceptance if material changes affect user rights or data processing
8. WHEN licenses are displayed THEN the system SHALL show package name, version, license type, and full license text with search and filter
9. WHEN "Check for Updates" is tapped AND OTA updates are enabled THEN the system SHALL query the update channel and surface availability; otherwise, link to the app store listing
10. WHEN legal documents are viewed offline THEN the system SHALL display the cached version with "Last synced" timestamp and a "May be outdated" badge

### Requirement 9

**User Story:** As a GrowBro user, I want to manage my profile information, so that I can personalize my account and control what information is visible to the community.

#### Acceptance Criteria

1. WHEN the user accesses profile settings THEN the system SHALL display editable fields: Display Name, Bio, Profile Picture, and Location (optional, city/region only)
2. WHEN the user updates their display name THEN the system SHALL validate the name (3-30 characters, no special characters except spaces, hyphens, underscores) and save changes
3. WHEN the user updates their bio THEN the system SHALL enforce a 500-character limit and save changes immediately
4. WHEN the user taps the profile picture THEN the system SHALL present options: Take Photo, Choose from Library, or Remove Picture
5. WHEN the user selects a new profile picture THEN the system SHALL resize the image to 512x512px, compress to <200KB, and upload to Supabase Storage
6. WHEN profile changes are saved THEN the system SHALL sync to the backend (if online) and update the local WatermelonDB cache
7. WHEN the user is offline THEN the system SHALL queue profile changes for sync when connectivity is restored
8. WHEN displaying profile settings THEN the system SHALL show privacy options: "Show profile to community" toggle and "Allow direct messages" toggle
9. WHEN uploading a profile picture THEN the system SHALL remove EXIF metadata, crop to 1:1, resize to 512×512, compress to <200KB, and show upload progress; the image is marked pending until upload succeeds
10. WHEN saving Display Name or Bio THEN the system SHALL apply profanity filtering and provide inline feedback without revealing blocked terms
11. WHEN "Show profile to community" or "Allow direct messages" toggles are disabled for minors or restricted regions THEN the system SHALL display a non-intrusive compliance notice

### Requirement 10

**User Story:** As a GrowBro user, I want to see my account statistics and usage information, so that I can understand my activity and engagement with the app.

#### Acceptance Criteria

1. WHEN the user accesses profile settings THEN the system SHALL display account statistics: Member Since date, Total Plants, Active Grows, Completed Harvests, Community Posts, and Total Likes Received
2. WHEN displaying statistics THEN the system SHALL query WatermelonDB for accurate counts and cache results for performance
3. WHEN the user taps any statistic THEN the system SHALL navigate to the relevant section (e.g., tapping "Total Plants" navigates to the plants list)
4. WHEN statistics are displayed THEN the system SHALL update in real-time as the user creates new content or completes actions
5. WHEN the user has no activity THEN the system SHALL display encouraging messages like "Start your first grow!" with action buttons
6. WHEN displaying usage information THEN the system SHALL show storage usage: Local Database Size, Media Files Size, and Available Device Storage
7. WHEN statistics change THEN the system SHALL update visible counts within 1 second using diff-based updates to avoid jank
8. WHEN offline THEN the system SHALL show locally available counts with a subtle "Syncing…" indicator until cloud reconciliation completes

### Requirement 11

**User Story:** As a GrowBro user, I want to manage my authentication and security settings, so that I can protect my account and control access.

#### Acceptance Criteria

1. WHEN the user accesses security settings THEN the system SHALL display options: Change Password, Enable Biometric Login, Two-Factor Authentication (if available), and Active Sessions
2. WHEN the user taps "Change Password" THEN the system SHALL present a form requiring current password, new password, and confirmation with validation rules displayed
3. WHEN the user enables biometric login THEN the system SHALL verify device biometric capability, request system permission, and store a secure token in the device keychain
4. WHEN biometric login is enabled THEN the system SHALL allow the user to authenticate using Face ID, Touch ID, or fingerprint on subsequent logins
5. WHEN the user accesses "Active Sessions" THEN the system SHALL display a list of devices/browsers where the account is logged in with last active timestamp and device info
6. WHEN the user taps "Log Out Other Sessions" THEN the system SHALL invalidate all other session tokens and require re-authentication on those devices
7. WHEN security settings change THEN the system SHALL send a notification email to the user's registered email address for security awareness
8. WHEN "Enable Biometric Login" is configured THEN the system SHALL store only a secure token in the device keychain and fall back to PIN/password if biometrics fail
9. WHEN "Active Sessions" is viewed THEN the system SHALL list device name, platform, last active, and approximate location from server data where available
10. WHEN "Log Out Other Sessions" is confirmed THEN the system SHALL revoke all other refresh tokens server-side and reflect updated sessions within 10 seconds; a security email SHALL be sent

### Requirement 12

**User Story:** As a developer or compliance officer, I want to ensure the settings shell follows accessibility and compliance standards, so that all users can access settings and the app meets regulatory requirements.

#### Acceptance Criteria

1. WHEN rendering any settings screen THEN the system SHALL provide proper accessibility labels, hints, and roles for all interactive elements
2. WHEN using screen readers THEN the system SHALL announce setting names, current values, and state changes (e.g., "Analytics toggle, currently enabled")
3. WHEN displaying toggles THEN the system SHALL ensure minimum 44pt touch targets and sufficient color contrast (WCAG AA minimum)
4. WHEN keyboard navigation is used THEN the system SHALL support tab navigation through all settings with visible focus indicators
5. WHEN settings require user input THEN the system SHALL provide clear error messages and validation feedback with proper ARIA attributes
6. WHEN implementing data processing THEN the system SHALL log all consent changes, data exports, and deletion requests with timestamps for GDPR audit trails
7. WHEN handling sensitive operations THEN the system SHALL require re-authentication for account deletion, password changes, and privacy data exports
8. WHEN any toggle changes THEN the system SHALL announce the new state to screen readers (e.g., "Analytics, off")
9. WHEN running a11y checks THEN the system SHALL pass automated audits and a manual screen reader pass in English and German for all new screens
10. WHEN consent/export/deletion events occur THEN the system SHALL create structured audit logs containing userId, eventType, payload summary, policyVersion, timestamp, and appVersion

## Open Questions

1. **Regional Age Requirements:** Which regions require 21+ age verification and is geofencing acceptable? What is the fallback if geolocation permission is denied?

2. **Marketing Notifications:** Will "Marketing" notifications be sent at all? If yes, confirm double opt-in and region-specific defaults.

3. **Session Replay:** Will session replay be enabled? If yes, confirm redaction strategy for input fields and sensitive screens.

4. **Data Export Scope:** Should exports include original media vs compressed? Should soft-deleted history be included?

5. **Profile Moderation:** Should profanity filtering use client-side filter vs server-side vs combined approach?

6. **License Generation:** What is the preferred build-time tool and format for in-app license rendering?

7. **Two-Factor Authentication:** Is 2FA implementation in scope for initial release or future enhancement?

8. **Direct Messaging:** Is the "Allow direct messages" feature planned for implementation, or is it a placeholder for future functionality?

9. **Quiet Hours Configuration:** Should quiet hours be configurable per notification category or globally?

10. **Account Recovery:** What is the account recovery flow if a user forgets their password during the deletion grace period?
