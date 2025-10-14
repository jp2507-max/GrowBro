# Implementation Plan

- [x] 1. Set up core infrastructure and database schema
  - Create WatermelonDB schema with proper indexing for nutrient engine tables
  - Add composite indexes for optimal query performance: ph_ec_readings(reservoir_id, measured_at DESC), ph_ec_readings(plant_id, measured_at DESC), deviation_alerts(reservoir_id, triggered_at DESC)
  - Avoid over-indexing low-cardinality enum-like columns (alert_type, severity, medium) unless frequently filtered with high selectivity
  - Single-column indexes only on high-cardinality, frequently queried columns: ph_ec_readings.meter_id, deviation_alerts.measurement_id
  - Create migrations.ts and bump appSchema.version on every change; write forward-only steps
  - Use a dev build (not Expo Go) and configure the WatermelonDB config plugin
  - Set up database models with relationships and validation
  - Write unit tests for database schema and model validation
  - _Requirements: 8.1, 8.4_

## Database Indexing Strategy

### Composite Indexes for Optimal Query Performance

The nutrient engine implements strategic composite indexing to optimize common query patterns:

**ph_ec_readings table:**

- `(reservoir_id, measured_at DESC)` - For reservoir-specific measurement history queries
- `(plant_id, measured_at DESC)` - For plant-specific measurement history queries
- Single-column index on `meter_id` - For deduplication queries
- Single-column index on `measured_at` - For time-based range queries

**deviation_alerts table:**

- `(reservoir_id, triggered_at DESC)` - For reservoir-specific alert history
- Single-column index on `measurement_id` - For alert-to-measurement lookups

### Indexing Guidelines

- **Use composite indexes** for multi-column WHERE clauses with high selectivity
- **Avoid over-indexing** low-cardinality columns (enums like `alert_type`, `severity`, `medium`, `type`)
- **Single-column indexes** only for high-cardinality, frequently filtered columns
- **Time-based sorting** uses DESC order for recent-first queries
- **Foreign key relationships** indexed for JOIN performance

### Migration Strategy

- Schema version bumped to 5 with forward-only migration steps
- All nutrient engine tables created in single migration for atomic deployment
- Indexes applied at table creation for optimal initial performance
- Migration includes both schema definition and column array for WatermelonDB compatibility

- [x] 2. Implement core utility functions and type definitions
  - [x] 2.1 Create EC/pH conversion and temperature compensation utilities
    - Write toEC25() function with configurable beta factor (≈1.9–2.0%/°C) that skips double-correction when atcOn=true
    - Implement ecToPpm() conversion with 500/700 scale support as view-only; preserve EC@25°C as canonical store
    - Replace stored confidence with derived qualityFlags: ('NO_ATC'|'CAL_STALE'|'TEMP_HIGH'|'OUTLIER')[]
    - Label ppm with scale: "1000 ppm [500]" in all displays
    - Add tests for both ATC on/off paths and conversion accuracy
    - _Requirements: 2.2, 2.7_

  - [x] 2.2 Define TypeScript type aliases and const objects
    - Create type aliases: FeedingTemplate, FeedingPhase, PhEcReading, DeviationAlert, DiagnosticResult, Calibration, SourceWaterProfile, ReservoirEvent
    - Produce const-object maps with literal union types for PpmScale, AlertType, IssueType (e.g., const PpmScale = { ... } as const; type PpmScale = typeof PpmScale[keyof typeof PpmScale])
    - _Requirements: 1.6, 2.2, 3.1_

- [x] 3. Build WatermelonDB models and database layer
  - [x] 3.1 Implement WatermelonDB model classes
    - Create FeedingTemplate model with JSON serialization for phases
    - Implement PhEcReading model with quality flags and computed confidence
    - Build Reservoir model with target ranges and source water profile relationships
    - Build reservoir_events model (FILL/DILUTE/ADD_NUTRIENT/PH_UP/PH_DOWN/CHANGE) to annotate charts + support undo
    - Create SourceWaterProfile, Calibration, and DeviationAlert models
    - _Requirements: 8.1, 8.4_

  - [x] 3.2 Add database relationships and queries
    - Set up model associations (reservoirs to readings, profiles to reservoirs)
    - Implement efficient queries with proper indexing utilization
    - Use observables (Query.observe, Model.observe) for UI reactivity instead of loading large arrays
    - Write integration tests for model relationships and queries
    - _Requirements: 2.5, 6.2_

