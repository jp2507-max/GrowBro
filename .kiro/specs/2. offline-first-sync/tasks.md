# Implementation Plan

## Protocol Requirements

**WatermelonDB Sync Shapes (WatermelonDB v0.27.1+):**

- synchronize() contract (adapter expectations):
  - pullChanges: required. Signature: `async function pullChanges({ lastPulledAt, schemaVersion, migration }): Promise<{ changes, timestamp }>`
    - MUST return an object with `changes` (the delta payload) and a server `timestamp` that the client will persist as the new `lastPulledAt` once the pull completes.
  - pushChanges: optional. Signature: `async function pushChanges({ changes, lastPulledAt }): Promise<void | { applied?: boolean }>`
    - If provided, the server SHOULD apply client changes transactionally and may return an acknowledgement. Clients MUST handle push failures by performing a pull and retry cycle.
  - synchronize() now supports an options object passed to the sync adapter with additional optional fields:
    - `conflictResolver?: (localRecord, remoteRecord) => Record` — client-side resolver used for advanced conflict handling (note: default LWW on server remains recommended)
    - `migrationsEnabledAtVersion?: number` — flag used to coordinate client-side migration behavior during sync windows
  - Server-authoritative timestamps using `updated_at` for conflict resolution
  - RLS enforcement via Authorization header in Edge Functions
  - Idempotency-Key support for reliable push operations
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
    - Note: import NetInfo from `@react-native-community/netinfo` (keep this import even in Expo-managed apps where NetInfo is available via the community package). When using the `NetInfoState` object, prefer `isInternetReachable` for reliable internet reachability checks (this value may be undefined on some older platforms/implementations; treat undefined as unknown and fall back to `type !== 'none' && type !== 'unknown'`).
    - Use `details?.isConnectionExpensive` to detect metered connections. Availability notes:
      - Android: `details.isConnectionExpensive` is generally available and reliable for cellular/064 metering detection (exposed by underlying Android APIs / WorkManager constraints).
      - iOS: `details.isConnectionExpensive` is only available in recent OS versions and may be undefined; prefer user-facing Wi-Fi vs Cellular checks and treat `isConnectionExpensive === true` as metered, otherwise use conservative defaults.
  - Implement network change event listeners and state management
  - Add network-aware sync policies (block large uploads on metered unless user overrides)
  - Write unit tests for network state transitions and policies
  - _Requirements: 2.1, 4.1, 7.3_

