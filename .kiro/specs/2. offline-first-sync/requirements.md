# Requirements Document

## Introduction

The Offline-first & Sync feature enables GrowBro users to continue using the app seamlessly without internet connectivity while ensuring data consistency when connectivity is restored. This feature is essential for cannabis growers who may work in areas with poor connectivity (basements, grow rooms, outdoor locations) but still need to log tasks, track progress, and access their cultivation data. The system will use WatermelonDB for local storage and implement a robust sync mechanism with Supabase following WatermelonDB's push/pull protocol to maintain data integrity across devices.

**Offline availability (MVP):** Tasks, Plants, Harvests, Playbooks, Assessments queue (AI Photo Assessments) = full R/W offline. Community feed = read-through cache (~50 items) with outbox for likes/comments.

**Technical Requirements:** Requires Expo development build with WatermelonDB config plugin (JSI adapter) - not compatible with Expo Go. All per-user tables must enable Supabase RLS with Edge Functions using Authorization header for auth context.

## Requirements

### Requirement 1

**User Story:** As a cannabis grower working in areas with poor connectivity, I want to continue using the app offline, so that I can log tasks, view my cultivation data, and track progress without interruption.

#### Acceptance Criteria

1. WHEN the user opens the app in flight mode THEN the app SHALL fully launch with list/agenda rendering ≤ 300ms TTI on mid-tier Android test device
2. WHEN the user performs CRUD operations offline THEN the app SHALL run transactionally off UI thread with no dropped frames while inserting 100+ items
3. WHEN the user navigates between screens offline THEN the app SHALL provide full functionality using local data
4. WHEN the user attempts to access uncached relations THEN the app SHALL show skeletons and "Offline" banner with "Retry when online" CTA
5. WHEN testing offline functionality THEN all core flows SHALL work end-to-end in Airplane Mode

### Requirement 2

**User Story:** As a user with multiple devices, I want my data to sync automatically when I'm online, so that I have consistent information across all my devices.

#### Acceptance Criteria

1. WHEN sync triggers occur (app start, foreground resume, manual, background Task/Fetch) THEN the system SHALL automatically initiate sync process
2. WHEN sync is in progress THEN the app SHALL display "Last sync: hh:mm, N pending" with spinner
3. WHEN sync completes successfully THEN the system SHALL use server timestamp as next lastPulledAt
4. WHEN sync encounters conflicts THEN the system SHALL apply LWW using server updated_at timestamps
5. WHEN sync fails THEN the system SHALL implement exponential backoff (2^n up to 15 min) then surface "Tap to retry"
6. WHEN using background sync THEN the system SHALL respect iOS/Android platform limits and provide manual fallback

### Requirement 3

**User Story:** As a user creating content offline, I want my changes to be preserved and synced when connectivity returns, so that I don't lose any work.

#### Acceptance Criteria

1. WHEN the user creates new records offline THEN the system SHALL generate stable client IDs (UUID/Watermelon 16-char) and queue for sync
2. WHEN the user modifies existing records offline THEN the system SHALL track changes using Outbox pattern
3. WHEN the user deletes records offline THEN the system SHALL mark for deletion and queue the operation
4. WHEN connectivity is restored THEN the system SHALL process queued operations in order: created → updated → deleted
5. WHEN sync completes THEN the system SHALL preserve client IDs with only server updated_at advancement
6. WHEN app restarts THEN the outbox queue SHALL persist and resume operations

### Requirement 4

**User Story:** As a user, I want to see clear indicators of my app's connectivity status and sync state, so that I understand when my data is up-to-date.

#### Acceptance Criteria

1. WHEN connectivity changes THEN the system SHALL display NetInfo-based banner and toasts for transitions
2. WHEN the user has unsynced changes THEN the system SHALL show badge using hasUnsyncedChanges() with detail sheet listing queued ops per table
3. WHEN sync fails THEN the system SHALL display error messages with retry options
4. WHEN data is stale (>24h since last successful pull) THEN the system SHALL indicate staleness with remote configurable threshold
5. WHEN sync is in progress THEN the system SHALL show "Last sync: hh:mm, N pending" with spinner

### Requirement 5

**User Story:** As a user with limited storage, I want the app to manage local data efficiently, so that it doesn't consume excessive device storage.

#### Acceptance Criteria

1. WHEN managing images THEN the system SHALL store originals in documentDirectory and thumbnails in cacheDirectory with LRU cap (400 MB max)
2. WHEN cacheDirectory reaches capacity THEN the system SHALL implement LRU eviction of thumbnails/derived files
3. WHEN removing data THEN the system SHALL never remove documentDirectory originals without user consent
4. WHEN app starts THEN the system SHALL run orphan sweep and use per-plant folder structure
5. WHEN device is charging and on unmetered network THEN background janitor SHALL run cleanup operations

### Requirement 6

**User Story:** As a user experiencing sync conflicts, I want the system to handle them gracefully, so that I don't lose important cultivation data.

#### Acceptance Criteria

1. WHEN server detects changes since lastPulledAt THEN it SHALL return 409 "changed since lastPulledAt"
2. WHEN 409 is received THEN client SHALL automatically pull → reapply push following Watermelon guidance
3. WHEN conflicts occur THEN the system SHALL log conflict summaries via SyncLogger
4. WHEN critical field conflicts occur THEN the system SHALL optionally mark records needs_review=true
5. WHEN conflicts are resolved THEN the system SHALL ensure data consistency using server updated_at timestamps