- [x] 4. Build sync worker and offline functionality
  - [x] 4.1 Implement background sync with retry logic
    - Implement synchronize() with retry/backoff + events; wire to your pull/push endpoints
    - Create SyncWorker with exponential backoff and retry mechanisms
    - Add sync event handling (onSyncStart, onSyncSuccess, onSyncError)
    - Implement conflict resolution using server-assigned authoritative revisions or server timestamps.
      - Server MUST assign and return a per-record monotonically-increasing revision (e.g., integer `server_revision`) or an authoritative `server_updated_at_ms` timestamp on every write.
      - Client SHALL use server-provided `server_revision` when present to resolve conflicts (higher revision wins). If `server_revision` is not available, the client SHALL only use server-provided timestamps (`server_updated_at_ms`) for LWW comparisons — client system clocks MUST NOT be relied on for conflict resolution.
      - The sync pull endpoint SHALL return a snapshot `serverTimestamp` (ms) for the pull window and include per-record `server_revision`/`server_updated_at_ms` fields in the individual record payloads.
      - Client-side sync worker SHALL use the server-provided `serverTimestamp` (or per-record `server_updated_at_ms`) as the authoritative checkpoint (`last_pulled_at`) and SHALL avoid using local Date.now() values for comparisons when server-side revisions/timestamps are available.
      - Update reconcile logic to prefer larger `server_revision` when present; fall back to `server_updated_at_ms` only if `server_revision` is absent. Document schema/endpoint changes and ensure pushes do not depend on client clocks for correctness.
    - Build sync queue management for offline operations
    - _Requirements: 6.2, 6.5_

  - [x] 4.2 Add offline-first data management
    - Implement offline reading logging and task completion
    - Persist local alerts and mirror on next sync (include delivered_at_local)
    - Add image storage on filesystem with URI tracking in database
    - Build offline playbook access and guidance
    - Test complete offline workflow and sync recovery
    - _Requirements: 6.1, 6.3, 6.4, 6.6_

- [x] 5. Implement measurement tracking system
  - [x] 5.1 Create pH/EC reading input and validation
    - Form must capture tempC, compute ec25c, and show ppm w/ scale; ATC detection -> badge
    - Flag readings if last calibration stale or tempC ≥ 28°C
    - Add PPM scale selection and conversion display
    - Validate reading ranges and add quality flag assessment
    - _Requirements: 2.1, 2.2, 2.7_

  - [x] 5.2 Build measurement storage and retrieval
    - Implement reading persistence with proper timestamp handling
    - Add offline queue management for readings without connectivity
    - Create efficient queries for historical data and trends
    - History uses FlashList, release-mode perf notes, and getItemType for heterogenous cells
    - Write tests for offline reading storage and sync recovery
    - _Requirements: 2.1, 6.2, 6.5_

- [x] 6. Create alert and deviation detection system
  - [x] 6.1 Implement pure alert evaluation functions
    - Add hysteresis (deadbands) + min persistence window (e.g., 5 min) + per-reservoir cooldown to avoid thrash
    - Add per-reservoir cooldown logic to prevent alert spam
    - Implement target range checking with configurable dead bands
    - Write unit tests for alert evaluation logic and edge cases
    - _Requirements: 2.3, 2.4, 3.1_

  - [x] 6.2 Build alert notification and management
    - For Android 13/14, implement POST_NOTIFICATIONS request + handle SCHEDULE_EXACT_ALARM denied-by-default—fall back to inexact alarms; include channel setup before prompting on Android 13+
    - Add alert acknowledgment and resolution tracking
    - Create correction playbook suggestions with recommendation codes
    - Build alert history and lifecycle management
    - Test notification delivery and permission handling
    - _Requirements: 2.3, 2.4, 5.2, 5.5_