- [ ] 4. Build Supabase Edge Functions for sync endpoints

  - Create pull endpoint: start a database transaction and capture a single, stable transaction-bound `server_timestamp` at TX start. Use `transaction_timestamp()` (aka `now()` inside the transaction) to capture that value rather than `clock_timestamp()` so all reads within the transaction see the same timestamp. Example (inside your transaction):

    ```sql
    -- inside a transaction
    SELECT transaction_timestamp() AS server_timestamp;
    ```

    Use a stable window when selecting rows so the server does not miss rows that equal `lastPulledAt`. Implement **two separate queries** to avoid double-counting deleted records:

    **Active Records Query:**

    ```sql
    WHERE updated_at > lastPulledAt
      AND updated_at <= server_timestamp
      AND deleted_at IS NULL  -- Exclude soft-deleted records
    ```

    **Tombstones Query (separate pagination):**

    ```sql
    WHERE deleted_at > lastPulledAt
      AND deleted_at <= server_timestamp
      AND deleted_at IS NOT NULL  -- Only soft-deleted records
    ```

    For pagination and stable ordering: order rows by the tuple `(updated_at, id)` and use that same tuple as the cursor. This ensures a deterministic, stable ordering even when multiple rows share the same `updated_at` value. Cursor tokens must include both the last-seen `(updated_at, id)` and the captured `server_timestamp`; tokens are only valid for that captured `server_timestamp` and must not be reused across different transactions/timestamps.

    Pseudocode for a paginated pull (within the same transaction and using the captured `server_timestamp`):

    1. Capture server_timestamp := transaction_timestamp()
    2. **Active Records Query** - SELECT ... FROM table
       WHERE (updated_at > lastPulledAt AND updated_at <= server_timestamp)
       AND deleted_at IS NULL -- Only non-deleted records
       AND ((updated_at, id) > (cursor_updated_at, cursor_id) OR cursor is null)
       ORDER BY updated_at, id
       LIMIT <page_size>;

    3. **Tombstones Query** (separate pagination) - SELECT id, deleted_at FROM table
       WHERE (deleted_at > lastPulledAt AND deleted_at <= server_timestamp)
       AND deleted_at IS NOT NULL -- Only soft-deleted records
       AND ((deleted_at, id) > (tombstone_cursor_deleted_at, tombstone_cursor_id) OR tombstone_cursor is null)
       ORDER BY deleted_at, id
       LIMIT <tombstone_page_size>;

    4. Return both result sets with their respective cursors and the same captured `server_timestamp`. If either query returns fewer rows than its page size, that portion of the pull is complete. The client can set its new `lastPulledAt` to the returned `server_timestamp` only when both active records and tombstones are fully paginated.

    **API Response Format:**

    ```jsonc
    {
      "changes": {
        "created": [...],  // New records from active query
        "updated": [...],  // Modified records from active query
        "deleted": [...]   // Record IDs from tombstones query
      },
      "timestamp": 1704110400000,  // server_timestamp (epoch ms)
      "cursors": {
        "active_cursor": "(1704106740000, uuid-123)",  // null if active pagination complete
        "tombstone_cursor": "(1704106680000, uuid-456)"  // null if tombstone pagination complete
      }
    }
    ```

    Note: the returned `timestamp` (server_timestamp) is a numeric epoch milliseconds value (Unix ms), not an ISO string. For example, 2024-01-01T12:00:00Z => 1704110400000. Clients must parse and persist this numeric value as `lastPulledAt`. Cursor tokens may include the same epoch-ms timestamps so clients can consistently compare and resume pagination.

  **Performance Optimization - Composite Index Requirements:**

  The separate active records and tombstones queries require different composite indexes to avoid full-table scans on large datasets. Without these indexes, queries will perform sequential scans which can cause significant performance degradation and increased database load during large pulls.

  Create a concurrent composite index for each synced table using the following migration pattern:

  ```sql
  -- Migration: add composite index for efficient pagination on (updated_at, id)
  -- This index optimizes the ORDER BY (updated_at, id) clause used in sync pagination
  -- Run this migration during low-traffic periods to minimize impact

  -- For posts table
  CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_updated_at_id
    ON public.posts (updated_at, id)
    WHERE deleted_at IS NULL;  -- Only index non-deleted records for better performance

  -- Tombstones (soft-deleted rows) for posts
  -- Keep the partial predicate aligned with tombstone scans (deleted_at IS NOT NULL)
  CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_deleted_at_id_tombstones
    ON public.posts (deleted_at, id)
    WHERE deleted_at IS NOT NULL;

  -- For post_comments table
  CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_post_comments_updated_at_id
    ON public.post_comments (updated_at, id)
    WHERE deleted_at IS NULL;  -- Only index non-deleted records for better performance

  -- Tombstones (soft-deleted rows) for post_comments
  -- Keep the partial predicate aligned with tombstone scans (deleted_at IS NOT NULL)
  CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_post_comments_deleted_at_id_tombstones
    ON public.post_comments (deleted_at, id)
    WHERE deleted_at IS NOT NULL;

  -- For other synced tables, follow the same pattern:
  -- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_<table>_updated_at_id_active
  -- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_<table>_deleted_at_id_tombstones
  --   ON <schema>.<table> (deleted_at, id)
  --   WHERE <soft_delete_condition>;
  ```

  **Migration Deployment Notes:**

  - Use `CONCURRENTLY` to avoid blocking writes during index creation (requires PostgreSQL 8.2+)
  - IMPORTANT: `CREATE INDEX CONCURRENTLY` cannot run inside a transaction. Ensure your migration runner does not wrap these statements in a transaction. Run them outside transactional migration tooling or use your framework's flag to disable transaction wrapping (e.g., Rails `disable_ddl_transaction!`).
  - Include `IF NOT EXISTS` for idempotent deployments
  - Add `WHERE deleted_at IS NULL` clause to index only active records, reducing index size and improving query performance
  - Keep partial predicates exactly aligned with your query predicates so the planner can use the indexes:
    - Updated-rows scans use `deleted_at IS NULL` (matches `idx_*_updated_at_id`)
  - Tombstone scans use `deleted_at IS NOT NULL` (matches `idx_*_deleted_at_id_tombstones`)
  - Specify the full `schema.table` name for clarity and to avoid search_path issues
  - Test index creation in staging using the same non-transactional mode before production deployment
  - Monitor query performance before/after index creation using `EXPLAIN ANALYZE`
  - Include rollback plan:
    - `DROP INDEX CONCURRENTLY IF EXISTS idx_<table>_updated_at_id;`
  - `DROP INDEX CONCURRENTLY IF EXISTS idx_<table>_deleted_at_id_tombstones;`

  **Index Maintenance:**

  - Monitor index usage with `SELECT * FROM pg_stat_user_indexes WHERE schemaname = 'public';`
  - Rebuild index if bloat becomes an issue: `REINDEX CONCURRENTLY idx_<table>_updated_at_id;`
  - Consider index storage parameters for large tables: `WITH (fillfactor = 90)`

  - Implement push endpoint: single transaction, apply created → updated → deleted; if server changed since lastPulledAt, abort & error → client must pull then re-push
  - Add RLS enforcement using Authorization header for auth context (create Supabase client from request header)
  - Implement Idempotency-Key support for reliable push operations (return previous result on duplicates). Add the following server-side implementation details to guarantee correctness and atomicity:

    - Persistent table: create a dedicated table to persist idempotency records. Example Postgres schema:

      ```sql
      CREATE TABLE IF NOT EXISTS sync_idempotency (
        id BIGSERIAL PRIMARY KEY,
        user_id uuid NOT NULL,
        idempotency_key text NOT NULL,
        response_payload jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE UNIQUE INDEX IF NOT EXISTS sync_idempotency_user_key_idx
        ON sync_idempotency (user_id, idempotency_key);

      -- SECURITY: enable Row-Level Security (RLS) so idempotency records are
      -- only visible / mutable by the owning user or by a trusted DB role.
      -- Replace '<app_db_role>' with the name of your application DB role (for
      -- example a role that your Edge Functions or trusted services switch to).
      -- The policy below allows actions when the authenticated jwt user matches
      -- the row's user_id OR when the request context indicates a trusted role.

      -- Enable RLS on the table
      ALTER TABLE public.sync_idempotency ENABLE ROW LEVEL SECURITY;
      ```

    -- Allow SELECT only for the owning user or trusted roles

    ````sql
    /*
    NOTE: PostgreSQL does NOT support `CREATE POLICY IF NOT EXISTS`.
    Using `CREATE POLICY IF NOT EXISTS` in migrations will fail.
    Recommended pattern for idempotent migrations is to first
    DROP POLICY IF EXISTS <policy_name> ON <schema>.<table>;
    then CREATE POLICY <policy_name> ...;
    Example replacement shown later in this document.
    */
    DROP POLICY IF EXISTS sync_idempotency_select_policy ON public.sync_idempotency;
    CREATE POLICY sync_idempotency_select_policy
    ON public.sync_idempotency
    FOR SELECT
    USING (
    (auth.uid() IS NOT NULL AND auth.uid()::uuid = user_id)
    OR current_setting('jwt.claims.role', true) = 'service_role'
    OR current_user = '<app_db_role>'
    );

    -- Allow INSERT only when the incoming user_id matches auth.uid() or
    -- when performed by a trusted DB role. Use WITH CHECK to validate data on
    -- insertion.
    DROP POLICY IF EXISTS sync_idempotency_insert_policy ON public.sync_idempotency;
    CREATE POLICY sync_idempotency_insert_policy
    ON public.sync_idempotency
    FOR INSERT
    WITH CHECK (
    (auth.uid() IS NOT NULL AND auth.uid()::uuid = user_id)
    OR current_setting('jwt.claims.role', true) = 'service_role'
    OR current_user = '<app_db_role>'
    );

    -- Allow UPDATE only for owners or trusted roles. WITH CHECK ensures the
    -- new row (after UPDATE) still satisfies policy (e.g., user_id not
    -- changed to another user).
    DROP POLICY IF EXISTS sync_idempotency_update_policy ON public.sync_idempotency;
    CREATE POLICY sync_idempotency_update_policy
    ON public.sync_idempotency
    FOR UPDATE
    USING (
    (auth.uid() IS NOT NULL AND auth.uid()::uuid = user_id)
    OR current_setting('jwt.claims.role', true) = 'service_role'
    OR current_user = '<app_db_role>'
    )
    WITH CHECK (
    (auth.uid() IS NOT NULL AND auth.uid()::uuid = user_id)
    OR current_setting('jwt.claims.role', true) = 'service_role'
    OR current_user = '<app_db_role>'
    );

    -- Allow DELETE only for owners or trusted roles
    DROP POLICY IF EXISTS sync_idempotency_delete_policy ON public.sync_idempotency;
    CREATE POLICY sync_idempotency_delete_policy
    ON public.sync_idempotency
    FOR DELETE
    USING (
    (auth.uid() IS NOT NULL AND auth.uid()::uuid = user_id)
    OR current_setting('jwt.claims.role', true) = 'service_role'
    OR current_user = '<app_db_role>'
    );

    -- GRANTs: ensure your application service role has the minimal privileges
    -- needed. Replace '<app_db_role>' with the role your Edge Functions
    -- switch to (or that you use in server-side connections).
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.sync_idempotency TO "<app_db_role>";
    -- If using the sequence directly, grant USAGE on the sequence too
    GRANT USAGE ON SEQUENCE public.sync_idempotency_id_seq TO "<app_db_role>";

    -- NOTE: Supabase-hosted Postgres exposes helper functions like auth.uid()
    -- and stores JWT claims in current_setting('jwt.claims.\*', true). The
    -- example above relies on those helpers. If you're not on Supabase, use
    -- the equivalent mechanism your auth layer provides or validate in your
    -- Edge Function before calling DB operations.

    -- RETENTION / TTL: idempotency records are useful for preventing
    -- duplicate application of requests but can grow unbounded. Two common
    -- approaches to retention:
    -- 1) Scheduled DB job (pg_cron) that deletes old rows periodically
    -- 2) An external scheduler (serverless cron or Supabase scheduled
    -- function) that runs a DELETE statement on a cadence

    -- Example: pg_cron (run daily at 03:00) to remove records older than
    -- 90 days. Requires the pg_cron extension and appropriate privileges.
    -- Adjust the interval to your needs (e.g., 7, 30, 90 days).
    -- NOTE: installing extensions and pg_cron scheduling may require a
    -- superuser or managed platform support (Supabase offers scheduled
    -- functions as an alternative).

    -- Create extension (may require superuser; hosted providers vary)
    CREATE EXTENSION IF NOT EXISTS pg_cron;

    -- Schedule a daily job at 03:00 to delete old idempotency rows
    SELECT cron.schedule(
    'daily_cleanup_sync_idempotency',
    '0 3 \* \* \*',
    $$DELETE FROM public.sync_idempotency WHERE updated_at < now() - interval '90 days'$$
    );

    -- Alternative (recommended for hosted DBs without pg_cron): create a
    -- small server-side scheduled job (for example an Edge Function or a
    -- managed "scheduled function" in Supabase) that runs the same DELETE
    -- statement on a configurable cadence. Example SQL to run from that job:

    -- DELETE FROM public.sync_idempotency
    -- WHERE updated_at < now() - interval '90 days';

    -- Considerations:
    -- - Pick an appropriate retention window; 30-90 days is common.
    -- - Make sure response_payload size is bounded. If you store large
    -- payloads, consider keeping only a pointer to a storage object and
    -- GCing both the DB row and the storage object together.
    -- - Use the trusted DB role (e.g., '<app_db_role>') or a maintenance
    -- service account to run the cleanup if RLS would otherwise block it.

    - Push endpoint flow (transactional, server-side): perform the insert-and-apply-or-return flow inside the same DB transaction that applies the client's mutations to guarantee atomicity. Example high-level algorithm:

    1. Begin transaction
    2. Attempt to insert a new row for (user_id, idempotency_key) with NULL response_payload (or a placeholder). Use a plain INSERT that will fail on unique constraint if a record already exists.

       - If the INSERT succeeds (no conflict): proceed to apply the client's create/update/delete mutations within the same transaction. After applying mutations and computing the server response (changes, timestamp, etc.), UPDATE the inserted `sync_idempotency` row to set `response_payload` to the JSON result, and commit the transaction. Return the computed response to the client.

       - If the INSERT fails due to unique constraint (conflict): SELECT the existing `response_payload` for (user_id, idempotency_key) and return it immediately (optionally after validating user ownership). Rollback/commit as appropriate (no further mutations should be applied).

    3. Ensure the insert-then-apply-then-update or select-on-conflict code path is executed within the same DB transaction so that concurrent retries from the client never re-apply mutations and always receive the first successful response.

    - Implementation notes and SQL patterns:

    - A safe pattern uses an initial INSERT ... ON CONFLICT DO NOTHING RETURNING id to detect whether the insert happened, then a conditional SELECT when no rows were returned. Pseudocode:

      ```sql
      -- inside TX
      INSERT INTO sync_idempotency (user_id, idempotency_key)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
      RETURNING id;

      -- if insert returned id: apply mutations, compute response, then
      UPDATE sync_idempotency
      SET response_payload = $response::jsonb, updated_at = now()
      WHERE id = $inserted_id;

      -- if insert returned no rows: the key already exists - fetch stored response
      SELECT response_payload FROM sync_idempotency
      WHERE user_id = $1 AND idempotency_key = $2;
    ````

    -- NOTE: Optional stricter variant
    /\*
    To guarantee deduplication only for identical requests, include a
    request_hash on insert and, when the key already exists, lock the
    row with FOR UPDATE and compare the stored request_hash to the
    incoming one. If they differ, return 409 (conflict) rather than
    reusing the stored response. This avoids silently returning a
    previous response for a different payload.

  Caveats:

  - Use FOR UPDATE to prevent concurrent races where two different
    payloads try to claim the same idempotency key.
  - Choose an error handling strategy (409 vs explicit error code)
    that your client understands and will retry appropriately.
    \*/

  - Alternatively, use INSERT ... ON CONFLICT (user_id, idempotency_key) DO UPDATE SET response_payload = EXCLUDED.response_payload RETURNING response_payload when you can atomically write the final payload in one statement, but note you still need to coordinate applying mutations in the same transaction so that the stored payload reflects the applied changes.

  - Always validate that the `user_id` in the idempotency record matches the authenticated user (RLS or explicit checks) to avoid cross-user key reuse.

  - Keep `response_payload` small and bounded; if responses are large, consider storing a pointer to a storage object (e.g., storage bucket path) instead of inlining large blobs in the row.

  - Tests: add integration tests exercising concurrent retries, conflict paths (insert conflict -> return stored payload), and verifying that mutations are applied exactly once for a given idempotency key.

  - Add soft delete handling with deleted_at timestamps
  - Write integration tests for Edge Functions with various sync scenarios
  - _Requirements: 2.3, 2.4, 6.1, 6.2, 6.4_

  - [ ] 4a. Create set_updated_at() trigger for each synced table

    Rationale: server-authoritative updated_at values are critical for correct Last-Write-Wins conflict resolution and for robust pull windows (rows selected with `updated_at > lastPulledAt AND updated_at <= server_timestamp`). A small, idempotent PL/pgSQL helper and per-table trigger ensures timestamps are set/maintained consistently regardless of client inputs or partial updates.

    Requirements satisfied: ensure server timestamp monotonicity, avoid drift in pull windows, make trigger deployment idempotent and testable.

    Example PL/pgSQL function (idempotent):

    ```sql
    -- Create or replace the helper function that sets updated_at on INSERT/UPDATE
    CREATE OR REPLACE FUNCTION public.set_updated_at()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      IF TG_OP = 'INSERT' THEN
        -- Server always sets updated_at on INSERT to ensure server-authoritative timestamps
        NEW.updated_at := now();
        RETURN NEW;
      ELSIF TG_OP = 'UPDATE' THEN
        -- Always update the timestamp on UPDATE so server is authoritative
        NEW.updated_at := now();
        RETURN NEW;
      END IF;
      RETURN NEW;
    END;
    $$;
    ```

    Example trigger creation (idempotent pattern, run for each synced table):

    ```sql
    -- Replace <schema> and <table> with your target schema/table name, e.g. public.posts
    DO $$
    DECLARE
      table_name text := 'posts';
      schema_name text := 'public';
    BEGIN
      -- Drop existing trigger if present (safe/idempotent)
      EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated_at ON %I.%I;', table_name, schema_name, table_name);

      -- Create the trigger using positional %I placeholders. Arguments: (table_name, schema_name)
      EXECUTE format(
        'CREATE TRIGGER trg_%1$I_updated_at
           BEFORE INSERT OR UPDATE ON %2$I.%1$I
           FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();',
        table_name, schema_name
      );
    END;
    $$;
    ```

    Notes on idempotency and deployment:

    - `CREATE OR REPLACE FUNCTION` makes the function deployment idempotent.
    - `DROP TRIGGER IF EXISTS` (or the DO block pattern above) ensures the trigger can be re-created safely.
    - Run the function + trigger creation as part of your schema migration pipeline or a one-off deployment script for each synced table.

    Example test cases (plain SQL - fails with RAISE EXCEPTION on assertion failure):

    ```sql
    -- Example test script for public.sync_test_items
    -- 0) Enable pgcrypto extension for gen_random_uuid() function
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    -- 1) Create a test table (idempotent)
    CREATE TABLE IF NOT EXISTS public.sync_test_items (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      data text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz
    );

    -- 2) Ensure function & trigger exist for this table (use the same idempotent pattern above)
    -- (Assume set_updated_at() created already via migration)
    DROP TRIGGER IF EXISTS trg_sync_test_items_updated_at ON public.sync_test_items;
    CREATE TRIGGER trg_sync_test_items_updated_at
      BEFORE INSERT OR UPDATE ON public.sync_test_items
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

    -- 3) Tests: INSERT sets updated_at within reasonable bounds; UPDATE advances updated_at
    DO $$
    DECLARE
      t_before timestamptz := now();
      insert_row record;
      after_insert timestamptz;
      after_update timestamptz;
    BEGIN
      -- Insert a row (client does not set updated_at)
      INSERT INTO public.sync_test_items (data) VALUES ('first') RETURNING id, updated_at INTO insert_row;
      after_insert := now();

      -- Assert updated_at within bounds [t_before, after_insert]
      IF NOT (insert_row.updated_at >= t_before AND insert_row.updated_at <= after_insert) THEN
        RAISE EXCEPTION 'INSERT: updated_at out of expected bounds: % not in [% , %]', insert_row.updated_at, t_before, after_insert;
      END IF;

      -- Short sleep to ensure timestamp delta on update (optional)
      PERFORM pg_sleep(0.01);

      -- Update the row and verify updated_at increased
      UPDATE public.sync_test_items SET data = 'second' WHERE id = insert_row.id RETURNING updated_at INTO insert_row;
      after_update := now();

      IF NOT (insert_row.updated_at >= after_insert) THEN
        RAISE EXCEPTION 'UPDATE: updated_at did not advance: % < %', insert_row.updated_at, after_insert;
      END IF;
    END;
    $$;

    -- 4) Pull-window behavior test: ensure rows fall into/out of the pull window defined as
    --    updated_at > lastPulledAt AND updated_at <= server_timestamp
    DO $$
    DECLARE
      lastPulledAt timestamptz;
      server_ts timestamptz;
      included_count int;
      excluded_count int;
      r record;
    BEGIN
      -- Make a fresh row and capture a deterministic window
      lastPulledAt := now() - interval '1 minute';
      server_ts := now();
      INSERT INTO public.sync_test_items (data) VALUES ('window-test') RETURNING id, updated_at INTO r;

      -- Row should be included when lastPulledAt is before updated_at and server_ts after it
      SELECT count(*) INTO included_count FROM public.sync_test_items
        WHERE updated_at > lastPulledAt AND updated_at <= server_ts AND id = r.id;
      IF included_count <> 1 THEN
        RAISE EXCEPTION 'PULL-WINDOW: expected row to be included (count=%)', included_count;
      END IF;

      -- Now set lastPulledAt after the row's updated_at and expect it to be excluded
      -- Use the previously captured server_ts so the window upper-bound is deterministic
      lastPulledAt := server_ts + interval '1 second';
      SELECT count(*) INTO excluded_count FROM public.sync_test_items
        WHERE updated_at > lastPulledAt AND updated_at <= server_ts AND id = r.id;
      IF excluded_count <> 0 THEN
        RAISE EXCEPTION 'PULL-WINDOW: expected row to be excluded when lastPulledAt > updated_at (count=%)', excluded_count;
      END IF;
    END;
    $$;
    ```

    Expected behavior:

    - On INSERT: the trigger always sets `updated_at := now()` (server-authoritative).
    - On UPDATE: the trigger always sets `updated_at := now()` (server-authoritative).
    - Pull window selection using `updated_at > lastPulledAt AND updated_at <= server_timestamp` reliably includes rows modified in the window and excludes rows outside it.

    Testing guidance:

    - Run the SQL test blocks against a disposable test database or inside CI job with a clean schema.
    - The DO-blocks raise exceptions on assertion failures so CI will fail on regressions.
    - Integrate the function/trigger creation into your regular migrations (use `CREATE OR REPLACE FUNCTION` + `DROP TRIGGER IF EXISTS`/`CREATE TRIGGER`) to make deployments idempotent.

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

- [ ] 8. Implement background sync with expo-background-task + expo-task-manager

  - Create BackgroundSyncService using `expo-background-task` to schedule opportunistic periodic work and use `expo-task-manager` (TaskManager.defineTask / TaskManager.registerTask) to define the task handlers. Expo SDK 53+ maps scheduling to platform-native schedulers: BGTaskScheduler on iOS and WorkManager on Android.
  - Replace prior references to `expo-background-fetch` with guidance to use the combination of `expo-background-task` (scheduling) and `expo-task-manager` (task handlers). On iOS, scheduled work is subject to BGTaskScheduler policies and system budget; on Android, WorkManager underpins scheduling but the Expo JS API exposes limited configuration.
  - Add background task registration and scheduling. On Android, `expo-background-task`'s JS API only exposes `minimumInterval`; additional WorkManager constraints like `requiresCharging`, `networkType`, or `isDeviceIdle` are not available from JS. If stricter constraints are required, consider a platform-specific native WorkManager implementation or a custom config plugin. Scheduling intervals are hints only — the OS decides actual runtime. Provide a user-invokable "Sync now" manual fallback for immediate sync.
  - Document that execution is opportunistic (OS-scheduled) and add manual "Sync now" fallback for immediate sync when users invoke it in-app.
  - Implement opportunistic background sync with platform limitations handling and graceful no-op when the OS defers execution.
  - Log outcomes for QA (ran/didn't run, duration, reason for deferral) and expose those diagnostics in a developer-only screen.
  - Add background sync monitoring and execution logging
  - Write tests for background sync behavior and constraint enforcement (mock BGTaskScheduler/WorkManager behaviors where possible)
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
  - Implement data prioritization (tasks due ≤ 24h, assessment queue ahead of community cache)
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
