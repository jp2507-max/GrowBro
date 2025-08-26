# Implementation Plan

## Protocol Requirements

**WatermelonDB Sync Shapes:**

- pullChanges: `{ lastPulledAt, schemaVersion, migration }` → `{ changes, timestamp }`
- pushChanges: `{ changes, lastPulledAt }` → transactional apply
- Server-authoritative timestamps using `updated_at` for conflict resolution
- RLS enforcement via Authorization header in Edge Functions
- Idempotency-Key support for reliable push operations

**Recommended Execution Order:** 1 → 4 → 2 → 3 → 11 → 8 → 6 → 7 → 5 → 13 → 10 → 12 → 14 → 15 → 9

- [ ] 1. Set up WatermelonDB infrastructure and sync schema

  - Create WatermelonDB database configuration with sync-enabled schema
  - Implement database models with sync metadata fields (created_at, updated_at, deleted_at)
  - Configure Expo development build with WatermelonDB config plugin (JSI required - won't work in Expo Go)
  - Add schema version & migrations wiring (client must pass schemaVersion and enable migrations)
  - Write database initialization and migration utilities
  - Unit test: cold start + migration path
  - _Requirements: 1.1, 1.2, 8.1_

- [ ] 2. Implement core sync manager with WatermelonDB protocol

  - Create SyncManager class implementing WatermelonDB's synchronize() interface
  - Implement pullChanges function with { lastPulledAt, schemaVersion, migration } → { changes, timestamp } contract
  - Implement pushChanges function with { changes, lastPulledAt } → transactional apply contract
  - Add re-entrancy guard (no overlapping synchronize()), cancel token
  - Add sync state management (getSyncStatus, hasUnsyncedChanges, getLastSyncTime)
  - Persist last successful pull timestamp and expose hasUnsyncedChanges() for UI
  - Write unit tests for sync manager core functionality
  - Simulate mid-air change (server newer) in tests → expect push abort
  - _Requirements: 2.1, 2.2, 3.1, 3.4_

- [ ] 3. Create network connectivity manager

  - Implement NetworkManager using @react-native-community/netinfo
  - Add connectivity state detection (isOnline, isInternetReachable, isMetered)
  - Prefer isInternetReachable + type + details over custom "strength" metrics
  - Implement network change event listeners and state management
  - Add network-aware sync policies (block large uploads on metered unless user overrides)
  - Write unit tests for network state transitions and policies
  - _Requirements: 2.1, 4.1, 7.3_

- [ ] 4. Build Supabase Edge Functions for sync endpoints

  - Create pull endpoint: filter updated_at > lastPulledAt; include deleted by deleted_at > lastPulledAt; support pagination/cursor for large deltas; return timestamp
  - Implement push endpoint: single transaction, apply created → updated → deleted; if server changed since lastPulledAt, abort & error → client must pull then re-push
  - Add RLS enforcement using Authorization header for auth context (create Supabase client from request header)
  - Implement Idempotency-Key support for reliable push operations (return previous result on duplicates)
  - Add soft delete handling with deleted_at timestamps
  - Write integration tests for Edge Functions with various sync scenarios
  - _Requirements: 2.3, 2.4, 6.1, 6.2, 6.4_

- [ ] 5. Implement error handling and retry logic

  - Create SyncError classification system with retryable error types
  - Implement exponential backoff with jitter for network failures (default backoff cap ~15 min)
  - Add retry queue with maximum attempt limits and backoff ceilings
  - Classify auth vs network vs server errors; on schema mismatch return specific code to force migration before retry
  - Create error recovery strategies for different error types (network, server, auth, storage)
  - Write comprehensive error handling tests with various failure scenarios
  - _Requirements: 2.5, 7.1, 7.2, 7.4_

- [ ] 6. Create storage manager for local data optimization

  - Implement StorageManager with documentDirectory/cacheDirectory separation
  - Add LRU cache management with configurable size limits (400 MB default) - size caps and LRU for cache only
  - Never delete documentDirectory originals without user action
  - Create orphan file cleanup and content-addressable filename system
  - Implement storage usage monitoring and capacity management
  - Expose storage usage in diagnostics
  - Add periodic cleanup tasks and storage optimization routines
  - Write tests for storage policies and cleanup algorithms
  - _Requirements: 5.1, 5.2, 5.4, 5.5_

- [ ] 7. Build image upload queue system

  - Create separate image upload queue (not part of WatermelonDB sync)
  - Implement image upload with retry logic and progress tracking
  - Add URI backfill system to update DB records with remote image URLs after upload
  - Create image processing pipeline (compress + generate thumbnails before enqueue)
  - Implement upload constraints (throttle on metered networks, Wi-Fi only, charging required for large files)
  - Write tests for image upload queue and backfill operations
  - _Requirements: 3.2, 3.3, 5.1, 7.3_

- [ ] 8. Implement background sync with expo-task-manager + expo-background-fetch

  - Create BackgroundSyncService using `expo-task-manager` and
    `expo-background-fetch` (SDK 53 workflow)
  - Add background task registration and constraint configuration
  - Document that execution is opportunistic (OS-scheduled) and add manual "Sync now" fallback
  - Implement opportunistic background sync with platform limitations handling
  - Log outcomes for QA (ran/didn't run, duration)
  - Add background sync monitoring and execution logging
  - Write tests for background sync behavior and constraint enforcement
  - _Requirements: 2.1, 2.6, 7.4_

- [ ] 9. Create conflict resolution system

  - Keep LWW on server (by updated_at) as default; client only flags needs_review and re-tries after pull
  - Add client-side conflict detection and needs_review flagging
  - Avoid field-level merges in v1 - use server-authoritative resolution
  - Create conflict logging system using WatermelonDB's SyncLogger
  - Implement conflict resolution UI indicators and user review workflows
  - Add conflict resolution testing with multi-device scenarios
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 10. Build sync monitoring and debugging tools

  - Use WatermelonDB's SyncLogger for comprehensive sync logging
  - Create in-app "Sync Diagnostics" screen (hidden behind dev flag)
  - Collect p50/p95 duration, payload sizes, and checkpoint age metrics
  - Implement sync health monitoring with success rate analytics
  - Redact PII from all logging and metrics
  - Create debugging utilities for sync queue inspection and troubleshooting
  - Write monitoring tests and performance benchmarks
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 11. Implement sync UI indicators and user feedback

  - Create connectivity status indicators using NetInfo state
  - Add sync progress indicators with "Last sync: hh:mm, N pending" display from hasUnsyncedChanges()
  - Implement unsynced changes badge using hasUnsyncedChanges()
  - Create sync status toasts and error message displays
  - Add "Data stale" indicator when >24h since last successful pull (remote-configurable)
  - Write UI component tests for sync indicators and user feedback
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 12. Create comprehensive sync testing suite

  - Write end-to-end sync tests with real data scenarios
  - Add airplane-mode E2E and multi-device conflict tests
  - Create offline testing suite (airplane mode, intermittent connectivity)
  - Simulate background task execution in tests
  - Add performance tests for large datasets (10k+ records) including large delta pagination
  - Create memory usage and battery impact testing
  - Write automated CI/CD integration tests for sync functionality
  - _Requirements: 1.5, 2.2, 6.1, 7.5, 8.5_

- [ ] 13. Optimize sync performance and implement incremental strategies

  - Add incremental sync with cursor/pagination support for large datasets (server supports cursor/pagination)
  - Implement data prioritization (tasks due ≤ 24h, diagnosis queue ahead of community cache)
  - Create sync batching and chunking for efficient network usage
  - Add sync resume capability for interrupted operations (client resumable pushes with idempotent batches)
  - Implement sync performance monitoring and optimization
  - Write performance tests and optimization validation
  - _Requirements: 7.1, 7.2, 7.5, 8.3_

- [ ] 14. Integrate sync system with existing app architecture

  - Make WatermelonDB the source of truth for reads; React Query drives from local DB and invalidates after sync
  - Integrate WatermelonDB with existing data models and API layer
  - Add sync triggers to app lifecycle events (start, foreground, manual)
  - Connect network manager with existing connectivity handling
  - Update existing CRUD operations to work with WatermelonDB sync
  - Write integration tests for sync system with existing app features
  - _Requirements: 1.1, 1.3, 2.1, 3.1, 3.4_

- [ ] 15. Implement sync configuration and user preferences
  - Create sync settings UI for user-configurable options
  - Add "Wi-Fi only", "Charging only", "Background sync on/off" preferences
  - Implement data staleness threshold configuration
  - Create sync policy management (auto-sync, manual-only, background constraints)
  - Add Reset local cache (dangerous) guarded by confirmation; show current constraints in UI
  - Add sync reset and troubleshooting options for users
  - Write tests for sync configuration and user preference handling
  - _Requirements: 2.6, 4.4, 7.3, 7.4_