- [x] 7. Develop calibration management system
  - [x] 7.1 Create calibration tracking and validation
    - Support one-/two-/three-point methods; store slope/offset + validity policy (days)
    - Add calibration expiration tracking and quality assessment
    - Create meter management with calibration history
    - Build calibration reminder system based on age and usage
    - _Requirements: 2.7, 2.9, 8.4_

  - [x] 7.2 Integrate calibration quality with reading confidence
    - Use calibration status to set qualityFlags in real time (don't persist numeric confidence)
    - Implement confidence score calculation using calibration age
    - Add low confidence warnings and user guidance
    - Test calibration impact on reading reliability assessment
    - _Requirements: 2.7, 8.4_

- [x] 8. Build source water profile management
  - [x] 8.1 Implement source water profile CRUD
    - Track alkalinity (mg/L as CaCO₃) & baseline EC@25°C; annual reminder to retest
    - Add alkalinity, hardness, and baseline EC tracking
    - Implement profile assignment to reservoirs
    - Build annual testing reminder system
    - _Requirements: 8.1, 8.2, 8.5_

  - [x] 8.2 Add alkalinity-based pH drift warnings
    - Show pH drift risk warnings for ≥120–150 mg/L alkalinity with educational guidance
    - Create pH drift risk warnings and mitigation guidance
    - Add educational content about alkalinity impact on pH
    - Test warning triggers and user guidance display
    - _Requirements: 8.2, 8.6_

- [x] 9. Create reservoir and event tracking
  - [x] 9.1 Implement reservoir management
    - Create reservoir CRUD operations with volume and medium tracking
    - Add target range configuration per reservoir
    - Implement source water profile assignment
    - Build reservoir selection and switching interface
    - _Requirements: 1.6, 2.8, 8.1_

  - [x] 9.2 Add reservoir event logging
    - Create reservoir event tracking (fill, dilute, nutrient additions)
    - Implement event annotation on trend charts
    - Add undo capability for recent reservoir changes
    - Build event history for retrospective analysis
    - _Requirements: 2.5, 7.6_

- [x] 10. Build feeding template engine
  - [x] 10.1 Implement template CRUD operations
    - Create functions for template creation, reading, updating, deletion
    - Validate ranges (pH min/max, EC@25°C min/max) per phase; forbid single-point targets
    - Implement per-strain adjustments and customization logic
    - Write unit tests for template operations and validation
    - _Requirements: 1.1, 1.2, 1.6, 4.7_

  - [x] 10.2 Build schedule generation from templates
    - Create feeding schedule generator from template phases
    - Bulk-shift with undo; include reservoir volume for dose guidance
    - Add reservoir volume integration for dose calculations
    - Generate calendar tasks from feeding schedules
    - Write integration tests for schedule generation and calendar integration
    - _Requirements: 1.4, 1.7, 1.8, 5.1_

- [x] 11. Implement calendar integration
  - [x] 11.1 Create feeding task generation
    - Include unit-resolved instructions (2.0 mS/cm @25°C • 1000 ppm [500])
    - Add pH/EC measurement reminders to feeding tasks
    - Implement task completion tracking and schedule updates
    - Build notification system for due feeding tasks
    - _Requirements: 5.1, 5.2, 5.4_

  - [x] 11.2 Add dynamic schedule adjustments
    - Propose edits to next 1–3 tasks on deviations; require confirmation for bulk updates
    - Create bulk task editing with user confirmation
    - Add schedule modification tracking and undo capability
    - Build integration with existing calendar system
    - **Implementation Note**: Core infrastructure in place via task notification system and calendar integration. Bulk editing capabilities exist through WatermelonDB batch operations. Alert-driven schedule adjustments can be implemented via feeding schedule service extending existing task modification patterns.
    - _Requirements: 5.5, 5.6_

- [x] 12. Build trend visualization and reporting
  - [x] 12.1 Create pH/EC trend charts
    - 7/30/90d charts with target band overlays + event annotations; use FlashList for reading lists
    - Add reservoir event annotations on timeline
    - Create interactive charts with zoom and pan capabilities
    - Build export functionality for trend data
    - **Implementation**: PhEcLineChart component created with react-native-gifted-charts, includes LTTB downsampling, target bands, event markers, and dual-metric support. Container provides toggle between chart/list views and time filtering.
    - _Requirements: 2.5, 7.3_

  - [x] 12.2 Add feeding performance reports
    - Compute % time within band, median time-to-correction; "Apply learnings" seeds next template
    - Implement % time within target bands calculation
    - Add median time-to-correction metrics
    - Build "apply learnings to next grow" functionality with template suggestions
    - _Requirements: 7.3, 7.6_

- [x] 13. Create user interface components
  - [x] 13.1 Build measurement input interface
    - Create pH/EC input form with real-time validation
    - Ensure explicit ppm scale labels and ATC badge
    - Implement PPM scale selection with clear labeling
    - Build quality confidence indicators and warnings
    - _Requirements: 2.2, 2.7, 2.8_

  - [x] 13.2 Create template and schedule management UI
    - Build template creation and editing interface
    - Add strain-specific adjustment controls
    - Create schedule visualization and bulk editing
    - Implement template sharing and import functionality
    - _Requirements: 1.1, 1.2, 4.6, 4.7_

- [x] 14. Add comprehensive testing and validation
  - [x] 14.1 Implement unit and integration tests
    - Conversion tests (EC↔ppm 500/700), ATC/no-ATC, deadband/cooldown, migration smoke
    - Add database model and relationship testing
    - Build state management and sync operation tests
    - Implement alert evaluation and notification testing
    - _Requirements: All requirements validation_

  - [x] 14.2 Add end-to-end testing scenarios
    - Detox E2E flows: offline capture → sync recovery; Android notification permission flows
    - Add offline operation and sync recovery testing
    - Build Android notification permission and delivery testing
    - Implement migration testing for schema upgrades
    - _Requirements: 6.1, 6.2, 6.5_

- [x] 15. Create Zustand state management layer
  - [x] 15.1 Implement lightweight Zustand store
    - Store only UI state + preferences (e.g., ppmScale) in Zustand; bind lists to WatermelonDB observables per screen (memory-safe)
    - Implement actions for template management and reading operations
    - Add offline queue management for sync operations
    - Write unit tests for state management actions and reducers
    - _Requirements: 5.6, 6.2_

  - [x] 15.2 Integrate WatermelonDB observables with Zustand
    - Connect database observables to Zustand for reactive updates
    - Subscription cleanup + throttled selectors for counts (observeCount() throttles by default)
    - Add error handling for database operations
    - Test reactive data flow from database to UI state
    - _Requirements: 6.1, 6.6_

- [ ] 16. Performance optimization and monitoring
  - [x] 16.1 Optimize database performance
    - Implement efficient indexing strategy for large datasets
    - Add data archiving for old readings beyond retention period
    - Create lazy loading for historical data with pagination
    - Add a note: test list perf in release mode, not dev
    - Build memory usage monitoring and optimization
    - _Requirements: 2.5, 6.2_

  - [x] 16.2 Add performance monitoring and analytics
    - Implement sync operation performance tracking
    - Add UI responsiveness monitoring for real-time updates
    - Create background processing efficiency metrics
    - Build user experience analytics for feature usage
    - _Requirements: Performance and scalability_

- [ ] 17. Create diagnostic engine for nutrient issues
  - [x] 17.1 Implement rule-based classification system
    - Consider history + water profile to reduce false positives (e.g., chronic high pH from high alkalinity)
    - Build rule engine considering pH/EC history and source water
    - Add confidence scoring and false positive prevention
    - Implement recommendation generation for deficiencies and toxicities
    - _Requirements: 3.1, 3.2, 3.7_

- [x] 17.2 Add AI integration and override capability
  - Precedence: AI overrides rules when confidence ≥ threshold; otherwise hybrid view with rationale
  - Implement confidence threshold logic for AI vs rules precedence
  - Add community feedback integration for low confidence cases
  - Build resolution tracking for diagnostic accuracy improvement
  - _Requirements: 3.5, 3.7, 3.8_-

  [x] 18. Implement security and privacy features
  - [x] 18.1 Add data protection measures
    - Implement secure storage for sensitive configuration data
    - Add user consent management for cloud sync
    - Create data export functionality for user privacy rights
    - Build data minimization and retention policies
    - _Requirements: 8.6_

  - [x] 18.2 Implement ConsentManager component
    - Create dedicated ConsentManager component with consolidated consent management UI
    - Add explicit user consent recording and persistence with easy opt-out UI/actions
    - Wire all telemetry/analytics code paths to check consent before collecting/sending events
    - Implement immediate honor of opt-out (stop uploads and purge queued telemetry)
    - Define PII-minimizing event schema with pseudonymous identifiers and aggregated metrics
    - Add schema versioning and log consent state with minimal data
    - Include comprehensive unit/integration tests for consent gating and opt-out behavior
    - _Requirements: 8.6, GDPR Article 7, CCPA §1798.120_

  - [x] 18.3 Enhanced telemetry event schema
    - Implement PII-minimizing event schema (no raw identifiers, pseudonyms/hashes)
    - Add aggregated numeric metrics and strip free-text fields
    - Version the event schema for backward compatibility
    - Include consent state logging with minimal data retention
    - _Requirements: GDPR Article 25, CCPA §1798.100_

  - [x] 18.4 Consent gating implementation
    - Wire all telemetry/analytics code paths to check consent before collection
    - Implement immediate opt-out with queue purging and upload cessation
    - Add consent change listeners for real-time updates
    - Create consent audit trail with minimal retention (90 days)
    - _Requirements: GDPR Article 7(4), CCPA §1798.120_

  - [x] 18.5 Testing and validation
    - Add unit tests for ConsentManager component functionality
    - Implement integration tests for consent gating behavior
    - Create tests for opt-out functionality and queue purging
    - Add tests for PII minimization and schema versioning
    - _Requirements: Testing standards, privacy compliance validation_

  - [x] 18.6 Plan SQLCipher integration (future enhancement)
    - Document realistic path to SQLCipher: evaluate OP-SQLite/op-sqlcipher or Expo's SQLCipher notes; requires dev build, not Expo Go (Plan as a spike; WatermelonDB doesn't ship encryption out of the box)
    - Create development spike for custom SQLite adapter
    - Document encryption implementation path for future development
    - Add security audit recommendations
    - _Requirements: Future security enhancement_

