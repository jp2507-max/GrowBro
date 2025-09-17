# Implementation Plan

**Note**: For each task implementation, use Brave Search and Context7 to get up-to-date documentation, best practices, and current API information for all libraries and frameworks involved.

- [ ] 1. Database schema and models (Series/Task/Overrides/Queue)

  - Create Series, Task, OccurrenceOverride, NotificationQueue tables with WatermelonDB
  - Implement dual timezone storage: _\_local and _\_utc fields plus timezone (IANA format)
  - Add Task fields: due_at_local, due_at_utc, reminder_at_local, reminder_at_utc, timezone
  - Add Series fields: dtstart_local, dtstart_utc, timezone, rrule, until_utc, count
  - Create OccurrenceOverride per series_id + occurrence_local_date for skip/reschedule/complete
  - Add NotificationQueue with unique constraint (task_id, scheduled_for_utc) to prevent duplicates
  - Set up migrations and indices on series_id, updated_at for performance
  - _Requirements: 1.5, 1.6, 6.1, 6.7, 7.1, 8.1_

- [ ] 2. RRULE engine foundation (RFC-5545 compliant)

  - Create parseRule, validate, buildIterator({ series, overrides, range, mode: "floating" | "zone-aware" }) interface
  - Implement v1.1 scope: FREQ=DAILY|WEEKLY, INTERVAL 1-365, BYDAY only for WEEKLY
  - Support UNTIL (UTC) or COUNT (mutually exclusive), persist DTSTART properly with timezone semantics indicator
  - Add explicit DST handling: "floating" preserves local wall-clock time across DST shifts (advance local date/time in event timezone), "zone-aware" preserves absolute instant (advance UTC instants, convert to local for output)
  - Apply chosen mode consistently: UNTIL compares in UTC for zone-aware/local for floating, COUNT applies same logic
  - Build timezone-safe iterator that generates occurrences with proper semantics and applies overrides/skips
  - Use timezone-aware library (Luxon) for all conversions and DST boundary handling
  - Write tests for parsing, BYDAY combinations, COUNT vs UNTIL, Europe/Berlin DST transitions for both modes and overrides
  - _Requirements: 1.1, 1.2, 1.5, 1.7, 1.8_

- [ ] 3. Task management system (series-aware)

  - Implement CRUD operations for one-off tasks and recurring series
  - Add lazy materialization: only render visible instances, no full pre-generation
  - Create complete/skip actions on occurrence level that generate overrides without affecting series logic
  - Implement task completion tracking with precise timestamps and next occurrence materialization
  - Write unit tests for create/edit/delete, complete/skip flows, visible window materialization
  - _Requirements: 1.1, 1.2, 7.1, 7.2, 7.5, 7.6, 7.7_

- [ ] 4. Local notifications with Android 13+ permission handling

  - Integrate expo-notifications with scheduling from local time semantics to concrete UTC trigger dates
  - Add runtime POST_NOTIFICATIONS permission request for Android 13+ (API 33)
  - Create permission denial banner with Settings deep-link and graceful degradation
  - Implement notification cancellation on task completion/deletion
  - Add delivery delay logging for Doze/power-saving mode analysis
  - Write tests for permission flows, foreground/background delivery, scheduling accuracy
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.6, 2.7, 2.8, 8.1, 8.2, 8.4, 8.6_

- [ ] 5. Differential notification rehydration system
  - Implement rehydrateNotifications(changedTaskIds?) with taskId → notificationId mapping comparison
  - Add rehydration triggers: app start, post-sync, timezone/DST changes
  - Create queue status management with outdated entry cancellation
  - Implement differential re-planning: only changed triggers get rescheduled
  - Write tests for rehydration after sync operations and timezone transitions
  - _Requirements: 2.5, 2.7, 6.6, 8.6_
- [ ] 6. Offline-first sync engine (WatermelonDB + Supabase)

  - Implement synchronize() with pullChanges/pushChanges using Bearer JWT in Authorization header
  - Maintain RLS active with server-side user context, implement LWW via server updated_at timestamps
  - Add Idempotency-Key for push operations and tombstone processing for deleted records
  - Create atomic last_pulled_at updates after successful apply, implement queue with exponential backoff + jitter
  - Write tests for flight-mode operations, sync conflicts, data integrity, tombstone handling
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

