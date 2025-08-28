# Implementation Plan

## Cross-Cutting Requirements

- **Definition of Done**: Each task must include unit + integration tests green, release build performance budget met, analytics events emitting, and documentation updated
- **RRULE Standard**: All recurrence normalized to RFC 5545 RRULE strings with FREQ first, no duplicates, timezone-aware calculations
- **Notification Policy**: Default to inexact alarms, Android channels created upfront, ≥95% delivery within ±5min on test matrix
- **Offline-First**: All writes through WatermelonDB, all sync through synchronize(), flight-mode E2E required
- **Performance**: FlashList v2 targeting 60 FPS for 1k+ items in release builds
- **Accessibility**: 44pt (iOS) / 48dp (Android) minimum touch targets with automated checks
- **Analytics**: Structured events for all key operations with health monitoring

## Suggested Implementation Sequence

**Low Risk → High Risk**: 1→2→3→5→4→6→7→8→11→12→10→9→13→15→16→17→18→19→20

- [ ] 1. Set up core data models and schema validation

  - Create WatermelonDB models for playbooks, tasks, and related entities with immutable origin_step_id and phase_index
  - Implement JSON Schema 2020-12 validation with meta + CI validation using Ajv 2020
  - Include format annotations for time strings (HH:mm, ISO datetimes)
  - Set up database migrations and indexes for performance queries
  - Add TypeScript interfaces and type definitions
  - **DoD**: Schema fixtures + ajv-cli validation running in CI pipeline
  - _Requirements: 1.1, 1.2, 6.1, 7.1_

- [ ] 2. Implement RRULE generation and validation system

  - Implement strict RRULE parser/validator ensuring FREQ first, no duplicate rule parts, valid BYDAY/BYMONTHDAY values
  - Create RFC 5545 compliant RRULE generator with timezone awareness and DST handling
  - Build nextOccurrence() function computing dates in user's timezone with DST boundary support
  - Implement anchor date logic (plant.startDate or phase.startDate) for consistent calculations
  - Add comprehensive unit tests for daily/weekly/custom patterns and DST boundary test vectors
  - **DoD**: RRULE validation rejects invalid patterns, DST tests pass, timezone calculations accurate
  - _Requirements: 2.2, 2.3, 2.9_

- [ ] 3. Build notification system with Android/iOS compatibility

  - Add ensureChannels() to create Android notification channels on startup with health check
  - Implement canUseExactAlarms() checking Android 14+ SCHEDULE_EXACT_ALARM permission
  - Create notification scheduler defaulting to inexact alarms with exact alarm opt-in setting
  - Add rehydrateNotifications() for app startup notification restoration from database
  - Build Doze mode handling with WorkManager/JobScheduler fallback strategies
  - Implement delivery tracking with ≥95% success rate within ±5min target on test matrix
  - Document Android 13+ permission flow and A14 exact-alarm policy restrictions
  - **DoD**: Notifications work on Pixel 6 (A14), Moto G-class, iPhone SE/13 in Doze/Low Power modes
  - _Requirements: 2.5, 2.6, 2.7, 2.8, 2.9_

- [ ] 4. Create playbook service and template management

  - Build playbook selection with preview showing total weeks, per-phase durations, and task count
  - Enforce one-active-playbook-per-plant by default, require allowMultiple=true to bypass
  - Add idempotencyKey parameter to applyPlaybookToPlant() returning {appliedTaskCount, durationMs, jobId}
  - Implement validateOneActivePlaybookPerPlant() constraint checking
  - Add performance tracking with apply_duration_ms and playbook_apply analytics events
  - Create guided plant creation flow when no plant exists for playbook application
  - **DoD**: Preview accurate, constraints enforced, idempotency prevents double-apply, metrics emitted
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

