# Implementation Plan

## Overview

This implementation plan breaks down the User Profile & Settings Shell feature into discrete, manageable coding tasks. Each task builds incrementally on previous work, prioritizes core functionality, and follows test-driven development where appropriate. Tasks are organized by feature area and sequenced to enable early validation of critical paths.

## Task List

- [x] 1. Set up data models and database schema
- [x] 1.1 Create Supabase migration for profiles, notification_preferences, legal_acceptances, account_deletion_requests, bug_reports, feedback, and audit_logs tables
  - Write SQL migration file with proper constraints, indexes, and RLS policies
  - Test migration on local Supabase instance
  - _Requirements: 1.7, 2.1, 3.1, 4.1, 5.1, 6.1, 7.1, 8.1, 9.1, 10.1, 11.1, 12.6_

- [x] 1.2 Add WatermelonDB schema for profiles and notification_preferences models
  - Extend `src/lib/watermelon-schema.ts` with new table definitions
  - Create WatermelonDB model classes in `src/lib/watermelon-models/`
  - Add migration for existing databases
  - _Requirements: 9.6, 4.7_

- [x] 1.3 Create TypeScript interfaces for all settings-related data structures
  - Define interfaces in `src/types/settings.ts`
  - Include UserProfile, NotificationPreferences, SecuritySettings, LegalDocument, BugReport, Feedback, AuditLogEntry
  - _Requirements: 2.1, 3.1, 4.1, 5.1, 6.1, 7.1, 8.1, 9.1, 10.1, 11.1_

- [x] 1.4 Add RLS policies, indexes, and storage rules
  - Enable RLS on all new tables (profiles, notification_preferences, legal_acceptances, account_deletion_requests, bug_reports, feedback, audit_logs)
  - Write row filters: `user_id = auth.uid()` where applicable; allow INSERT/SELECT/UPDATE only for owner; audit_logs INSERT allowed for service role only
  - Create indexes: notification_preferences (user_id, device_id) UNIQUE + idx on last_updated; legal_acceptances (user_id, document_type, version) UNIQUE; bug_reports idx on created_at + status; audit_logs idx on user_id + created_at + event_type
  - Supabase Storage: create bucket `avatars` with RLS policy restricting path `avatars/{auth.uid()}/*` to owner; signed URL expiry ≤ 15m
  - _Requirements: 12.6, 5.4, 9.5, 11.6_

- [x] 1.5 Implement server-side rate limiting
  - Deletion requests: limit 1 pending per user; reject new until status != 'pending' OR scheduled_for < now
  - Bug reports/feedback: throttle by (user_id, 5/min) and (ip, 20/min) via Edge Function guard
  - _Requirements: 6.11, 7.8_

- [x] 1.6 Add schema hardening with constraints
  - CHECK constraints: notification_preferences.custom_reminder_minutes BETWEEN 1 AND 1440 when timing = 'custom'
  - Enforce lowercase locale via trigger
  - Validate version as semver pattern
  - _Requirements: 4.5, 8.3_

- [x] 2. Implement onboarding flow enhancements
- [x] 2.1 Create LegalConfirmationModal component
  - Build modal UI with scrollable legal documents and checkboxes
  - Implement checkbox state management
  - Add "I Agree" button with disabled state until all checked
  - _Requirements: 1.5, 1.6, 1.9_

- [x] 2.2 Create Zustand store for legal acceptances
  - Implement store in `src/lib/compliance/legal-acceptances.ts`
  - Add persistence to MMKV storage
  - Include version tracking and re-acceptance logic
  - _Requirements: 1.7, 1.9, 1.11, 8.7_

- [x] 2.3 Implement onboarding resume logic
  - Track current onboarding step in storage
  - Resume from last incomplete step on app launch
  - Handle interruptions gracefully
  - _Requirements: 1.10_

- [x] 2.4 Add age policy fallback for unknown regions
  - Implement region detection logic
  - Apply strictest threshold (21+) when region unknown
  - _Requirements: 1.8_

- [x] 2.5 Implement onboarding re-acceptance on major legal version bump
  - At app start: compare accepted versions vs current
  - Present blocking modal for major bump; banner for minor/patch
  - Persist accepted versions in Zustand + backend
  - _Requirements: 1.9, 8.7_