### Requirement 7

**User Story:** As a user with poor intermittent connectivity, I want the sync process to be resilient and efficient, so that my data stays current when possible.

#### Acceptance Criteria

1. WHEN performing incremental pulls THEN server SHALL filter updated_at > lastPulledAt AND updated_at ≤ server_timestamp with cursor/pagination support AND exclude soft-deleted records (deleted_at IS NULL or status != 'deleted')
2. WHEN push fails mid-batch THEN client SHALL replay from last confirmed item using idempotent operations
3. WHEN bandwidth is limited THEN the system SHALL prioritize tasks due ≤ 24h and assessments queue (AI Photo Assessments) before community cache
4. WHEN multiple sync attempts fail THEN the system SHALL implement exponential backoff with Wi-Fi-only and charging constraints via WorkManager/BGTask
5. WHEN sync finally succeeds THEN the system SHALL process all queued operations maintaining chronological order

### Requirement 8

**User Story:** As a developer, I want comprehensive sync monitoring and debugging capabilities, so that I can troubleshoot sync issues effectively.

#### Acceptance Criteria

1. WHEN sync operations occur THEN the system SHALL use WatermelonDB's SyncLogger for censored per-sync logs (start/finish/deltas/errors)
2. WHEN debugging is needed THEN the system SHALL expose "Sync Diagnostics" screen (dev flag) showing last sync, queue length, error codes, and SyncLogger excerpts
3. WHEN monitoring performance THEN the system SHALL emit metrics: p50/p95 sync duration, failure rate by table, payload sizes
4. WHEN capturing errors THEN the system SHALL log detailed context while redacting PII before sending logs
5. WHEN analyzing sync health THEN the system SHALL provide app metrics: sync duration, last checkpoint age, queued mutations, success rate

## Implementation Notes

### API Hardening (Server)

- **Pull endpoint:** Must use consistent snapshot and return server timestamp that, when reused as lastPulledAt, yields complete delta
- **Push endpoint:** Must be fully transactional and ignore client \_status/\_changed fields
- **Idempotency:** Use Idempotency-Key headers and return previous results on duplicate keys
- **Server contract:** Treats duplicate create as update; missing update as create; deletes by ID are idempotent

### WatermelonDB Sync Protocol

- **Pull request params:** `{ lastPulledAt, schemaVersion, migration }` → response `{ changes: { created: [], updated: [], deleted: [] }, timestamp, cursors: { active_cursor?, tombstone_cursor? } }`
- **Push request:** `{ changes, lastPulledAt }` → transactional apply, error on mid-air conflicts (forces pull-then-push)
- **Conflict policy:** LWW by server updated_at; tombstones via deleted_at; pulls use separate queries: active records filter `updated_at > lastPulledAt AND updated_at ≤ server_timestamp AND deleted_at IS NULL`, tombstones filter `deleted_at > lastPulledAt AND deleted_at ≤ server_timestamp AND deleted_at IS NOT NULL`
- **UI integration:** Use hasUnsyncedChanges() for UI badges

### Background Sync Details

- **Sync triggers:** App start; app foreground; manual; background (subject to platform limits)
- **Platform constraints:** iOS background fetch only while app is backgrounded; min ~15 min intervals; not guaranteed timing
- **Fallback:** Provide manual sync button since background timing isn't guaranteed
  **Preferred approach:** Use `expo-task-manager` to define background tasks and
  `expo-background-task` to schedule opportunistic periodic work (Expo SDK 53+
  integrates with BGTaskScheduler on iOS and WorkManager on Android). Treat
  scheduling intervals as hints and always provide a manual "Sync now" fallback.
- **Android constraints:** Use WorkManager-style constraints (Wi-Fi, charging)

- **Connectivity detection:** Use @react-native-community/netinfo (Expo NetInfo) as source of truth for online/offline and metered networks

- Notes:
- Import NetInfo from `@react-native-community/netinfo` (explicit). Prefer `NetInfoState.isInternetReachable` when available to detect real internet access; if `isInternetReachable` is `undefined`, treat as unknown and fall back to `type !== 'none' && type !== 'unknown'`.
- Use `details?.isConnectionExpensive` to detect metered connections. Availability: Android commonly exposes this reliably; iOS may not on older OS versions — treat `true` as metered when present and use conservative defaults otherwise.
- **Image storage:** Originals in documentDirectory; thumbnails in cacheDirectory with LRU cap
- **Storage caps:** cacheDirectory max size (400 MB); never evict documentDirectory without user consent

### Security & RLS

- **RLS enforcement:** All per-user tables enable Supabase RLS
- **Edge Functions:** Must set auth context from Authorization header (supabaseClient.auth.getUser())
- **Service key:** Never use service key for user-scoped operations

### Expo + WatermelonDB Integration

- **Development build required:** Custom client with WatermelonDB config plugin (JSI adapter)
- **Expo Go compatibility:** Not supported for WatermelonDB
- **Plugin requirement:** Use supported WatermelonDB plugin for SDK 52/53+

### Observability

- **Logging:** Adopt WatermelonDB's SyncLogger for censored per-sync logs
- **App metrics:** Sync duration, last checkpoint age, queued mutations, success rate
- **Privacy:** Redact PII before sending logs