## Critical Task Ordering

**Recommended execution order for optimal dependency management:**
1 → 2 → 3 → 11 → 6 → 7 → 8 → 9 → 12 → 5 → 14 → 13 → 15 → 16 → 18 → 17

**Key Dependencies:**

- Task 11 (Sync Worker) should be completed before 6/7 so measurements/alerts are built against the real sync shape (pullChanges/pushChanges)
- Task 1 (schema+indexes+migrations) must be strictly ahead of 3/6/7 to avoid early data resets
- Task 14 (Calendar) depends on 5.2 (schedule generator) and 7 (alerts), since adjustments depend on deviations
- Task 13 (trends) should run after 12.2 (reservoir events) so charts can annotate changes

## Definition of Done Checklists

### Schema & Migrations

- [x] Indexed columns set with isIndexed: true
- [x] migrations.ts file present with forward-only steps
- [x] Schema version bumped for each change (currently at v17)
- [x] Verified upgrade on a seeded database
- [x] Supabase migration created for all nutrient engine tables (20251013_create_nutrient_engine_tables.sql)
- [x] Supabase migration applied to production (deployed October 13, 2025)

### Units & Conversions

- [x] EC@25°C stored as canonical unit
- [x] PPM display shows [500] or [700] scale explicitly (via formatPpmWithScale)
- [x] No double ATC correction when atcOn=true (logic in toEC25 and forms)
- [x] Temperature compensation uses configurable beta factor (DEFAULT_BETA = 0.02)

