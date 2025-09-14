# Implementation Plan

- [ ] 0. Platform setup and architecture preparation

  - Enable React Native New Architecture in app configuration
  - Install @shopify/flash-list@^2 targeting New Architecture
  - Remove any FlashList v1 code (inverted, size estimates, estimatedItemSize/ListSize/FirstItemOffset)
  - Decide on write path: WatermelonDB outbox → sync only for mutations
  - Configure React Query for read caches only, or implement resumePausedMutations() if persisting RQ mutations
  - _Requirements: Foundation for all subsequent tasks_

- [ ] 1. Set up core data models and database schema

  - Create WatermelonDB models for Harvest and Inventory with proper field types and constraints
  - Implement database schema with indexes for (user_id, updated_at) and plant_id optimization
  - Add DB constraint and enum for stage, plus partial index to exclude soft-deleted rows
  - Add validation rules for weight constraints (dry ≤ wet, non-negative, ≤100,000g)
  - Create TypeScript interfaces matching the database schema
  - Set up RLS policies with both USING and WITH CHECK clauses using auth.uid()
  - Write unit tests for model validation and constraint checking
  - _Requirements: 11.1, 11.3, 11.5_

- [ ] 2. Implement finite state machine for harvest stages

  - Create HarvestStage enum and state transition logic
  - Implement stage validation with allowed transitions (HARVEST → DRYING → CURING → INVENTORY)
  - Add 15-second soft-undo window after any stage change; after 15s require Revert Stage with audit note
  - Store stage_started_at on entry and stage_completed_at on exit using server UTC timestamps
  - Implement "Override & Skip" flow with mandatory reason and audit event logging
  - Create state machine tests covering all valid and invalid transitions
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [ ] 3. Create harvest modal component with form validation

  - Build HarvestModal component with weight input fields (wet, dry, trimmings)
  - Implement metric/imperial unit conversion with strict integer gram storage
  - Add optimistic local write with rollback on failed sync
  - Add form validation with inline error messages for weight constraints
  - Create photo capture integration with multiple variant generation
  - Write component tests for validation rules and user interactions
  - _Requirements: 1.1, 1.2, 1.3, 11.1, 11.2, 11.3_

- [ ] 4. Implement stage tracker component with visual progression

  - Create StageTracker component showing current stage and progress
  - Add timing guidance display with target durations and elapsed time computed from server timestamps
  - Implement undo functionality with 15-second window
  - Create revert stage flow for changes after 15-second window
  - Add "Override & Skip" flow with mandatory reason input
  - Add accessibility labels for screen readers (≥44pt touch targets)
  - Write tests for stage progression, undo/revert flows, and accessibility
  - _Requirements: 2.1, 2.2, 2.3, 9.5, 9.6, 16.1, 16.4_

