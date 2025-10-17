# Implementation Plan: Customer Support & Feedback Loop

## Overview

This implementation plan breaks down the Customer Support & Feedback Loop feature into discrete, manageable coding tasks. Each task builds incrementally on previous work, with early testing to validate core functionality. Tasks are organized by phase, with optional testing sub-tasks marked with `*`.

## Key Implementation Notes

**Critical Decisions:**

- **Search Engine:** Use MiniSearch (pure JS, simpler and smaller than FlexSearch) for offline search
- **Background Sync:** iOS background fetch is opportunistic - rely on app resume and manual "Sync Now" as primary triggers
- **Queue Caps:** Max 50 items per queue, 100MB total storage with LRU eviction
- **Image Limits:** Max 3 images, <10MB total post-compress, enforce pre-queue with fail-fast UI
- **Rating Throttle:** 30-day cooldown + Apple 3/365 annual guard, prompt only after positive moments
- **Idempotency:** All writes require clientRequestId, server returns existing record if duplicate

**Open Decisions (to be confirmed before implementation):**

1. Status provider: Statuspage.io vs homegrown (needed for task 5.1)
2. Email provider: Postmark vs SES for support confirmations (needed for task 3.5)
3. CDN: Supabase Storage with CDN vs external CDN for educational assets (needed for task 6.2)

**Sequencing Adjustments:**

- Feature flags (10.1) moved to Phase 1 after types (1.4) to wrap screens behind flags from day one
- Error normalizer (9.1) moved to Phase 2 to enable reuse in all subsequent tasks
- Sync coordinator (8.3) implemented right after first queue service (3.3) to bake orchestration early

## Task List

- [ ] 1. Foundation: Database Schema & Data Models
- [ ] 1.1 Create WatermelonDB schema extensions for support tables
  - Add `help_articles_cache`, `support_tickets_queue`, `ai_second_opinions_queue`, `educational_content_cache`, `feedback_submissions` tables to `src/lib/watermelon-schema.ts`
  - Include all columns with proper types, indexes, and optional flags
  - Add to `support_tickets_queue`: priority (smallint, default 2), error_code (text), blob_path (text), encrypted (boolean), client_request_id (unique index), size_bytes (number)
  - Add to `ai_second_opinions_queue`: upload_policy_json (text), client_request_id (unique index), size_bytes (number)
  - Add to all queues: client_request_id with unique index for idempotency
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

- [ ] 1.2 Create WatermelonDB model classes
  - Implement model classes in `src/lib/watermelon-models/` for each new table
  - Add associations, queries, and helper methods
  - Include encryption/decryption methods for sensitive fields
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

- [ ] 1.3 Create Supabase migration for support tables
  - Write SQL migration in `supabase/migrations/` for `help_articles`, `support_tickets`, `ai_second_opinions`, `feedback` tables
  - Include CHECK constraints for enums (status, category), partial indexes for open/pending states
  - Add auto-update triggers to maintain updated_at timestamps
  - Add RLS policies with clientRequestId idempotency (return existing record if duplicate)
  - Add `support_audit_logs` table with constraints
  - Add `feature_flags` table (name text primary key, enabled boolean, config jsonb) with read-only RLS for clients
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

- [ ] 1.4 Define TypeScript types and constants
  - Create `src/types/support.ts` with all interfaces (HelpArticle, SupportTicket, SecondOpinionRequest, etc.)
  - Use const objects for enums (SupportCategory, TicketStatus, etc.)
  - Export all types for use across the app
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [ ] 1.5 Define MMKV storage keys
  - Add storage keys to `src/lib/storage.tsx` for help, support, status, education, feedback
  - Include keys for search index, drafts, preferences, cache metadata
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.8_

- [ ] 1.6 Implement feature flag service (moved from Phase 10)
  - Create `src/lib/support/feature-flags.ts` to fetch and cache feature flags from Supabase
  - Add flags for each capability (tickets, secondOpinion, statusBanner, helpCenter, education, ratingPrompt)
  - Include global kill switch for uploads (upload.disabled)
  - Implement MMKV cache with default fallbacks
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [ ]\* 1.6 Write unit tests for data models
  - Test WatermelonDB model CRUD operations
  - Test encryption/decryption for sensitive fields
  - Test query methods and associations
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

- [ ] 2. Help Center: Core Functionality
- [ ] 2.1 Implement help article caching service
  - Create `src/lib/support/help-article-cache.ts` with fetch, cache, and invalidation logic
  - Implement ETag-based delta updates
  - Add LRU eviction when cache exceeds 100MB
  - _Requirements: 1.1, 1.4, 1.8_

- [ ] 2.2 Implement client-side search index
  - Create `src/lib/support/help-search-index.ts` using MiniSearch or FlexSearch
  - Implement index building from cached articles
  - Add compression with LZ-string before MMKV storage
  - Include version checking and rebuild logic
  - _Requirements: 1.1, 1.4, 1.8_