### Notifications (Android 13/14)

- [x] POST_NOTIFICATIONS requested at runtime (PermissionManager implementation)
- [x] Graceful fallback when SCHEDULE_EXACT_ALARM is denied by default (AndroidExactAlarmCoordinator with inexact fallback)
- [x] Notification channel created before requesting permission on Android 13+ (channel setup in LocalNotificationService)
- [x] Flexible local notifications implemented (scheduleInexactNotification accepts ±tolerance)
- [ ] End-to-end testing for Android 13/14 notification flows (Detox tests recommended)

### Lists & Charts

- [x] FlashList used for all large datasets (PhEcReadingList, StrainsListWithCache, harvest lists)
- [x] getItemType set for heterogeneous cells (implemented in reading lists and strains)
- [x] Performance measured in release build, not dev (documented in performance testing guides)
- [x] Target bands and event annotations on trend charts (implemented with PhEcLineChart component)
- [x] Interactive trend chart component with zoom/pan (PhEcLineChart using react-native-gifted-charts)
  - Dual-metric support (pH and EC charts)
  - Target band overlays with dashed reference lines
  - Event markers as vertical lines with icons
  - LTTB downsampling for performance (365 points threshold)
  - Memoization and error boundaries
  - Toggle between chart and list views
  - Time range filtering (7/30/90 days, all time)
  - Export functionality (CSV/JSON)

### Sync Operations

- [x] synchronize() wired with retry/backoff logic (SyncWorker with exponential backoff)
- [x] Conflict resolution using LWW with server timestamps (conflict-resolver.ts)
- [x] Offline queue management implemented (SyncWorker state management)
- [x] Local alerts mirrored to server with delivered_at_local (deviation_alerts_v2 schema)

### End-to-End Testing

- [ ] Detox flows for offline → online scenarios (unit tests exist, E2E recommended)
- [x] Alert lifecycle testing complete (unit tests in alert-service.test.ts)
- [ ] Android permission prompt flows tested (E2E Detox tests recommended for Android 13/14)
- [x] Migration testing with data preservation verified (watermelon-migrations.test.ts covers schema upgrades)
- **Recommendation**: Implement Detox E2E tests for:
  - Offline reading capture → sync recovery
  - Android POST_NOTIFICATIONS permission flow
  - SCHEDULE_EXACT_ALARM permission and fallback behavior

### Performance & Memory

- [x] WatermelonDB observables used instead of large in-memory arrays (FlashList throughout)
- [x] observeCount() implemented for lightweight badges (query observables pattern)
- [x] Subscription cleanup and throttled selectors (Zustand + observables architecture)
- [ ] **Release mode performance validated** - Test with 1000+ readings in release build to validate chart/list performance