- [x] 2.6 Add onboarding resume state persistence
  - Persist current step in MMKV
  - Resume exactly where left off if app quits/crashes
  - _Requirements: 1.10_

- [x] 3. Enhance main settings hub
- [x] 3.1 Create ProfileHeader component
  - Display avatar, display name, and statistics
  - Implement tap navigation to profile edit
  - Add loading and error states
  - _Requirements: 9.1, 10.1, 10.2_

- [x] 3.2 Add section status previews to settings hub
  - Show notification summary (ON/OFF, quiet hours)
  - Show privacy summary (All off/Partial/All on)
  - Show current language in native form
  - Show security status (biometrics, last password change)
  - _Requirements: 2.5, 3.1, 4.1, 5.2, 11.1_

- [x] 3.3 Implement inline error surfaces for sync failures
  - Display non-blocking error rows
  - Add "Retry" action button
  - Show last sync attempt timestamp
  - _Requirements: 2.8_

- [x] 3.4 Add offline badges for network-dependent features
  - Detect online/offline status
  - Display "Offline" badge on relevant items
  - Disable server-side actions when offline
  - _Requirements: 2.6, 2.9_

- [x] 3.5 Implement deep linking support
  - Add route handlers for all settings deep links
  - Preserve back navigation to main hub
  - Test all deep link routes
  - _Requirements: 2.7_

- [x]\* 3.6 Write integration tests for deep links
  - Test each settings deep link routing
  - Ensure back navigation returns to hub
  - _Requirements: 2.7_

- [x] 3.7 Implement section status summaries
  - Notifications: Show ON/OFF + quiet hours window
  - Privacy: Show "All off" | "Partial" | "All on"
  - Security: Show "Biometrics on/off" + last password change
  - _Requirements: 2.5_

- [x] 4. Build profile management screen
- [x] 4.1 Create ProfileScreen component with form
  - Build form with display name, bio, location fields
  - Implement React Hook Form with Zod validation
  - Add character counters for bio (500 chars)
  - _Requirements: 9.1, 9.2, 9.3_

- [x] 4.2 Implement avatar upload with EXIF removal
  - Add image picker (camera/library options)
  - Strip EXIF metadata using `expo-image-manipulator`
  - Crop to 1:1, resize to 512x512, compress <200KB
  - Show upload progress bar
  - _Requirements: 9.4, 9.5, 9.9_

- [x] 4.3 Add avatar status tracking
  - Implement state machine: idle → uploading → pending → failed
  - Update WatermelonDB with avatar status
  - Handle upload failures with retry
  - _Requirements: 9.5, 9.9_

- [x] 4.4 Implement profile visibility toggles
  - Add "Show profile to community" toggle
  - Add "Allow direct messages" toggle (disabled placeholder)
  - Show compliance notice for restricted regions
  - _Requirements: 9.8, 9.11_

- [x] 4.5 Add client-side profanity filtering
  - Integrate profanity filter library
  - Apply to display name and bio fields
  - Show inline feedback without revealing blocked terms
  - _Requirements: 9.10_

- [x] 4.6 Implement profile sync with queue-and-retry
  - Queue changes when offline
  - Sync to Supabase when online
  - Update local WatermelonDB cache
  - _Requirements: 9.6, 9.7_

- [x] 4.7 Add account statistics display
  - Query WatermelonDB for stats (plants, harvests, posts)
  - Implement diff-based updates with 500ms throttle
  - Add tap navigation to relevant sections
  - Show "Syncing..." indicator when offline
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.7, 10.8_

- [x] 4.8 Implement avatar storage security
  - Use temporary file during upload
  - Only update avatarUrl after upload success
  - Strip EXIF, center-crop 1:1, 512×512, <200KB
  - Signed URL preview with short TTL
  - Retry with exponential backoff
  - _Requirements: 9.5, 9.9_

- [x] 4.9 Add profanity filtering (client + server)
  - Client-side filter for immediate UX feedback
  - Server-side validation in Edge Function to enforce
  - _Requirements: 9.10_

- [x] 5. Enhance notification settings screen
- [x] 5.1 Add notification category toggles
  - Implement toggles for Task Reminders, Harvest Alerts, Community Activity, System Updates, Marketing
  - Default marketing to OFF (opt-in only)
  - Persist preferences to WatermelonDB and Supabase
  - _Requirements: 4.1, 4.2, 4.8_