- [ ] 5. Implement task generation from playbook templates

  - Create task generator converting playbook steps to concrete tasks with batched database inserts
  - Build RRULE pattern assignment using timezone-aware calculations from anchor dates
  - Store immutable origin_step_id for traceability and phase_index for faster progress queries
  - Add task linking to plants and playbooks with proper metadata and notification_id storage
  - Implement batched notification scheduling to keep UI thread responsive
  - Create category-specific default reminder times (Watering: 08:00, Monitoring: 20:00 local)
  - **DoD**: Tasks generated efficiently, RRULE patterns valid, notifications scheduled, metadata complete
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [ ] 6. Build schedule shifting and bulk operations

  - Create shift preview showing affected task count, first/last new dates, and collision warnings
  - Default to shifting future, non-completed tasks with toggles for including completed/manually edited tasks
  - Implement atomic schedule shifting updating due dates, RRULEs, and notifications together
  - Add exactly 30-second undo functionality with persistent undo ledger surviving app restarts:
    - Write undo descriptor (affected task IDs, prior field values including due dates/RRULEs/notifications, timestamp and expiry) to DB in same transaction as shift
    - NOTE: Do NOT schedule OS notifications directly inside the DB transaction. Scheduling platform notifications (OS APIs) is not an atomic DB operation and can fail independently, causing state drift.
      Instead implement a DB outbox pattern: record notification actions (schedule/cancel) as rows in an `outbox_notification_actions` table within the same transaction that updates tasks. Each outbox row must include action_type ("schedule"|"cancel"), a JSON payload containing all data the worker needs to perform the action (notification id, trigger time, channel, platform hints), an optional business_key for deduplication, TTL/expiry, and next_attempt timestamp for retries. A separate idempotent worker will read pending outbox rows, perform the platform notification operations, mark rows as processed (or expired) and implement retries with exponential backoff and jitter. The worker must be safe to run concurrently and on crash/restart: claim rows atomically before processing, record attempted_count and next_attempt_at, and ensure processing is idempotent by using business_key or recording the OS notification id in DB. Include cleanup/TTL for processed/expired rows to prevent unbounded growth.
    - Expose APIs to read/consume/expire undo descriptors with atomic state restoration
    - Implement cleanup/expiry logic via background job or DB TTL for reliable descriptor lifecycle
    - Add comprehensive tests for crash-and-restart scenarios, expiry conditions, and race conditions
    - Ensure undo remains atomic and survives process deaths
  - Build manual edit protection flagging tasks to exclude from bulk shifts unless user opts in
  - Show before/after diff in shift preview modal with conflict warnings for manually edited tasks
  - Emit shift_preview, shift_apply, and shift_undo analytics events with timing metrics
  - **DoD**: Preview accurate, atomic operations, undo works perfectly, manual edits protected
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9_

- [ ] 7. Implement task customization and inheritance tracking

  - Build task editing interface preserving origin linkage (playbook_id, origin_step_id) with edited badges
  - On first manual edit, set flags.manualEdited=true and exclude from bulk shift unless user opts in
  - Determine which field changes break inheritance from future bulk operations
  - Create custom note attachments (text only) and per-task reminder overrides
  - Implement "Save as template" triggered when ≥20% tasks differ or ≥N edits with validation
  - Add playbook_task_customized analytics events tracking field changes
  - Show inheritance status and bulk operation exclusion clearly in UI
  - **DoD**: Edits tracked properly, inheritance logic works, template saving functional, analytics emitted
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_

- [ ] 8. Create offline-first sync engine

  - Implement WatermelonDB synchronize() as single entry point with pullChanges/pushChanges contract
  - Build Last-Write-Wins conflict resolution with user-visible diff on overwrite
  - Add offline change queuing with pending_push status tracking for all mutations
  - Create conflict diff UI showing server vs local with one-tap "restore my version" creating new mutation
  - Ensure all writes go through WatermelonDB with no direct writes bypassing sync
  - Implement idempotency keys for pushChanges to prevent duplicate operations
  - Add sync_latency_ms and sync_fail_rate analytics with error code tracking
  - **DoD**: Flight-mode E2E passes, conflicts handled gracefully, no sync bypassing, metrics accurate
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