- [ ] 2.3 Create help article API hooks
  - Implement `src/api/support/use-help-articles.ts` with React Query
  - Add `useHelpArticleSearch` hook with 200-300ms debouncing
  - Include offline/online state handling
  - _Requirements: 1.1, 1.4, 1.8_

- [ ] 2.4 Build HelpCenterScreen UI
  - Create `src/app/support/help-center.tsx` with category list and search bar
  - Implement offline banner when cached content is shown
  - Add article list with lazy loading
  - Include i18n for all UI strings (EN/DE)
  - _Requirements: 1.1, 1.4, 1.8_

- [ ] 2.5 Build HelpArticleScreen UI
  - Create `src/app/support/help-article/[id].tsx` for article detail view
  - Implement markdown rendering with `@/components/ui/markdown` wrapper
  - Add link interception with confirm dialog for external URLs
  - Include article rating widget (helpful/not helpful)
  - Use expo-image with lazy loading for article images
  - _Requirements: 1.1, 1.4, 1.8_

- [ ] 2.6 Implement article rating functionality
  - Add rating submission to API hooks
  - Store ratings locally and sync to Supabase
  - Show feedback prompt for "not helpful" ratings
  - _Requirements: 1.1, 1.4_

- [ ]\* 2.7 Write unit tests for help center
  - Test search index building and querying
  - Test cache invalidation and LRU eviction
  - Test article rating submission
  - _Requirements: 1.1, 1.4, 1.8_

- [ ] 3. Contact Support: Queue & Sync
- [ ] 3.1 Implement device context capture utility
  - Create `src/lib/support/device-context.ts` to capture app version, OS, device model, feature flags, last screen route, Sentry lastEventId
  - Add locale, timezone, network type (wifi/cellular) detection
  - Exclude PII (no SSID, device identifiers)
  - _Requirements: 1.2, 1.7_

- [ ] 3.2 Implement attachment processing
  - Create `src/lib/support/attachment-processor.ts` for image compression and EXIF stripping
  - Use expo-image-manipulator for compression (target <1MB, 80% JPEG quality, max 2048px)
  - Warn if EXIF stripping fails, allow retry
  - Limit to 3 images, total <10MB post-compress
  - _Requirements: 1.2, 1.7_

- [ ] 3.3 Implement support ticket queue service
  - Create `src/lib/support/ticket-queue.ts` for queueing, encryption, and sync
  - Implement per-user encryption key derivation using expo-secure-store
  - Add priority-based queue processing (1=high, 2=normal, 3=low)
  - Include exponential backoff retry logic with error code tracking
  - _Requirements: 1.2, 1.5, 1.7, 1.8_

- [ ] 3.4 Create support ticket API hooks
  - Implement `src/api/support/use-support-tickets.ts` with React Query
  - Add `useSubmitSupportTicket` mutation with clientRequestId for idempotency
  - Include `useSupportTicketHistory` for viewing past tickets
  - _Requirements: 1.2, 1.7_

- [ ] 3.5 Create Supabase Edge Function for support intake
  - Implement `supabase/functions/support-intake/index.ts`
  - Validate request, check for duplicate clientRequestId
  - Generate ticket reference, send email confirmation
  - Return ticket reference and estimated response time
  - _Requirements: 1.2, 1.7_

- [ ] 3.6 Build ContactSupportScreen UI
  - Create `src/app/support/contact.tsx` with form (category, subject, description, attachments)
  - Show device context preview with opt-out toggles
  - Display EXIF warning for photos with location data
  - Show submission status (queued/sending/sent)
  - Include rate limiting UI with cooldown message
  - _Requirements: 1.2, 1.7_

- [ ] 3.7 Build SupportHistoryScreen UI
  - Create `src/app/support/history.tsx` with paginated ticket list
  - Show ticket status (queued/sent/open/in-progress/resolved)
  - Include local queue status for unsent tickets
  - _Requirements: 1.2, 1.7_

- [ ] 3.8 Build SupportTicketDetailScreen UI
  - Create `src/app/support/ticket/[id].tsx` for ticket detail view
  - Display ticket information, attachments, status updates
  - Show sync status for queued tickets
  - _Requirements: 1.2, 1.7_

- [ ]\* 3.9 Write unit tests for contact support
  - Test device context capture (no PII)
  - Test attachment compression and EXIF stripping
  - Test queue encryption/decryption
  - Test priority-based queue processing
  - _Requirements: 1.2, 1.5, 1.7, 1.8_

- [ ] 4. AI Assessment Second Opinion
- [ ] 4.1 Implement second opinion queue service
  - Create `src/lib/support/second-opinion-queue.ts` for queueing and upload
  - Add Wi-Fi-only upload policy enforcement
  - Implement signed URL upload to Supabase storage
  - Include photo size validation (<5MB) and retry logic
  - _Requirements: 1.3, 1.7, 1.8_