- [ ] 7. High-performance agenda UI (FlashList v2)

  - Implement FlashList v2 with default configuration and consistent item heights
  - Add getItemType function for efficient item recycling, remove deprecated estimatedItemSize tweaks
  - Target performance budgets: 95p frame time <16.7ms, first paint ≤300ms, cold start→agenda ≤2s
  - Optimize for 1000-1500 task scenarios with no blank cells or tearing artifacts
  - Write performance tests measuring frame times and rendering consistency on mid-tier Android
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [ ] 8. Calendar screen UI components and layout

  - Create main CalendarScreen component with header, date navigation, and agenda view
  - Implement date picker/navigation controls with month/week/day view options
  - Build task item components with status indicators, plant associations, and action buttons
  - Create task creation/editing modal with recurrence options and reminder settings
  - Add empty states, loading states, and error states for various calendar scenarios
  - Implement today indicator, overdue task highlighting, and completion animations
  - Integrate with existing design system components and maintain consistent styling
  - Write component tests for rendering, interactions, and state management
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 7.1, 7.2, 7.3, 7.4_

- [ ] 9. Drag and drop system (Reanimated + Gesture Handler)

  - Implement completeDrop(targetDate, scope: 'occurrence'|'series') with worklet optimization
  - Add auto-scroll at viewport edges, haptic feedback, and visual drop zone indicators
  - Create optimistic UI updates with 5-second undo that restores exact date/time/reminder/overrides
  - Implement accessibility alternative with overflow menu "Move to date..." option
  - Write tests for drag operations, auto-scroll behavior, undo functionality, and accessibility compliance
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

- [ ] 10. Occurrence override system (RRULE exceptions)

  - Create models and flows for skip, reschedule, complete actions on occurrence level
  - Integrate overrides with RRuleEngine iterator to apply ExDates/exceptions during occurrence generation
  - Handle edge cases: multiple skip/reschedule of same occurrence, COUNT/UNTIL boundary conditions
  - Implement override conflict resolution and validation logic
  - Write tests for various override scenarios, edge cases, and iterator integration
  - _Requirements: 1.7, 1.8, 7.5, 7.6_

- [ ] 11. Template system with idempotency and bulk operations

  - Implement applyTemplate(templateId, plantId, anchorDate, idempotencyKey?) with rollback on partial failure
  - Create template preview functionality showing task diff before application
  - Add bulk shift operations (±X days) with preview and undo capabilities
  - Implement idempotency protection against duplicate template applications
  - Write tests for idempotency, preview accuracy, bulk shift operations, and error recovery
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

- [ ] 12. Plant telemetry integration hooks

  - Add non-blocking plant data updates for watering/feeding task completions
  - Implement last_watered_at and last_fed_at field updates with error logging only
  - Create relationship validation between tasks and plant records
  - Add simple consistency metrics for cultivation tracking
  - Write tests for plant data updates, relationship integrity, and error handling
  - _Requirements: 7.6, 7.7_

- [ ] 13. Comprehensive error handling and recovery

  - Create error categorization: Network/Permission/Performance/Conflict with appropriate UI guidance
  - Implement retry mechanisms with exponential backoff + jitter for network operations
  - Add conflict badge UI only when server updated_at > local edit timestamp
  - Integrate Sentry for production error logging and monitoring
  - Write tests for various error scenarios, recovery flows, and user guidance
  - _Requirements: 6.4, 6.5, 8.3, 8.5, 8.6_

- [ ] 14. Accessibility and localization support

  - Implement proper labels, roles, 44pt touch targets, and screen reader hints for drag handles
  - Add large text scaling and high contrast mode compatibility
  - Integrate i18next validation for EN/DE translations with no hardcoded strings
  - Create accessible alternatives for drag-and-drop functionality
  - Write accessibility tests and German localization verification
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 15. Comprehensive test suite and analytics

  - Implement DST Europe/Berlin scenarios testing before/after transitions
  - Add notification KPIs: scheduled/fired/interacted rates, average delivery delay
  - Create sync KPIs: queue length, checkpoint age, failure rates per table
  - Implement performance KPIs: 95p frame time, first paint, cold start measurements
  - Set up comprehensive testing matrix for device power states, offline scenarios, and large datasets
  - _Requirements: All requirements need comprehensive testing and monitoring_

- [ ] 16. Final integration and production polish
  - Integrate all components into cohesive calendar system with end-to-end flows
  - Add memory leak prevention and production performance optimizations
  - Create user onboarding flow for permissions setup and initial reminder configuration
  - Implement release gates: no P1 issues, all metrics meet targets
  - Privacy/Telemetry gate: consent toggle enforced across analytics, images never retained without opt-in, deletion SLA verified end-to-end (incl. backups)
  - Conduct final end-to-end testing across complete feature set
  - _Requirements: All requirements integrated and production-ready_