- [ ] 9. Build AI-driven schedule adjustment system

  - Gate suggestions behind remote feature flags with thresholds: ≥2 skipped tasks in 7 days or assessment confidence <70%
  - Implement explainable adjustment proposals showing which tasks move and why
  - Allow partial acceptance of suggestions (per phase or per task) with user control
  - Add 7-day cool-down per root cause plus "Never suggest for this plant" user setting
  - Build suggestion outcome tracking with "helpful" voting to improve suggestion quality
  - Emit ai_adjustment_suggested, ai_adjustment_applied, ai_adjustment_declined analytics events
  - Create clear UI explaining AI reasoning and allowing granular acceptance/rejection
  - **DoD**: Suggestions properly gated, explanations clear, partial acceptance works, outcomes tracked
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

- [ ] 10. Implement trichome helper with educational content

  - Create neutral, educational trichome guide: clear (immature), milky/cloudy (peak), amber (more sedating trend)
  - Include macro photography tips and lighting cautions with educational disclaimer
  - Log assessments with time-stamps and optional photos, no product recommendations
  - Offer harvest window nudges (±X days) with explicit user confirmation, no silent reschedules
  - Keep all content educational and platform-safe without commercial product links
  - Emit trichome_helper_open and trichome_helper_logged analytics events
  - Add clear disclaimers that guidance is educational, not professional advice
  - **DoD**: Content educational and compliant, assessments logged properly, nudges require confirmation
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

- [ ] 11. Create phase progress tracking system

  - Derive phase from date windows or completion of key tasks with clear computation rules
  - Build FlashList v2-backed timeline targeting 60 FPS performance with 1k+ items in release builds
  - Add phase transition notifications alerting users to upcoming care requirement changes
  - Create progress indicators showing completed, current, and upcoming tasks in timeline view
  - Implement phase summary functionality showing activities and outcomes per completed phase
  - Use FlashList v2's automatic sizing without manual estimatedItemSize configuration
  - Add profiling steps in documentation to verify performance budget compliance
  - **DoD**: Phase computation accurate, timeline performs at 60 FPS, transitions notify properly
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

- [ ] 12. Build strain-specific guidance system

  - Create strain metadata fields: autoflower/photoperiod, breeder flowering range, sativa/indica lean
  - When breeder flowering range provided, set phase durations accordingly with conservative defaults if missing
  - Add "Assumptions" chip when using conservative defaults to indicate default values
  - Build educational guidance keeping content non-commercial without product links for platform safety
  - Implement per-plant customized playbook schedules based on strain characteristics
  - Ensure guidance remains educational and compliant with app store policies
  - Surface strain-specific tips and considerations within task descriptions
  - **DoD**: Strain data influences timing, assumptions clear, guidance educational and compliant
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

- [ ] 13. Implement community template sharing

  - Strip all PII and personal plant data, include only normalized steps schema plus author handle
  - Add license field (CC-BY-SA) to clarify community reuse terms for shared templates
  - Implement RLS enforcement: owner-write/public-read permissions for community templates
  - Use Supabase Realtime Postgres Changes only for community templates (ratings/comments), not private user data
  - Build template adoption workflow allowing further customization for specific user needs
  - Ensure all private user tables secured via RLS with no Realtime subscriptions
  - Add playbook_saved_as_template analytics events tracking community contributions
  - **DoD**: PII stripped properly, RLS enforced, Realtime limited to public data, adoption works
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8_

- [ ] 14. Create comprehensive error handling system

  - Introduce typed errors (RRULEError, NotificationError, SyncError) with stable codes doubling as analytics fields
  - Build RRULE validation errors with localized messages and fallback simple recurrence options
  - Add notification failure handling with in-app reminder fallbacks and WorkManager/JobScheduler retry
  - Create sync error handling with exponential backoff retry and permanent error differentiation
  - Emit structured error events: rrule_invalid, notif_missed, sync_fail_rate with error codes
  - Provide clear user messaging with recovery options for each error type
  - Log errors appropriately for debugging while maintaining user privacy
  - **DoD**: Errors typed and trackable, fallbacks work, user messaging clear, analytics accurate
  - _Requirements: Cross-cutting error handling_