- [ ] 4.2 Create second opinion API hooks
  - Implement `src/api/support/use-second-opinions.ts` with React Query
  - Add `useRequestSecondOpinion` mutation with consent validation
  - Include `useSecondOpinionStatus` for polling review status
  - _Requirements: 1.3, 1.7_

- [ ] 4.3 Create Supabase Edge Function for second opinion submission
  - Implement `supabase/functions/second-opinion-submit/index.ts`
  - Validate photo size, consent flags, and clientRequestId
  - Generate signed URL for photo upload
  - Return request ID, estimated completion time, and queue position
  - _Requirements: 1.3, 1.7_

- [ ] 4.4 Build SecondOpinionRequestModal UI
  - Create `src/components/support/second-opinion-request-modal.tsx`
  - Implement consent screen with separate toggles for human review and training use
  - Show estimated review time and privacy notice
  - Display upload progress with cancel option
  - _Requirements: 1.3, 1.7_

- [ ] 4.5 Build SecondOpinionStatusCard UI
  - Create `src/components/support/second-opinion-status-card.tsx`
  - Show review status (queued/uploading/pending-review/reviewed)
  - Display queue position and estimated completion time
  - Include notification when review is complete
  - _Requirements: 1.3, 1.7_

- [ ] 4.6 Build AssessmentComparisonView UI
  - Create `src/components/support/assessment-comparison-view.tsx`
  - Display AI assessment and expert review side-by-side
  - Highlight differences with color-blind-safe palette
  - Use virtualized list if issues >10
  - Show model version and reviewer role
  - _Requirements: 1.3, 1.7_

- [ ] 4.7 Integrate second opinion into AI assessment flow
  - Add "Request Second Opinion" and "Report Issue" buttons to AI assessment results screen
  - Link to SecondOpinionRequestModal
  - Show SecondOpinionStatusCard when review is pending/complete
  - _Requirements: 1.3, 1.7_

- [ ]\* 4.8 Write unit tests for second opinion
  - Test consent validation
  - Test Wi-Fi-only upload policy
  - Test signed URL generation and upload
  - Test comparison view diff highlighting
  - _Requirements: 1.3, 1.7, 1.8_

- [ ] 5. System Status & Outage Messaging
- [ ] 5.1 Create Supabase Edge Function for status feed
  - Implement `supabase/functions/status-feed/index.ts`
  - Merge external status page (Statuspage.io) with internal health checks
  - Normalize incidents with severity (critical/degraded/informational)
  - Add region filtering (?region=eu|na)
  - Include uptime metrics (last 24h, 7d, 30d)
  - Set Cache-Control headers (max-age=60, stale-while-revalidate=120)
  - _Requirements: 1.4, 1.8_

- [ ] 5.2 Implement status cache service
  - Create `src/lib/support/status-cache.ts` for caching status feed
  - Store last known status in MMKV with timestamp
  - Implement ETag support for conditional requests
  - Add banner dismissal state per incident ID
  - _Requirements: 1.4, 1.8_

- [ ] 5.3 Create status API hooks
  - Implement `src/api/support/use-system-status.ts` with React Query
  - Add polling every 5 minutes when app is active
  - Use background fetch for periodic checks when app is inactive
  - _Requirements: 1.4, 1.8_

- [ ] 5.4 Build StatusBanner component
  - Create `src/components/support/status-banner.tsx`
  - Color-code by severity with WCAG AA compliant colors from theme tokens
  - Add role="status" for screen reader announcement
  - Implement reduced motion (fade only, no slide)
  - Show last updated timestamp
  - _Requirements: 1.4, 1.8_

- [ ] 5.5 Build StatusDetailScreen UI
  - Create `src/app/support/status.tsx` for detailed status page
  - Show current incidents with descriptions and affected services
  - Display uptime metrics with charts
  - Include link to external status page
  - _Requirements: 1.4, 1.8_