- [x] 5.2 Implement task reminder timing options
  - Add timing selector (hour before, day before, custom)
  - Show custom minutes input when selected
  - Validate custom timing input
  - _Requirements: 4.5_

- [x] 5.3 Add quiet hours configuration
  - Implement quiet hours toggle
  - Add time pickers for start and end times
  - Handle DST transitions correctly
  - Suppress non-critical notifications during quiet hours
  - _Requirements: 4.9_

- [x] 5.4 Implement platform-specific notification handling
  - Android: Check per-channel enablement, show "Manage in system settings" CTA
  - iOS: Check global permission status, show "Enable in Settings" link
  - Display current permission status
  - _Requirements: 4.3, 4.4, 4.10_

- [x] 5.5 Add multi-device sync with conflict resolution
  - Include deviceId and lastUpdated in preferences
  - Implement last-write-wins per key
  - Merge preferences on sync
  - _Requirements: 4.7, 4.11_

- [x] 5.6 Implement Android notification channels
  - Create channels per category at app start
  - Reflect OS-disabled state in UI
  - Add "Manage in system settings" CTA
  - _Requirements: 4.3, 4.4, 4.10_

- [x] 5.7 Add quiet hours across midnight and DST
  - Implement window logic tolerant to cross-midnight
  - Add tests around DST transitions
  - Suppress non-critical local notifications
  - _Requirements: 4.9_

- [x] 6. Build security settings screen
- [x] 6.1 Create SecurityScreen component
  - Build UI with sections for password, biometric, sessions
  - Add navigation to detail screens
  - _Requirements: 11.1_

- [x] 6.2 Implement password change flow
  - Create form with current password, new password, confirmation
  - Add password strength validation (8+ chars, uppercase, lowercase, number, special)
  - Integrate with Supabase Auth API
  - Show validation rules and strength indicator
  - _Requirements: 11.2_

- [x] 6.3 Add biometric login setup
  - Check device capability via `expo-local-authentication`
  - Request permission if not granted
  - Verify with test authentication
  - Store secure token in `expo-secure-store`
  - Show detected biometric type (face/fingerprint/iris)
  - Implement fallback to PIN/password
  - _Requirements: 11.3, 11.4, 11.8_

- [x] 6.4 Implement active sessions management
  - Query Supabase auth.sessions table
  - Display list with device name, platform, last active, location
  - Add "Log Out Other Sessions" button
  - Revoke refresh tokens via Supabase Auth API
  - Send security notification email
  - Update session list within 10 seconds
  - _Requirements: 11.5, 11.6, 11.9, 11.10_

- [x] 6.5 Add security notification emails
  - Send email on password change
  - Send email on session revocation
  - Debounce emails (10-minute window)
  - _Requirements: 11.7, 11.10_

- [x] 6.6 Implement step-up auth for data export
  - Require re-auth (password/biometric) before export
  - Expire step-up after 5 minutes
  - _Requirements: 12.7, 5.5_

- [x] 7. Create support screen
- [x] 7.1 Build SupportScreen component
  - Add links for Help Center, Contact Support, Report Bug, Send Feedback, Community Guidelines
  - Implement navigation and external link handling
  - _Requirements: 7.1, 7.2, 7.6_

- [x] 7.2 Implement Help Center link
  - Open in-app browser to help documentation
  - Fallback to external browser if in-app fails
  - _Requirements: 7.2_

- [x] 7.3 Add Contact Support email integration
  - Open device email client
  - Pre-fill support email address
  - Include environment metadata in body (app version, device model, OS, user ID)
  - Respect privacy consents
  - _Requirements: 7.3, 7.7_

- [x] 7.4 Create bug report form
  - Build form with title, description, category selector
  - Add optional screenshot attachment
  - Collect diagnostics automatically (app version, build, device, OS, locale, storage, sync time, network status)
  - Include Sentry event ID if crash reporting enabled
  - Redact secrets from diagnostics
  - Allow user to deselect diagnostics
  - _Requirements: 7.4, 7.8, 7.9_

- [x] 7.5 Implement bug report submission with offline queue
  - Submit to Supabase Edge Function `/bug-reports`
  - Show success confirmation with ticket ID
  - Queue for retry when offline
  - Implement exponential backoff retry logic
  - _Requirements: 7.4, 7.8_