- [ ] 15. Build analytics and observability system

  - Implement structured event tracking: playbook_apply, apply_duration_ms, shift_preview|apply|undo, task_customized
  - Add notification health metrics: notif_scheduled|delivered|missed with delivery rate monitoring
  - Create conflict tracking: conflict_seen|restored with table and conflict type details
  - Build sync performance monitoring: sync_latency_ms, sync_fail_rate with operation and error code tracking
  - Add delivery-rate monitor for notifications emitting summary at app start and daily
  - Track AI suggestion outcomes: ai_suggested|applied|declined with reasoning and helpfulness votes
  - Implement trichome helper usage: trichome_helper_open|logged with assessment and photo count
  - **DoD**: All key events tracked, health metrics accurate, delivery monitoring functional
  - _Requirements: Analytics and observability_

- [ ] 16. Implement accessibility and internationalization

  - Enforce 44pt (iOS) / 48dp (Android) minimum touch targets with automated checks in CI
  - Add proper focus order and VoiceOver/TalkBack labels on all key interactive controls
  - Implement ICU MessageFormat for all playbook text, titles, summaries with pluralization support
  - Create automated accessibility compliance checks verifying minimum target sizes
  - Add unit tests for EN/DE translations ensuring ICU format correctness
  - Ensure all template strings support complex pluralization and gender/unit variations
  - Include accessibility testing in E2E test suite with screen reader simulation
  - **DoD**: Touch targets compliant, screen readers work, ICU translations functional, checks automated
  - _Requirements: Accessibility and i18n_

- [ ] 17. Create comprehensive test suite

  - Build RRULE unit tests with DST boundary test vectors covering spring/fall transitions
  - Implement notification matrix testing on Pixel 6 (A14), mid-tier Moto, iPhone SE/13 in Doze/Low Power modes
  - Create flight-mode E2E script: apply playbook → shift +3 days → customize 5 tasks → complete 10 → reconnect → verify second device parity
  - Add FlashList v2 performance tests verifying 60 FPS with 1k+ items in release builds
  - Build integration tests for offline sync with conflict resolution and error handling
  - Include accessibility testing with automated touch target size verification
  - Add schema validation tests with fixtures ensuring JSON Schema 2020-12 compliance
  - **DoD**: RRULE/DST tests pass, notification matrix succeeds, E2E offline workflow works, performance verified
  - _Requirements: Testing strategy_

- [ ] 18. Implement UI components with FlashList v2

  - Create playbook selection interface with preview cards showing weeks, phases, task counts
  - Build task timeline using FlashList v2 leveraging automatic sizing without estimatedItemSize
  - Implement shift preview modal showing before/after diff and conflict warnings for manually edited tasks
  - Create trichome helper interface with educational content, disclaimers, and macro photography tips
  - Add conflict resolution UI with server vs local diff comparison and one-tap restore
  - Ensure all interactive elements meet 44pt/48dp minimum touch targets
  - Include loading states, optimistic updates, and smooth transitions throughout
  - **DoD**: UI responsive and accessible, FlashList v2 performs well, previews accurate, conflicts clear
  - _Requirements: UI/UX implementation_

- [ ] 19. Build Supabase backend integration

  - Create sync endpoints implementing pullChanges/pushChanges objects exactly as WatermelonDB expects
  - Add idempotency keys for push operations preventing duplicate mutations
  - Implement RLS policies securing all private user tables with per-user isolation
  - Build community template storage with public-read, owner-write RLS permissions
  - Add Realtime subscriptions only for community templates (ratings/comments), never private user data
  - Create Edge Functions for sync operations with proper JWT authentication and RLS enforcement
  - Ensure all server reads/writes respect RLS without using service keys for user-scoped operations
  - **DoD**: Sync contract matches WatermelonDB, RLS enforced, Realtime limited to public data, idempotency works
  - _Requirements: Backend integration_

- [ ] 20. Integrate and polish complete feature
  - Wire all components together into cohesive user experience
  - Implement final error handling and edge case coverage
  - Add loading states, optimistic updates, and smooth transitions
  - Create onboarding flow and feature discovery
  - Perform final testing and bug fixes
  - _Requirements: Integration and polish_