- [ ] 5.6 Integrate status banner into app layout
  - Add StatusBanner to root layout (`src/app/_layout.tsx`)
  - Show banner only when active incidents exist
  - Handle offline state (don't show false outages)
  - Auto-dismiss when incident is resolved
  - Auto-undismiss if severity increases
  - _Requirements: 1.4, 1.8_

- [ ]\* 5.7 Write unit tests for system status
  - Test status feed parsing and normalization
  - Test severity-based banner display logic
  - Test offline state handling
  - Test dismissal and auto-undismiss logic
  - _Requirements: 1.4, 1.8_

- [ ] 6. Educational Content Integration
- [ ] 6.1 Create content map service
  - Create `src/lib/support/content-map.ts` to map task types, playbook steps, and growth stages to content IDs
  - Store content map in MMKV with version tracking
  - Invalidate on app update
  - _Requirements: 1.5, 1.8_

- [ ] 6.2 Implement educational content cache service
  - Create `src/lib/support/education-cache.ts` for caching articles and videos
  - Implement prefetch service with Wi-Fi-only option
  - Cap weekly download size (50MB)
  - Add LRU eviction and cache management
  - _Requirements: 1.5, 1.8_

- [ ] 6.3 Create educational content API hooks
  - Implement `src/api/support/use-educational-content.ts` with React Query
  - Add `useEducationalContentForTask` hook
  - Include language fallback logic (DE → EN)
  - _Requirements: 1.5, 1.8_

- [ ] 6.4 Build EducationalContentCard component
  - Create `src/components/support/educational-content-card.tsx`
  - Show "Learn More" link with content title and thumbnail
  - Display estimated download size for uncached content
  - Include Wi-Fi-only toggle
  - _Requirements: 1.5, 1.8_

- [ ] 6.5 Build EducationalArticleModal component
  - Create `src/components/support/educational-article-modal.tsx`
  - Render markdown content with images and video embeds
  - Use WebView for videos with incognito mode and cookie blocking
  - Show language fallback badge if content not in user's language
  - _Requirements: 1.5, 1.8_

- [ ] 6.6 Integrate educational content into calendar/tasks
  - Add EducationalContentCard to task detail screens
  - Link to relevant content based on task type
  - Show contextual tips for growth stages
  - _Requirements: 1.5, 1.8_

- [ ] 6.7 Integrate educational content into playbooks
  - Add educational content links to playbook step details
  - Show overview content when selecting a playbook
  - Include related content suggestions after milestone completion
  - _Requirements: 1.5, 1.8_

- [ ] 6.8 Integrate educational content into AI assessments
  - Add educational links for each detected issue in AI assessment results
  - Link to articles about deficiencies, pests, stress, etc.
  - _Requirements: 1.5, 1.8_

- [ ]\* 6.9 Write unit tests for educational content
  - Test content map lookup and versioning
  - Test prefetch service with Wi-Fi-only enforcement
  - Test language fallback logic
  - Test cache eviction
  - _Requirements: 1.5, 1.8_

- [ ] 7. Feedback Collection & Rating System
- [ ] 7.1 Implement rating prompt service
  - Create `src/lib/support/rating-prompt.ts` for throttling and trigger logic
  - Store last prompt timestamp and prompt count in MMKV
  - Implement 30-day cooldown and yearly window tracking (Apple 3/365 limit)
  - Add opt-out preference handling
  - _Requirements: 1.6, 1.8_

- [ ] 7.2 Implement native rating API wrappers
  - Create `src/lib/support/native-rating.ts` for platform-specific rating APIs
  - iOS: Use SKStoreReviewController.requestReview()
  - Android: Use Play In-App Review API
  - Handle cases where dialog doesn't appear due to quota
  - _Requirements: 1.6_

- [ ] 7.3 Create feedback API hooks
  - Implement `src/api/support/use-feedback.ts` with React Query
  - Add `useSubmitFeedback` mutation with clientRequestId
  - Include `useFeedbackHistory` for viewing past feedback
  - _Requirements: 1.6_

- [ ] 7.4 Build RatingPromptModal component
  - Create `src/components/support/rating-prompt-modal.tsx`
  - Show 1-5 star rating with optional comment
  - Route 4-5 stars to native store review
  - Route 1-3 stars to in-app feedback form
  - Include "Don't ask again" option
  - _Requirements: 1.6_

- [ ] 7.5 Build FeedbackFormScreen UI
  - Create `src/app/support/feedback.tsx` for detailed feedback collection
  - Include rating, comment, and context capture
  - Show submission confirmation with reference number
  - _Requirements: 1.6_

- [ ] 7.6 Implement rating prompt triggers
  - Add triggers after significant actions (playbook completion, harvest logged, AI assessment used 5 times)
  - Ensure triggers only fire post-success screens, never mid-critical paths
  - Check throttle and opt-out before showing prompt
  - _Requirements: 1.6_

- [ ] 7.7 Add feedback section to Settings
  - Add "Send Feedback" option to Settings screen
  - Add "Rating Prompts" toggle to Privacy settings
  - Link to FeedbackFormScreen
  - _Requirements: 1.6_

- [ ]\* 7.8 Write unit tests for feedback system
  - Test 30-day throttling logic
  - Test yearly window tracking
  - Test opt-out preference handling
  - Test rating routing (4-5 stars vs 1-3 stars)
  - _Requirements: 1.6, 1.8_

- [ ] 8. Background Sync & Queue Processing
- [ ] 8.1 Implement background task registration
  - Create `src/lib/support/background-tasks.ts` for expo-task-manager setup
  - Register background tasks for queue processing and status polling
  - Handle iOS opportunistic background fetch limitations
  - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 1.8_

- [ ] 8.2 Implement queue processor service
  - Create `src/lib/support/queue-processor.ts` for batch processing
  - Process support tickets, second opinions, and feedback in priority order
  - Yield to event loop after each batch (10 items)
  - Track queue metrics (wait time, success rate)
  - _Requirements: 1.2, 1.3, 1.6, 1.8_

- [ ] 8.3 Implement sync coordinator
  - Create `src/lib/support/sync-coordinator.ts` to orchestrate all support-related syncs
  - Coordinate help article cache updates, queue processing, and status polling
  - Handle network state changes (offline → online)
  - Show subtle "syncing" indicator during background sync
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.8_

- [ ] 8.4 Add sync status to Settings
  - Create Settings section showing queue status (pending items, last sync time)
  - Add "Sync Now" button for manual sync
  - Show sync errors with retry option
  - _Requirements: 1.2, 1.3, 1.6, 1.8_

- [ ]\* 8.5 Write unit tests for background sync
  - Test queue processing with priority ordering
  - Test event loop yielding
  - Test network state change handling
  - Test sync coordinator orchestration
  - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 1.8_

- [ ] 9. Error Handling & Observability
- [ ] 9.1 Implement error normalizer utility
  - Create `src/lib/support/error-normalizer.ts` to map errors to SupportErrorCategory
  - Handle Axios errors, Supabase errors, and unknown errors
  - Provide user-friendly error messages and recovery actions
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [ ] 9.2 Implement "Copy Technical Details" feature
  - Create `src/lib/support/technical-details.ts` to format error details
  - Include error code, category, message, timestamp, app version, platform
  - Add "Copy Technical Details" button to error UI
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [ ] 9.3 Add Sentry breadcrumbs for support flows
  - Add breadcrumbs for help article views, support ticket submissions, second opinion requests, status banner interactions
  - Implement breadcrumb sampling (max 20 per session)
  - Exclude PII from breadcrumbs
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [ ] 9.4 Add Sentry custom transactions
  - Create custom transactions for support ticket submission, photo upload, queue processing
  - Include measurements (attachment count, size, queue depth)
  - _Requirements: 1.2, 1.3, 1.6_

- [ ] 9.5 Implement analytics events (consent-gated)
  - Add analytics events for help article views, support submissions, second opinions, ratings
  - Respect user's analytics consent preference
  - Aggregate metrics server-side
  - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6_

- [ ]\* 9.6 Write unit tests for error handling
  - Test error normalizer with various error types
  - Test technical details formatting
  - Test breadcrumb sampling
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [ ] 10. Feature Flags & Remote Config
- [ ] 10.1 Implement feature flag service
  - Create `src/lib/support/feature-flags.ts` to fetch and cache feature flags from Supabase
  - Add flags for each capability (tickets, secondOpinion, statusBanner, helpCenter, education, ratingPrompt)
  - Include global kill switch for uploads
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [ ] 10.2 Create Supabase table for feature flags
  - Add `feature_flags` table to Supabase migration
  - Include flag name, enabled status, and optional config JSON
  - Add RLS policies for read-only access
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [ ] 10.3 Integrate feature flags into components
  - Wrap each major feature with feature flag checks
  - Show "Feature unavailable" message when flag is disabled
  - Hide UI elements for disabled features
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [ ] 10.4 Add feature flag management to admin dashboard
  - Create admin UI for toggling feature flags (separate from main app)
  - Include audit log for flag changes
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [ ]\* 10.5 Write unit tests for feature flags
  - Test flag fetching and caching
  - Test component behavior with flags enabled/disabled
  - Test kill switch functionality
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [ ] 11. Internationalization (i18n)
- [ ] 11.1 Add translation keys for help center
  - Add keys to `src/translations/en.json` and `src/translations/de.json` for help center UI
  - Include category names, search placeholder, offline banner, rating labels
  - _Requirements: 1.1, 1.4_

- [ ] 11.2 Add translation keys for contact support
  - Add keys for support form labels, status messages, error messages
  - Include category names, submission confirmations, queue status
  - _Requirements: 1.2_

- [ ] 11.3 Add translation keys for second opinion
  - Add keys for consent screen, status labels, comparison view
  - Include privacy notices, estimated times, review completion messages
  - _Requirements: 1.3_

- [ ] 11.4 Add translation keys for system status
  - Add keys for severity labels (critical/degraded/informational), banner messages
  - Include uptime labels, incident descriptions
  - _Requirements: 1.4_

- [ ] 11.5 Add translation keys for educational content
  - Add keys for "Learn More" labels, Wi-Fi prompts, language fallback messages
  - _Requirements: 1.5_

- [ ] 11.6 Add translation keys for feedback
  - Add keys for rating prompts, feedback form, opt-out messages
  - _Requirements: 1.6_

- [ ] 11.7 Validate translation completeness
  - Run `pnpm lint:translations` to ensure all keys exist in both EN and DE
  - Fix any missing or mismatched keys
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [ ] 12. Accessibility & Polish
- [ ] 12.1 Add accessibility labels and hints
  - Add accessibilityLabel and accessibilityHint to all interactive elements
  - Ensure role="status" for status banners
  - Add semantic headings for screen readers
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [ ] 12.2 Verify touch target sizes
  - Ensure all buttons and interactive elements are ≥44pt
  - Add padding where necessary
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [ ] 12.3 Verify color contrast
  - Check all text and UI elements meet WCAG AA standards
  - Use theme tokens for colors (no hardcoded values)
  - Test with color-blind simulators
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [ ] 12.4 Test with screen readers
  - Test all flows with VoiceOver (iOS) and TalkBack (Android)
  - Ensure proper focus order and announcements
  - Fix any navigation issues
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [ ] 12.5 Test with dynamic font sizes
  - Test all screens with large text settings enabled
  - Ensure no truncation or overlap
  - Adjust layouts as needed
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [ ] 12.6 Implement reduced motion support
  - Use fade-only animations when reduced motion is enabled
  - Remove slide/scale animations
  - Test with reduced motion settings
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [ ] 12.7 Add loading states and skeletons
  - Add skeleton loaders for help articles, support history, status feed
  - Show loading indicators during sync
  - Ensure smooth transitions
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [ ] 12.8 Add empty states
  - Create empty state designs for no help articles, no support tickets, no feedback
  - Include helpful CTAs and guidance
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [ ] 12.9 Polish animations and transitions
  - Use Reanimated for smooth 60fps animations
  - Add enter/exit animations for modals and screens
  - Ensure animations respect reduced motion
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [ ] 13. Integration & Navigation
- [ ] 13.1 Add support routes to navigation
  - Add routes to `src/app/_layout.tsx` for all support screens
  - Include help-center, contact, history, ticket-detail, second-opinion, status, feedback
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [ ] 13.2 Add support section to Settings
  - Add "Support & Help" section to Settings screen
  - Include links to Help Center, Contact Support, Support History, System Status, Send Feedback
  - Add "Privacy" section with Support Data and Rating Prompts toggle
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

- [ ] 13.3 Integrate with existing sync engine
  - Extend existing sync engine to handle support queues
  - Add support queue processing to sync cycle
  - Coordinate with existing plant/task sync
  - _Requirements: 1.2, 1.3, 1.6, 1.8_

- [ ] 13.4 Add "Contact Support" links throughout app
  - Add "Contact Support" button to error screens
  - Add "Contact Support" link at bottom of help articles
  - Add "Contact Support" option in Settings
  - _Requirements: 1.2_

- [ ] 13.5 Integrate educational content into existing screens
  - Add educational content cards to task detail screens
  - Add educational content links to playbook screens
  - Add educational content links to AI assessment results
  - _Requirements: 1.5_

- [ ] 13.6 Add status banner to root layout
  - Integrate StatusBanner into `src/app/_layout.tsx`
  - Position at top of screen, above navigation
  - Ensure proper z-index and layout
  - _Requirements: 1.4_

- [ ] 14. Testing & Quality Assurance
- [ ] 14.1 Run all unit tests
  - Execute `pnpm test` to run all unit tests
  - Fix any failing tests
  - Ensure coverage meets targets (>80% for core logic)
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

- [ ] 14.2 Test offline scenarios
  - Test help article search offline
  - Test support ticket submission offline → online sync
  - Test second opinion request offline → online upload
  - Test status banner with offline state
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.8_

- [ ] 14.3 Test error scenarios
  - Test network timeout during support submission
  - Test storage quota exceeded
  - Test permission denied for camera
  - Test invalid data validation
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [ ] 14.4 Test performance
  - Measure help search latency (<150ms offline, <700ms online)
  - Measure status banner render time (<50ms cold start)
  - Measure image compression time (<2s for 5MB photo)
  - Measure queue processing throughput (>10 items/sec)
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ] 14.5 Test accessibility
  - Test all flows with VoiceOver (iOS) and TalkBack (Android)
  - Test with large text settings
  - Test with reduced motion enabled
  - Verify color contrast with accessibility tools
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [ ] 14.6 Test internationalization
  - Test all screens in German (DE)
  - Verify language fallback for missing content
  - Test date/time formatting in different locales
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [ ]\* 14.7 Create Maestro E2E tests
  - Create test for status banner display and dismissal
  - Create test for offline queue submission and sync
  - Create test for help article search and view
  - Create test for support ticket submission (happy path)
  - _Requirements: 1.1, 1.2, 1.4, 1.8_