- [ ] 5. Build atomic inventory creation system

  - Create single transactional endpoint completeCuringAndCreateInventory(final_weight_g, idempotencyKey)
  - Implement endpoint to finalize Curing and create/update Inventory in one transaction
  - Return server_timestamp for client checkpointing and sync coordination
  - Add idempotency key support using UUID for retry safety (following Stripe's model)
  - Implement exponential backoff retry logic for failed operations
  - Write tests for atomic operations, idempotency, and failure recovery
  - _Requirements: 3.1, 3.2, 3.3, 10.1, 10.2, 10.3, 10.4_

- [ ] 6. Implement photo storage and management system
- [ ] 6.  Implement photo storage and management system

- Create PhotoCapture component with camera integration
- Generate original + ~1280px + thumbnail variants with content-addressable storage
- Store only URIs + EXIF metadata in database, files in Expo filesystem
- Strip GPS and sensitive EXIF by default; preserve orientation safely.
- Encrypt photos at rest using OS keystore-backed keys; decrypt only for display/upload.
- Set disk budget: target ≤300MB total; trigger LRU when ≥250MB.
- Run LRU janitor on app start and when storage thresholds are hit
- Janitor respects battery saver and charging state.
- Implement orphan detection for files without corresponding database records
- Create "Free up space" user action for manual cleanup
- Write tests for photo capture, variant generation, and cleanup lifecycle
- _Requirements: 8.1, 8.2, 8.3, 13.1, 13.2, 13.3, 13.4_

- [ ] 7. Create offline-first sync engine

  - Use WatermelonDB synchronize() with pullChanges/pushChanges functions
  - Implement push order: created → updated → deleted for proper sequencing
  - Add Last-Write-Wins conflict resolution using server updated_at timestamps
  - Set conflict_seen=true on conflicts and show "Updated elsewhere" banner
  - Add telemetry tracking for sync duration, queued mutations, and rejection rates
  - Write tests for offline operations, sync conflicts, and queue management
  - _Requirements: 7.1, 7.2, 7.3, 12.1, 12.2, 12.3, 12.4, 12.5_

- [ ] 8. Build weight chart component with performance optimization

  - Create WeightChart component using line chart for weight progression
  - Implement explicit LTTB (Largest-Triangle-Three-Buckets) downsampling for large series
  - Cap chart points for 0-365 day datasets to ensure smooth rendering
  - Create tabular fallback view for chart rendering errors
  - Ensure 60fps performance on mid-tier Android devices with production builds
  - Write performance tests and chart rendering validation
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 15.1, 15.2, 15.3, 15.4_

- [ ] 9. Implement local notification system

  - Schedule local notifications on stage entry for target durations
  - Add gentle reminder notifications when durations exceed recommendations
  - Rehydrate notification schedules on app start from database records
  - Use expo-notifications APIs with no network dependency
  - Create notification management for cancellation and updates
  - Write tests for scheduling, rehydration, and cleanup
  - _Requirements: 5.1, 5.2, 14.1, 14.2, 14.3, 14.4_

- [ ] 10. Create harvest history and list components

  - Build HarvestHistoryList using FlashList v2 defaults only (no size estimates)
  - Use default maintainVisibleContentPosition; for chat-style use startRenderingFromBottom + onStartReached
  - Add getItemType for heterogeneous items; use masonry prop if needed
  - Implement filtering and sorting for harvest records
  - Add empty states for no harvests, charts, and photos
  - Create plant-specific and batch view filtering
  - Write tests for list performance, filtering, and empty states
  - _Requirements: 4.5, 15.4, 16.2_

- [ ] 11. Implement comprehensive error handling

  - Create error classification system (validation, network, business logic, consistency)
  - Add inline validation messages for form inputs
  - Implement toast notifications for transient sync errors
  - Create persistent error banners with "Retry now" and "View details" actions
  - Map server error codes: 413 to chunking photos/splitting payloads in sync outbox
  - Attach audit notes on server rejections (error code + timestamp) for triage
  - Write tests for all error scenarios and recovery flows
  - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5_

- [ ] 12. Add internationalization and accessibility support

  - Route all UI strings through i18n system with EN/DE parity
  - Implement proper accessibility labels for all interactive elements
  - Ensure minimum 44pt touch targets for all buttons and controls
  - Add screen reader support with descriptive labels
  - Create accessible empty states and error messages
  - Write accessibility tests and i18n validation
  - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5_

- [ ] 13. Implement security and privacy controls

  - Set up owner-only RLS policies for tables and Supabase Storage (if used later)
  - Ensure RLS policies include both USING and WITH CHECK clauses with auth.uid()
  - Implement private photo storage with no public reads
  - Add data redaction for sharing flows
  - Create user-initiated deletion with cascade to local and remote
  - Write security tests for RLS enforcement and data isolation
  - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5_

- [ ] 14. Handle edge cases and data consistency

  - Detect overlapping harvests per plant (block or force override + reason)
  - Implement back-dated stage edits with duration recomputation and notification rescheduling
  - Add validation for missing weights (allow wet-only, require dry for finalization)
  - Handle device clock skew with server-authoritative timestamps
  - Create user guidance for unusual data states and resolution paths
  - Write tests for all edge cases and data consistency scenarios
  - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5_

- [ ] 15. Create comprehensive test suite

  - Implement unit tests for all components, services, and utilities
  - Add "flight-mode end-to-end" tests for entire harvest flow including photos + sync
  - Create integration tests for offline workflow and sync operations
  - Add performance tests for charts (365-day datasets) and lists (1000+ items)
  - Implement security tests for RLS and cross-user access prevention
  - Write accessibility tests for screen readers and touch targets
  - _Requirements: All requirements validation through comprehensive testing_

- [ ] 16. Optimize performance and finalize implementation

  - Profile and optimize chart rendering with LTTB downsampling algorithms
  - Tune FlashList v2 performance with proper memoization for New Architecture
  - Implement background cleanup jobs for photo storage
  - Add telemetry collection for sync performance and error rates
  - Create monitoring for notification delivery and rehydration success
  - Conduct final performance testing on mid-tier Android devices with production builds
  - _Requirements: Performance optimization across all components_

- [ ] 17. Integration testing and polish
  - Test complete offline-to-online sync scenarios with conflict resolution
  - Validate atomic inventory creation under various failure conditions
  - Test photo storage cleanup and orphan detection
  - Verify notification scheduling and rehydration across app restarts
  - Conduct accessibility audit with screen readers
  - Perform final security review of RLS policies and data access
  - _Requirements: End-to-end validation of all requirements_