- [x] 7.6 Create feedback form
  - Build form with category selector and message field
  - Add optional email field for follow-up
  - Enforce 1000 character limit
  - Submit to Supabase Edge Function `/feedback`
  - Queue for retry when offline
  - _Requirements: 7.5_

- [x] 7.7 Add diagnostics redaction toggle
  - In Report Bug form: "Include Diagnostics" toggle ON by default (if consent)
  - Redact secrets consistently
  - Allow deselect per field
  - _Requirements: 7.4, 7.8_

- [ ] 8. Build legal documents screen
- [x] 8.1 Create LegalScreen component
  - Add navigation to Terms, Privacy Policy, Cannabis Policy, Licenses
  - Display document version and last updated date
  - _Requirements: 8.1, 8.3_

- [x] 8.2 Implement legal document rendering
  - Use `react-native-markdown-display` for formatted content
  - Support headings, lists, links, bold, italic
  - Make scrollable with proper spacing
  - Show "Last synced" timestamp for offline viewing
  - Display "May be outdated" badge when offline
  - _Requirements: 8.2, 8.10_

- [x] 8.3 Add legal document version tracking
  - Store documents with semantic versioning
  - Track user's last accepted versions
  - Compare on app launch
  - _Requirements: 8.3, 8.7_

- [x] 8.4 Implement re-acceptance flow
  - Block app access on major version bump
  - Show modal with updated document
  - Require explicit re-acceptance
  - Record new acceptance with appVersion and locale
  - Show notification banner for minor/patch bumps
  - _Requirements: 8.7, 8.11_

- [x] 8.5 Create licenses screen
  - Generate license list at build time using script
  - Display package name, version, license type
  - Show full license text on tap
  - Implement search and filter by license type
  - _Requirements: 8.6, 8.8_

- [x] 8.6 Build license generation script
  - Use `npm list` or `pnpm list` to extract dependencies
  - Generate JSON with name, version, license type, full text
  - Integrate into EAS build process
  - _Requirements: 8.6, 8.8_

- [x] 8.7 Implement legal offline cache
  - Cache docs by version and locale
  - Show "Last synced" timestamp
  - Display "May be outdated" when offline
  - _Requirements: 8.2, 8.10_

- [x] 8.8 Create license JSON generator
  - Build-time script outputs name, version, license type, full text
  - Bundle as JSON
  - Searchable UI with filter by license type
  - _Requirements: 8.6, 8.8_

- [x] 9. Create about screen
- [x] 9.1 Build AboutScreen component
  - Display app name, version, build number, environment
  - Show copyright and website links
  - Add social media links (Twitter, Instagram, GitHub)
  - _Requirements: 8.4_

- [x] 9.2 Implement OTA update checking
  - Use `expo-updates` API to check for updates
  - Compare with current version
  - Show "Update Available" badge if newer version exists
  - Display release notes
  - _Requirements: 8.5, 8.9_

- [x] 9.3 Add update download and apply flow
  - Implement "Download Update" button with progress indicator
  - Show "Restart to Apply" after download completes
  - Handle download failures with retry
  - Link to App Store/Play Store if OTA disabled
  - _Requirements: 8.5, 8.9_

- [x] 9.4 Implement OTA updates fallback
  - If expo-updates disabled, "Check for Updates" opens store listing
  - Otherwise show release notes and download/restart path
  - _Requirements: 8.5, 8.9_

- [ ] 10. Implement account deletion flow
- [ ] 10.1 Create AccountDeletionScreen with explanation
  - Display consequences (permanent data loss, irreversible, 30-day grace period)
  - List what will be deleted (profile, plants, tasks, harvests, posts, media)
  - Add "Continue" and "Cancel" buttons
  - _Requirements: 6.1, 6.2_

- [ ] 10.2 Add re-authentication step
  - Require password or biometric verification
  - Use Supabase Auth API for verification
  - Show error if authentication fails
  - Allow retry
  - _Requirements: 6.3, 12.7_

- [ ] 10.3 Implement final confirmation step
  - Add text input requiring user to type "DELETE"
  - Case-insensitive comparison
  - Disable "Confirm Deletion" button until correct text entered
  - Show countdown: "This action will be final in 30 days"
  - _Requirements: 6.4_