- [ ] 14.8 Run compliance checks
  - Run `pnpm compliance:audit` to verify GDPR/COPPA compliance
  - Run `pnpm privacy:validate` to check privacy manifest
  - Fix any compliance issues
  - _Requirements: 1.7_

- [ ] 14.9 Test on physical devices
  - Test on mid-tier Android device (target 60fps)
  - Test on older iOS device (iPhone 11 or older)
  - Verify performance and UX on both platforms
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [ ] 15. Documentation & Deployment
- [ ] 15.1 Write developer documentation
  - Document architecture and data flow in `docs/support-system.md`
  - Document API endpoints and Edge Functions
  - Document queue processing and sync logic
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.8_

- [ ] 15.2 Write user-facing help articles
  - Create initial help articles for common topics (Getting Started, Calendar & Tasks, etc.)
  - Upload articles to Supabase `help_articles` table
  - Include screenshots and examples
  - _Requirements: 1.1_

- [ ] 15.3 Create admin documentation
  - Document how to manage feature flags
  - Document how to review second opinions
  - Document how to respond to support tickets
  - _Requirements: 1.2, 1.3_

- [ ] 15.4 Update privacy policy
  - Add sections for support data collection and retention
  - Add sections for AI training consent
  - Add sections for third-party services (Statuspage, email provider)
  - _Requirements: 1.7_

- [ ] 15.5 Update App Store/Play Store listings
  - Update privacy labels for data collection
  - Add screenshots of new features
  - Update app description to mention support features
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [ ] 15.6 Deploy Supabase Edge Functions
  - Deploy `support-intake`, `second-opinion-submit`, `status-feed` functions
  - Test functions in staging environment
  - Monitor function logs for errors
  - _Requirements: 1.2, 1.3, 1.4_

- [ ] 15.7 Run database migrations
  - Apply Supabase migrations to staging database
  - Verify RLS policies and indexes
  - Apply migrations to production database
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [ ] 15.8 Configure external services
  - Set up Statuspage.io account and configure incidents
  - Configure email provider for support confirmations
  - Set up CDN for educational content (if using external CDN)
  - _Requirements: 1.2, 1.4, 1.5_

- [ ] 15.9 Create rollout plan
  - Define feature flag rollout schedule (10% → 50% → 100%)
  - Set up monitoring dashboards for error rates and performance
  - Prepare rollback plan with feature flags
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [ ] 15.10 Conduct beta testing
  - Release to internal testers (10-20 users)
  - Collect feedback on UX and functionality
  - Monitor error rates and performance metrics
  - Fix critical issues before wider rollout
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

---

# Task List Refinements

This section contains critical updates to specific tasks based on final design review.