- [ ] 10.4 Create deletion request and initiate process
  - Generate unique requestId
  - Create deletion request record in Supabase
  - Mark account for deletion
  - Schedule cascade deletion jobs
  - Log audit entry with requestId, userId, timestamp, policyVersion
  - _Requirements: 6.5, 6.12_

- [ ] 10.5 Implement immediate logout and data clearing
  - Log user out immediately
  - Clear local WatermelonDB data
  - Clear secure storage
  - Clear MMKV storage
  - Show confirmation message with grace period info
  - _Requirements: 6.6_

- [ ] 10.6 Add grace period restore flow
  - Check for pending deletion on login
  - Show "Restore Account" banner
  - Implement "Cancel Deletion" button
  - Update request status to 'cancelled'
  - Restore account access
  - Cancel scheduled deletion jobs
  - Log audit entry
  - _Requirements: 6.7, 6.9_

- [ ] 10.7 Implement permanent deletion after grace period
  - Execute cascade deletion across Supabase tables
  - Delete blob storage (avatars, media files)
  - Delete from third-party processors (Sentry, analytics)
  - Create audit log entry
  - Send confirmation email
  - _Requirements: 6.8_

- [ ] 10.8 Add anonymous user deletion handling
  - Detect anonymous users (no registered account)
  - Delete local data only
  - Present local confirmation
  - _Requirements: 6.10_

- [ ] 10.9 Implement rate limiting for deletion requests
  - Prevent repeated deletion requests
  - Show earliest pending request timestamp
  - _Requirements: 6.11_

- [ ] 10.10 Add restore banner during grace period
  - On login with pending deletion: show banner with "Restore Account" CTA
  - Cancel jobs and log audit on restore
  - _Requirements: 6.7_

- [ ] 11. Implement sync and error handling
- [ ] 11.1 Create sync service for settings data
  - Implement queue-and-sync mechanism
  - Handle offline/online transitions
  - Sync profiles, notification preferences, legal acceptances
  - _Requirements: 2.6, 2.8, 9.6, 9.7_

- [ ] 11.2 Add exponential backoff retry logic
  - Implement retry with backoff: 1s, 2s, 4s, 8s, 16s, 30s (cap)
  - Max 5 attempts per change
  - Show persistent error banner after exhaustion
  - Add manual "Retry Now" button
  - _Requirements: 2.8_

- [ ] 11.3 Implement form state preservation across re-auth
  - Save unsaved form changes to local storage
  - Restore changes after re-authentication
  - Clear preserved state after successful save
  - _Requirements: 12.5_

- [ ] 11.4 Add audit logging service
  - Create audit log entries for consent changes, data exports, deletions
  - Include userId, eventType, payload summary, policyVersion, appVersion, timestamp
  - Store in Supabase audit_logs table
  - _Requirements: 12.6, 12.10_

- [ ] 11.5 Implement privacy consent runtime mapping
  - Sentry: initialize only if consent; on toggle OFF set beforeSend to drop events, set tracesSampleRate = 0, call Sentry.flush() then Sentry.close()
  - Analytics: guard all track calls; no-op when consent OFF; flush/disable buffers if SDK supports
  - _Requirements: 5.4_

- [ ] 11.6 Create unified queue-and-sync service
  - Single queue for profile, notifications, legal acceptances
  - Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s; max 5 attempts
  - Persistent banner on exhaustion with "Retry Now"
  - _Requirements: 2.8, 9.6, 9.7_

- [ ] 11.7 Add export share sheet integration
  - Present platform share sheet with export file(s)
  - Handle large payloads with streaming/chunking if needed
  - _Requirements: 5.6_

- [ ] 12. Add localization and accessibility
- [ ] 12.1 Add translation keys for all settings screens
  - Add keys to `src/translations/en.json` and `src/translations/de.json`
  - Follow naming convention: `settings.{section}.{item}`
  - Include dynamic content with interpolation
  - _Requirements: 3.1, 3.2, 3.3, 3.7_

- [ ] 12.2 Implement runtime language switching
  - Update mounted screens without app restart
  - Update navigation titles and toasts
  - Apply locale-specific date/number formatting
  - Update week start and formatting rules
  - _Requirements: 3.2, 3.7, 3.9_

- [ ] 12.3 Add accessibility labels and hints
  - Provide proper labels for all interactive elements
  - Add hints for complex actions
  - Set correct accessibility roles
  - _Requirements: 12.1, 12.2_