## Phase 1: Foundation

### Task 1.1 - WatermelonDB Schema

**Additional columns to add:**

- `support_tickets_queue`: priority (smallint, default 2), error_code (text), blob_path (text), encrypted (boolean), client_request_id (unique index), size_bytes (number)
- `ai_second_opinions_queue`: upload_policy_json (text with wifiOnly boolean), client_request_id (unique index), size_bytes (number)
- All queues: client_request_id with unique index for idempotency

### Task 1.3 - Supabase Migration

**Additional requirements:**

- Add auto-update triggers for updated_at timestamps
- Partial indexes for status='open' and status='pending-review'
- RLS policies must handle clientRequestId idempotency (return existing record if duplicate)
- Add `feature_flags` table: name (text primary key), enabled (boolean), config (jsonb), with read-only RLS

### Task 1.6 - Feature Flags (MOVED FROM PHASE 10)

**New task in Phase 1:**

- Create `src/lib/support/feature-flags.ts`
- Fetch and cache flags from Supabase
- Include global kill switch: `upload.disabled`
- MMKV cache with default fallbacks
- **Rationale:** Wrap all new screens behind flags from day one

## Phase 2: Help Center

### Task 2.2 - Client-Side Search Index

**Implementation decision:**

- Use **MiniSearch** (not FlexSearch or SQLite FTS5)
- **Rationale:** Pure JS, simpler, smaller, guaranteed to work in Expo
- Add rebuild-on-version-mismatch logic
- Cap index to top N terms (prune stop words, rare terms)
- Compress with LZ-string before MMKV storage
- Target: <2MB compressed

**Acceptance criteria:**

- Search p95 <150ms offline for 1k articles
- Index build <1.5s for 1k articles
- Rebuilds on version change

### Task 2.7 - Unit Tests

**Additional test:**

- Test index rebuild on version mismatch

## Phase 3: Contact Support

### Task 3.1 - Device Context

**Additional fields:**

- Add locale, timezone
- Add isWifi boolean (no SSID for privacy)

### Task 3.2 - Attachment Processing

**Enforce pre-queue limits:**

- Max 3 images
- Total <10MB post-compress
- Fail-fast with clear UI error if limits exceeded
- **Rationale:** Prevent failing uploads later

### Task 3.3 - Support Ticket Queue

**Additional requirements:**