- [ ] 12.4 Implement screen reader state announcements
  - Announce toggle state changes (e.g., "Analytics, off")
  - Announce form validation errors
  - Announce loading and success states
  - _Requirements: 12.2, 12.8_

- [ ] 12.5 Ensure minimum touch targets and color contrast
  - Verify 44pt minimum touch targets
  - Check WCAG AA color contrast (4.5:1 for text)
  - Add visible focus indicators
  - _Requirements: 12.3, 12.4_

- [ ] 12.6 Test with screen readers
  - Manual VoiceOver (iOS) navigation test
  - Manual TalkBack (Android) navigation test
  - Verify logical focus order
  - Test in English and German
  - _Requirements: 12.2, 12.9_

- [ ] 12.7 Implement A11y announcements and targets
  - Screen reader announcements for toggle state changes and validation errors
  - Verify 44pt targets and visible focus rings
  - _Requirements: 12.1, 12.2, 12.3, 12.4_

- [ ] 13. Create Supabase Edge Functions
- [ ] 13.1 Create bug report submission Edge Function
  - Implement `/bug-reports` endpoint
  - Validate request payload
  - Generate unique ticket ID
  - Store in bug_reports table
  - Return ticket ID in response
  - _Requirements: 7.4, 7.8_

- [ ] 13.2 Create feedback submission Edge Function
  - Implement `/feedback` endpoint
  - Validate request payload
  - Store in feedback table
  - Return success confirmation
  - _Requirements: 7.5_

- [ ] 13.3 Create account deletion cascade Edge Function
  - Implement deletion job scheduler
  - Cascade across all related tables
  - Delete blob storage files
  - Notify third-party processors
  - Create audit log entries
  - Send confirmation email
  - _Requirements: 6.8_

- [ ] 13.4 Add server-side profanity filtering
  - Implement profanity check endpoint
  - Validate display names and bios
  - Return validation result
  - _Requirements: 9.10_

- [ ] 13.5 Create security email service
  - Edge Function or server-side integration to send emails on password change and session revoke
  - Debounce emails within 10 minutes to avoid spam
  - _Requirements: 11.7, 11.10_

- [ ] 14. Implement migration and backfill
- [ ] 14.1 Create migration for existing users
  - Detect missing profile records on first settings access
  - Create default profile from auth user data
  - Migrate existing preferences to new schema
  - Preserve legal acceptance records
  - _Requirements: 9.1_

- [ ] 14.2 Add WatermelonDB schema migration
  - Add migration for avatarStatus column in profiles
  - Add migration for quietHours fields in notification_preferences
  - Test migration on existing databases
  - _Requirements: 1.2_

- [ ] 14.3 Implement backfill for conservative defaults
  - Set marketing notifications to OFF
  - Set non-essential privacy processing to OFF in EU
  - Create notification preference records with defaults
  - _Requirements: 4.8, 5.1_

- [ ] 14.4 Add EU defaults backfill
  - On first run post-migration: if locale in EU, set non-essential privacy toggles to OFF
  - Marketing OFF always
  - _Requirements: 5.1, 4.8_

- [ ] 15. Testing and quality assurance
- [ ]\* 15.1 Write unit tests for ProfileHeader component
  - Test rendering with stats
  - Test navigation on press
  - Test loading and error states
  - _Requirements: 9.1, 10.1_

- [ ]\* 15.2 Write unit tests for LegalConfirmationModal
  - Test checkbox logic
  - Test acceptance flow
  - Test button disabled state
  - _Requirements: 1.5, 1.6_

- [ ]\* 15.3 Write unit tests for BiometricSetupModal
  - Test permission flow
  - Test error handling
  - Test fallback to password
  - _Requirements: 11.3, 11.8_

- [ ]\* 15.4 Write unit tests for FeedbackForm
  - Test validation
  - Test submission
  - Test offline queueing
  - _Requirements: 7.5_

- [ ]\* 15.5 Write unit tests for AccountDeletionFlow
  - Test multi-step flow
  - Test confirmation logic
  - Test re-authentication
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ]\* 15.6 Write integration tests for onboarding flow
  - Test age gate → legal confirmation → consent modal
  - Test resume logic after interruption
  - _Requirements: 1.1, 1.5, 1.10_

- [ ]\* 15.7 Write integration tests for profile update flow
  - Test edit display name → upload avatar → save → sync
  - Test offline queueing and retry
  - _Requirements: 9.1, 9.2, 9.5, 9.6_

- [ ]\* 15.8 Write integration tests for account deletion flow
  - Test initiate → re-auth → confirm → grace period → restore
  - Test permanent deletion after grace period
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

- [ ]\* 15.9 Write integration tests for notification preferences
  - Test toggle categories → sync → multi-device conflict resolution
  - Test quiet hours suppression across DST change
  - _Requirements: 4.1, 4.2, 4.7, 4.9, 4.11_

- [ ]\* 15.10 Write integration tests for legal re-acceptance
  - Test major version bump (block access)
  - Test minor version bump (banner prompt)
  - _Requirements: 8.3, 8.7_

- [ ]\* 15.11 Create Maestro E2E tests
  - Test complete onboarding flow
  - Test profile update with avatar upload
  - Test bug report submission
  - Test account deletion and restore
  - _Requirements: All_

- [ ]\* 15.12 Run accessibility audits
  - Automated axe checks for all screens
  - Manual VoiceOver/TalkBack testing
  - Verify 44pt touch targets
  - Check color contrast
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.9_

- [ ]\* 15.13 Performance testing
  - Measure settings screen TTI (<200ms target)
  - Measure profile stats query (<100ms target)
  - Test image upload progress updates
  - Verify stats update throttling (1 second target)
  - _Requirements: 10.7_

- [ ] 16. Documentation and polish
- [ ] 16.1 Update README with settings feature documentation
  - Document new settings screens
  - Explain deep linking support
  - Document data models and sync behavior
  - _Requirements: All_

- [ ] 16.2 Add inline code comments for complex logic
  - Document sync retry logic
  - Explain conflict resolution
  - Document avatar upload pipeline
  - Explain deletion grace period logic
  - _Requirements: All_

- [ ] 16.3 Create user-facing help documentation
  - Write help articles for each settings section
  - Include screenshots and step-by-step guides
  - Translate to German
  - _Requirements: 7.2_

- [ ] 16.4 Final UI polish and animations
  - Add smooth transitions between screens
  - Implement loading skeletons
  - Add success/error toast messages
  - Polish form validation feedback
  - _Requirements: 2.3, 12.1_

- [ ] 16.5 Create developer runbook
  - Document support form rate limits
  - Document incident response (how to trace ticketId)
  - Document how to adjust legal versions and re-acceptance
  - _Requirements: 7.4, 8.7_

## Additional Testing Tasks

- [ ]\* 15.14 Write tests for deep links
  - Test all settings deep links routing
  - Verify back navigation
  - _Requirements: 2.7_

- [ ]\* 15.15 Write tests for quiet hours DST
  - Verify suppression across DST forward/back changes
  - Test cross-midnight windows
  - _Requirements: 4.9_

- [ ]\* 15.16 Write tests for OTA update flows
  - Validate both OTA-enabled (download, restart) and store-fallback paths
  - _Requirements: 8.5, 8.9_

- [ ]\* 15.17 Write tests for active sessions revoke
  - Assert other sessions revoked and UI updates within 10s
  - Verify security email sent
  - _Requirements: 11.6, 11.7_

- [ ]\* 15.18 Write tests for avatar pipeline
  - Ensure EXIF stripped, 1:1 crop, 512×512, <200KB
  - Verify pending/uploading/failed states and retry
  - _Requirements: 9.5, 9.9_

## Security Hardening Notes

**Apply while implementing:**

- Ensure Supabase RLS denies cross-tenant access by default; policies must explicitly allow `auth.uid()`
- Storage RLS restricts avatars to owner path; sign URLs with short TTL and do not store raw signed URLs persistently
- Do not store IP addresses on device; if collected server-side (with consent), enforce retention limit and access control
- Use SecureStore for secrets; encrypt WatermelonDB if configured; consider dev-only unencrypted fallback with explicit flag

## Notes

- All tasks marked with `*` are optional testing tasks that can be skipped if time is limited
- Core implementation tasks (1-14) should be completed in sequence
- Testing tasks (15) can be done in parallel with implementation or after core features are complete
- Documentation tasks (16) should be done last after all features are implemented and tested
- Each task should be completed and tested before moving to the next
- Refer to requirements.md and design.md for detailed specifications