- Per-queue cap: max 50 items
- Per-user storage cap: 100MB with LRU eviction
- Key derivation via expo-secure-store
- Ensure wipe-on-submit for encrypted payloads

**Acceptance criteria:**

- Queues respect caps, show clear errors when exceeded
- Attachments compressed to <1MB each, total <10MB

### Task 3.5 - Supabase Edge Function

**Smoke tests to add:**

- 200 on happy path
- 409 on duplicate clientRequestId
- 400 on invalid data

## Phase 4: AI Assessment Second Opinion

### Task 4.1 - Second Opinion Queue

**Additional requirements:**

- Default wifiOnly: true
- Allow user override via Settings toggle
- Validate photo <5MB before queue
- Compress if larger, fail if still >5MB

## Phase 5: System Status

### Task 5.1 - Status Feed Edge Function

**Additional requirements:**

- Add ETag/If-None-Match support
- Add Last-Modified header
- Add region filter query param (?region=eu|na)

### Task 5.3 - Status API Hooks

**Polling strategy:**

- Poll every 5 minutes in foreground
- Background fetch "best effort" with exponential backoff on failures
- **Note:** iOS background fetch is opportunistic, not guaranteed

### Task 5.6 - Status Banner Integration

**Accessibility requirements:**

- role="status" for screen reader
- Focus announcement only on first appearance per incident ID, not every render
- Reduced motion: fade only via `.reduceMotion(ReduceMotion.System)`
- lastUpdated timestamp visible

**Acceptance criteria:**

- Banner announces once per incident
- Respects reduced motion
- lastUpdated visible

## Phase 6: Educational Content

### Task 6.2 - Educational Content Cache

**Additional requirements:**

- Weekly 50MB download cap
- "Pause prefetch" toggle in Settings
- LRU eviction when cap exceeded

## Phase 7: Feedback & Rating

### Task 7.1 - Rating Prompt Service

**Additional requirements:**

- Track Apple annual counter (3/365 limit)
- Don't prompt if iOS system-level setting disables app rating
- Check system setting before showing prompt

**Acceptance criteria:**

- Never triggers within 30 days
- Never exceeds Apple quota (3/365)
- Android gracefully no-ops if quota blocks dialog

## Phase 8: Background Sync

### Task 8.1 - Background Task Registration

**Critical note:**

- iOS background fetch is opportunistic
- Rely on app resume and manual "Sync Now" as primary triggers
- Don't promise strict SLAs to users

### Task 8.3 - Sync Coordinator (MOVED FROM LATER)

**New position: Right after task 3.3**

- Implement sync coordinator early to bake orchestration from the start
- **Rationale:** De-risk integration issues

## Phase 9: Error Handling

### Task 9.1 - Error Normalizer (MOVED TO PHASE 2)

**New position: After task 2.2**

- Create `src/lib/support/error-normalizer.ts` early
- Normalize Axios, Supabase PostgREST, Edge Function, and Storage errors
- Include retryAfter based on 429/503 responses
- **Rationale:** Enable reuse in all subsequent tasks

## Phase 10: Feature Flags

**MOVED TO PHASE 1 (task 1.6)**

## Phase 11: Internationalization

### All i18n Tasks

**Additional keys to add:**

- DE keys for consent toggles
- DE keys for status severity labels
- DE keys for queue states
- DE keys for offline banners
- Validate with lint rule if present

## Phase 12: Accessibility

### Task 12.6 - Reduced Motion

**Implementation:**

- Use `.reduceMotion(ReduceMotion.System)` on all Reanimated entering/exiting animations
- Provide non-animated fallback for critical UI

## Phase 13: Integration

### Task 13.6 - Status Banner Integration

**Accessibility:**

- role="status"
- Focus announcement only on first appearance per incident ID
- Not on every render

## Phase 14: Testing

### Task 14.4 - Performance

**Budgets to verify:**

- Search p95 <150ms offline
- Index build <1.5s for 1k articles
- Queue flush: yield every 10 items
- Status banner render <50ms cold start

### Task 14.7 - Maestro E2E Tests

**Priority flows:**

1. Status banner display and dismissal
2. Offline queue submission and sync
3. Help article search and view
4. Support ticket submission (happy path)

## Phase 15: Documentation & Deployment

### Task 15.6 - Deploy Edge Functions

**Smoke tests per function:**

- 200 on happy path
- 409 on duplicate clientRequestId
- 400 on invalid consent/photo size

## Open Decisions (Block Execution)

These must be confirmed before starting implementation:

1. **FTS Engine:** Confirmed - Use MiniSearch
2. **Status Provider:** Statuspage.io vs homegrown (needed for task 5.1)
3. **Email Provider:** Postmark vs SES for support confirmations (needed for task 3.5)
4. **CDN:** Supabase Storage with CDN vs external CDN for educational assets (needed for task 6.2)
