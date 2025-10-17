# Implementation Plan

- [x] 1. Set up database schema and migrations (use supabase mcp tool)
  - Create database migration for posts table to add moderation columns: deleted_at TIMESTAMPTZ, hidden_at TIMESTAMPTZ, moderation_reason TEXT, and undo_expires_at TIMESTAMPTZ
  - Create database migration for post_comments table with hidden_at and undo_expires_at TIMESTAMPTZ columns
  - Create database migration for post_likes table with UNIQUE(post_id, user_id) constraint
  - Create database migration for reports and moderation_audit tables
  - Create idempotency_keys table for request deduplication:

    ```sql
    CREATE TABLE idempotency_keys (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      idempotency_key TEXT NOT NULL,
      client_tx_id TEXT NOT NULL,
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      endpoint TEXT NOT NULL,
      payload_hash TEXT NOT NULL,
      response_payload JSONB NULL,
      error_details JSONB NULL,
      status TEXT NOT NULL CHECK (status IN ('completed', 'processing', 'failed')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours'),
    -- TTL note: default is 24 hours for completed keys. When a key transitions to
    -- 'completed' set/extend expires_at = now() + INTERVAL '24 hours'. When a key
    -- transitions to 'failed' set/extend expires_at = now() + INTERVAL '7 days'
      UNIQUE(idempotency_key, user_id, endpoint),
      -- Enforce status/response invariant
      CHECK (
        (status = 'completed' AND response_payload IS NOT NULL) OR
        (status IN ('processing', 'failed') AND response_payload IS NULL)
      )
    );

    -- Indexes for performance and cleanup
    -- The UNIQUE constraint on (idempotency_key, user_id, endpoint) provides an index for lookups;
    -- avoid creating a redundant non-unique index which wastes space and write overhead.
    -- Cleanup/index: include both completed and failed so the cleanup job can efficiently
    -- find expired rows regardless of whether they completed or failed.
    CREATE INDEX idx_idempotency_keys_cleanup ON idempotency_keys (expires_at)
      WHERE status IN ('completed', 'failed');
    CREATE INDEX idx_idempotency_keys_user_recent ON idempotency_keys (user_id, created_at DESC);
    ```

  - Add partial indexes that match default reads for performance (run AFTER the posts migration that adds deleted_at/hidden_at/moderation_reason):
    ```sql
    CREATE INDEX IF NOT EXISTS idx_posts_visible ON posts (created_at DESC)
      WHERE deleted_at IS NULL AND hidden_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_comments_post_visible ON post_comments (post_id, created_at)
      WHERE deleted_at IS NULL AND hidden_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_likes_post ON post_likes (post_id);
    ```
  - Create moddatetime triggers for reliable LWW:
    ```sql
    CREATE EXTENSION IF NOT EXISTS moddatetime SCHEMA extensions;
    CREATE TRIGGER tg_posts_updated_at BEFORE UPDATE ON posts
      FOR EACH ROW EXECUTE PROCEDURE extensions.moddatetime(updated_at);
    CREATE TRIGGER tg_comments_updated_at BEFORE UPDATE ON post_comments
      FOR EACH ROW EXECUTE PROCEDURE extensions.moddatetime(updated_at);
    ```
  - Enable realtime replication explicitly: `ALTER PUBLICATION supabase_realtime ADD TABLE posts, post_comments, post_likes;`
  - Create seed data and RLS test users for integration tests
  - _Requirements: 1.5, 1.6, 2.5, 2.6, 4.5, 4.6, 9.1, 9.2, 10.1_

- [x] 2. Implement Row Level Security policies (moved up for safety)
  - Create RLS policies for posts table (public read, owner write/delete)
  - Create RLS policies for post_comments table with same pattern
  - Create RLS policies for post_likes table (users manage own likes only)
  - NOTE: Ensure the migration that adds `deleted_at`, `hidden_at`, and `moderation_reason` to `posts` is applied before creating any RLS policies or indexes that reference those columns. Policies and indexes referencing non-existent columns will fail.
  - Create RLS policies for idempotency_keys table (users can only access their own keys):

    ```sql
    ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;

    -- Users can only see/manage their own idempotency keys
    -- Ensure INSERT/UPDATE are validated against auth.uid() by adding WITH CHECK
    CREATE POLICY "Users can manage own idempotency keys" ON idempotency_keys
      FOR ALL USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);

    -- Service role can manage all keys for cleanup
    -- If present, make this policy permissive for writes by allowing any WITH CHECK (true)
    CREATE POLICY "Service role can manage all idempotency keys" ON idempotency_keys
      FOR ALL USING (auth.role() = 'service_role')
      WITH CHECK (true);
    ```

  - Add moderation policies for admin/moderator roles via JWT claims
  - Document policies inline in migration files for maintainability
  - Test RLS policies with different user roles and scenarios (verify 403 on foreign edits)
  - _Requirements: 10.1, 10.2, 10.3_

- [x] 3. Build core API service layer
  - [x] 3.1 Implement community API service with idempotency
    - Create CommunityAPI class with all CRUD operations
    - All mutating endpoints accept Idempotency-Key + X-Client-Tx-Id headers
    - Implement UPSERT pattern for idempotency key handling. Use an INSERT with an "ON CONFLICT DO UPDATE" no-op
      so the statement always RETURNS a row. Include a computed flag so callers can deterministically tell
      whether the row was just inserted or already existed.

          ```sql
          -- Atomic insert-or-return pattern in transaction
          INSERT INTO idempotency_keys (
            idempotency_key, client_tx_id, user_id, endpoint, payload_hash, response_payload, status, expires_at
          )

          VALUES ($1, $2, $3, $4, $5, NULL, 'processing', now() + INTERVAL '24 hours')
          ON CONFLICT (idempotency_key, user_id, endpoint) DO UPDATE
          -- no-op update: set a column to itself (or set idempotency_key = EXCLUDED.idempotency_key).
          SET payload_hash = idempotency_keys.payload_hash
          RETURNING *, (xmax = 0) AS just_inserted;

          ```

    - Rationale and behavior:
      - Using `DO NOTHING RETURNING` returns no row on conflict which makes it ambiguous whether the
        request created the key; returning the row plus `(xmax = 0) AS just_inserted` makes the outcome
        deterministic (Postgres sets `xmax = 0` for newly inserted rows in the current transaction).
      - After this statement returns, compute the payload hash of the attempted payload and compare it
        against the returned `payload_hash`. If they differ, respond with HTTP 422 (Unprocessable Entity)
        because the same idempotency key was used with a different payload.
      - If the returned row's `status = 'completed'` and the stored `expires_at` is still within the replay
        TTL, return the stored `response_payload` immediately instead of re-running the operation.
      - If the returned row indicates another in-progress operation (`status = 'processing'`), either
        wait/poll for completion (with a short backoff) or return a 409/202 depending on desired client behavior.
    - Implement header validation: reject requests with missing/invalid Idempotency-Key or X-Client-Tx-Id (400 Bad Request)
    - Add exponential backoff retry logic for 5xx errors, linear backoff for 429 rate limits
    - Document retry semantics: clients should retry with same idempotency key for network/server errors
    - _Requirements: 1.5, 1.6, 2.5, 2.6, 9.4, 10.4_

  - [x] 3.2 Implement server-side undo functionality
    - DELETE /posts/:id returns `{ undo_expires_at }` (now() + 15s) - IMPLEMENTED via delete-post Edge Function
    - POST /posts/:id/undo restores only if now() < undo_expires_at (409 if expired) - IMPLEMENTED via undo-delete-post Edge Function
    - Add soft delete logic with proper tombstone handling - COMPLETE
    - Create cleanup job for expired undo operations - Edge Functions handle expiry validation
    - _Requirements: 4.5, 4.6, 4.7_

  - [x] 3.3 Implement idempotency key cleanup and monitoring
    - Create periodic cleanup job (Edge Function with cron trigger) to remove expired idempotency keys. The cleanup must delete rows where the TTL has elapsed for both successful and failed operations:
      ```sql
      -- Remove expired idempotency records for completed or failed operations
      DELETE FROM idempotency_keys
      WHERE expires_at < now() AND status IN ('completed', 'failed');
      ```
    - Schedule cleanup to run every 6 hours to prevent table bloat. Keep the cron schedule and TTL values aligned: completed = 24h, failed = 7d.
    - Add monitoring for idempotency key usage patterns and cleanup effectiveness.
    - Implement rate limiting per user: max 1000 idempotency keys per user per hour.
    - Add alerting when cleanup job fails or idempotency table grows beyond expected size.
    - Document TTL enforcement flow (important):
      - When inserting a new key the default `expires_at` is set to now() + INTERVAL '24 hours'.
      - When a key transitions to `completed`, update/set `expires_at = now() + INTERVAL '24 hours'`.
      - When a key transitions to `failed`, update/set `expires_at = now() + INTERVAL '7 days'` so failed rows are retained for debugging but are still cleanable by the cron job.
      - The cleanup job deletes rows based on `expires_at < now()` AND status IN ('completed','failed').
    - _Requirements: 9.4, 10.4, 10.5_

- [x] 3.4 Create idempotency service implementation
  - Build IdempotencyService class with atomic UPSERT operations:

    ```typescript
    class IdempotencyService {
      async processWithIdempotency<T>(
        key: string,
        clientTxId: string,
        userId: string,
        endpoint: string,
        payload: any,
        operation: () => Promise<T>
      ): Promise<T> {
        const payloadHash = await this.computeHash(payload);

        // Try to insert new idempotency key
        const dbRow = await this.upsertIdempotencyKey({
          idempotency_key: key,
          client_tx_id: clientTxId,
          user_id: userId,
          endpoint,
          payload_hash: payloadHash,
          status: 'processing',
        });

        // Guard: ensure we got a row back from the DB. If not, abort to avoid proceeding blindly.
        if (!dbRow) {
          throw new Error('Failed to create or fetch idempotency key record');
        }

        const wasJustInserted = dbRow.just_inserted === true;

        if (!wasJustInserted) {
          // Validate payload hash matches
          if (dbRow.payload_hash !== payloadHash) {
            throw new ConflictingPayloadError(
              'Payload mismatch for idempotency key'
            );
          }

          // Return cached response if completed
          if (dbRow.status === 'completed') {
            return dbRow.response_payload;
          }

          // Wait and retry if still processing
          if (dbRow.status === 'processing') {
            await this.waitForCompletion(key, userId, endpoint);
            return this.getCachedResponse(key, userId, endpoint);
          }
        }

        try {
          // Execute the operation
          const result = await operation();

          // Store successful result (use snake_case column names expected by DB)
          await this.updateIdempotencyKey(key, userId, endpoint, {
            response_payload: result,
            status: 'completed',
            // Extend TTL on completion to 24 hours from now to preserve replay window
            // (aligns with migration/spec guidance)
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
          });

          return result;
        } catch (error) {
          // Mark as failed for debugging; set `error_details` (snake_case) to match DB column
          await this.updateIdempotencyKey(key, userId, endpoint, {
            status: 'failed',
            error_details: error?.message ?? String(error),
            // Extend TTL on failure to 7 days for post-mortem/debugging before cleanup
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          });
          throw error;
        }
      }
    }
    ```

  - Implement payload hash computation using SHA-256 for deterministic comparison
  - Add proper error handling for database conflicts and timeout scenarios
  - Create middleware for automatic idempotency key validation and processing
  - _Requirements: 9.4, 10.4_

- [x] 4. Implement WatermelonDB schema and models
  - [x] 4.1 Create WatermelonDB schema definitions for community tables
    - Define posts schema with all required columns including undo_expires_at
    - Define post_comments schema with hidden_at and undo_expires_at columns
    - Define post_likes schema for relationship tracking
    - Define outbox schema for offline action queuing
    - Ensure WDB models include hidden_at and undo_expires_at where present in DB
    - Keep counters (like_count, comment_count) as derived UI fields, not stored
    - _Requirements: 6.5, 6.6_

  - [x] 4.2 Create WatermelonDB model classes with relationships
    - Implement Post model with computed like_count and comment_count properties
    - Implement PostComment model with post relationship
    - Implement PostLike model with unique constraints
    - Implement Outbox model for offline queue management
    - Add proper model relationships and lazy loading
    - Add release-build CI step that builds Dev Client and runs WDB init sanity tests
    - _Requirements: 6.5, 6.6, 9.5_

- [x] 5. Implement real-time updates with Supabase
  - [x] 5.1 Create realtime connection manager
    - Implement WebSocket connection with auto-reconnect and exponential backoff
    - Add connection state management and fallback to 30s polling after 3 failures
    - Subscribe narrowly: global feed channel for posts, scoped comments channel per opened post
    - Use filter: `post_id=eq.${id}` for comment subscriptions to reduce chatter
    - Implement proper cleanup and unsubscription on unmount
    - _Requirements: 3.1, 3.2, 3.7_

  - [x] 5.2 Build event deduplication and self-echo detection
    - Handle Supabase Postgres Changes event shape (new, old, table, eventType, commit_timestamp)
    - Implement dedupe gate: drop events where `incoming.updated_at <= local.updated_at`
    - Create self-echo detection using client_tx_id matching to confirm outbox entries
    - Add 30s periodic reconciliation to fix counter drifts
    - Example handler:
      ```typescript
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'posts' },
        (e) => {
          const row = e.new as Post | null;
          if (!row) return;
          const local = cache.get(row.id);
          if (local && new Date(row.updated_at) <= new Date(local.updated_at))
            return; // drop stale
          // Supabase places columns on e.new (the row). Prefer reading client_tx_id from the row
          // rather than the event wrapper. Null-check and confirm the outbox entry when present.
          const clientTxId = (row as any).client_tx_id ?? null;
          if (clientTxId) outbox.confirm(clientTxId);
          cache.upsert(row);
        }
      );
      ```
    - _Requirements: 3.4, 3.5, 3.6, 3.8_

- [ ] 6. Create offline-first outbox system
  - [ ] 6.1 Implement outbox queue manager
    - Create OutboxProcessor class with FIFO queue management
    - Enforce backoff 1→32s, max 5 retries, mark as failed with manual retry UI
    - Add outbox entry status tracking (pending, failed, confirmed)
    - Generate idempotency keys using UUID v4 + timestamp for uniqueness
    - Store idempotency key and client_tx_id with each outbox entry for retry consistency
    - When Realtime event arrives with matching client_tx_id, mark outbox entry confirmed
    - On reconnect, drain outbox before bulk refetch to avoid flicker
    - Implement retry logic that preserves original idempotency key across attempts:
      ```typescript
      class OutboxEntry {
        id: string;
        idempotencyKey: string; // Generated once, never changes
        clientTxId: string; // Generated once, never changes
        operation: 'create_post' | 'like_post' | 'create_comment';
        payload: any;
        status: 'pending' | 'failed' | 'confirmed';
        retryCount: number;
        nextRetryAt: Date;
        createdAt: Date;
      }
      ```
    - _Requirements: 6.6, 6.7, 6.8_

  - [ ] 6.2 Build optimistic UI update system
    - Implement React Query optimistic like/unlike with rollback on failure
    - Example pattern:
      ```typescript
      useMutation({
        mutationFn: likePost,
        onMutate: async (vars) => {
          await qc.cancelQueries({ queryKey: ['posts'] });
          const prev = qc.getQueryData(['posts']);
          qc.setQueryData(['posts'], bumpLikeOptimistic(vars.postId, +1));
          return { prev };
        },
        onError: (_, vars, ctx) => {
          qc.setQueryData(['posts'], ctx?.prev);
          toast.error('Failed to like post');
        },
        onSettled: () => qc.invalidateQueries({ queryKey: ['posts'] }),
      });
      ```
    - Create optimistic comment creation with pending state UI
    - Add conflict resolution using last-write-wins strategy
    - Implement UI indicators for pending, failed, and confirmed states
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 6.2, 6.3_

- [ ] 7. Create community feed UI components
  - [ ] 7.1 Build main feed container component
    - Create CommunityFeed container with infinite scroll using FlashList
    - Provide getItemType for FlashList performance, test in release builds (not dev)
    - Implement feed pagination with proper loading states
    - Add pull-to-refresh functionality
    - Create offline indicator and sync status display
    - Add error boundaries and retry mechanisms
    - _Requirements: 9.1, 6.1_

  - [ ] 7.2 Implement Post component with interactions
    - Create Post component with like button and optimistic updates
    - Add comment count display and navigation to comment thread
    - Implement author profile linking and avatar display
    - Add post content rendering with media support (use thumbnails in lists)
    - Create delete button with 15-second undo functionality for own posts
    - Undo UX: global snackbar with countdown, works cross-device during 15s window
    - _Requirements: 1.1, 1.2, 1.3, 4.1, 4.2, 5.1, 5.2_

  - [ ] 7.3 Build comment system components
    - Create CommentList component with pagination
    - Implement CommentItem with reply threading support
    - Add comment creation form with character limit validation (500 chars)
    - Create optimistic comment posting with retry UI
    - Implement comment deletion with undo for own comments
    - _Requirements: 2.1, 2.2, 2.3, 2.8, 4.1, 4.2_

- [ ] 8. Implement user profiles and navigation
  - [ ] 8.1 Create user profile screen
    - Build UserProfile component with avatar and username display
    - Implement user's recent posts list with pagination (created_at DESC)
    - Apply visibility filter (deleted_at/hidden_at IS NULL) for profile posts
    - Add loading states and error handling for profile data
    - Create restricted profile messaging for private accounts
    - _Requirements: 5.1, 5.2, 5.3, 5.5, 5.6_

  - [ ] 8.2 Add profile navigation and linking
    - Implement navigation from post author to profile screen
    - Add deep linking support for user profiles
    - Create profile caching for offline viewing
    - _Requirements: 5.1, 5.7_

- [ ] 9. Build content moderation system
  - [ ] 9.1 Implement reporting functionality
    - Create report content modal with reason selection
    - Implement report submission with proper validation
    - Add report status tracking and user feedback
    - _Requirements: 7.1, 7.5_

  - [ ] 9.2 Add moderation tools for authorized users
    - Create moderation UI for hiding/unhiding content
    - Implement role checks via JWT claims in RLS (only mod/admin can set hidden_at + moderation_reason)
    - Add moderation audit logging for all actions (every moderation action writes to moderation_audit)
    - Create moderation reason input and tracking
    - _Requirements: 7.2, 7.3, 7.6, 7.7, 10.3_

- [ ] 10. Implement push notifications system
  - [ ] 10.1 Create notification service
    - Implement push notification setup and permission handling
    - Create notification preferences management UI
    - Add notification payload handling and deep linking
    - Implement notification batching and rate limiting (collapse likes, max 1 per post per 5min)
    - Add Android Doze/App Standby note: delivery can be delayed, implement "Missed activity" in-app surface
    - _Requirements: 8.1, 8.2, 8.5, 8.6_

  - [ ] 10.2 Build notification triggers and delivery
    - Deploy database migration for community notification triggers (see `supabase/migrations/20250930000001_add_community_notification_triggers.sql`)
      - Migration creates `notify_post_reply()` and `notify_post_like()` database functions
      - Triggers automatically call Edge Function `send-push-notification` via pg_net
      - Includes anti-spam guards (no self-notifications), collapse keys for like deduplication
      - **Prerequisites**: Requires `posts`, `post_replies`, `post_likes` tables; pg_net extension; Supabase config settings (edge_function_url, service_role_key)
      - **Deployment**: Use `mcp_supabase_apply_migration` with project_id `mgbekkpswaizzthgefbc`
    - Implement notification delivery with retry logic
    - Add notification open tracking for reliability monitoring
    - Create notification history and management
    - _Requirements: 8.3, 8.4, 8.7, 8.8_

- [ ] 11. Implement performance monitoring and health checks
  - [ ] 11.1 Create metrics tracking system
    - Track P50/P95 WS event latency (commit_timestamp → UI update)
    - Monitor WebSocket reconnects/session, outbox depth, dedupe drops/min
    - Track undo usage rate and mutation failure rate (<2%/day)
    - Add alerting when P95 latency >3s or outbox depth >50
    - _Requirements: 9.6, 10.5_

  - [ ] 11.2 Build health monitoring and alerting
    - Create health check endpoints for system status
    - Implement Sentry integration for error tracking and alerts
    - Add performance threshold alerting with lightweight, privacy-safe context
    - Create periodic reconciliation job for counter drift detection
    - _Requirements: 10.6_

- [ ] 12. Write comprehensive tests
  - [ ] 12.1 Create unit tests for core functionality
    - Write tests for API service methods with mock responses
    - Test outbox processor with various failure scenarios
    - Create tests for realtime event handling and deduplication
    - Test optimistic UI updates with rollback scenarios
    - Add comprehensive idempotency tests:
    - Same idempotency key with same payload returns cached result
    - Same idempotency key with different payload returns 422 Unprocessable Entity
      - Missing Idempotency-Key header returns 400 Bad Request
      - Invalid X-Client-Tx-Id format returns 400 Bad Request
      - Expired idempotency key allows new operation
      - Concurrent requests with same key handle race conditions properly
      - Cleanup job removes expired keys without affecting active ones
    - Add test: two devices like same post simultaneously → server UNIQUE constraint prevents double insert, client reconciles count without flicker
    - Test idempotency across network failures and retries
    - _Requirements: All requirements validation_

  - [ ] 12.2 Build integration tests for offline scenarios
    - Test complete offline workflow (like, comment, sync on reconnect)
    - Create multi-device conflict resolution tests
    - Test large dataset performance (1000+ posts)
    - E2E for Delete+Undo across devices within 15s; verify expiry blocks undo
    - Implement flight-mode end-to-end testing with Maestro
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.8, 6.9_

- [ ] 13. Performance optimization and accessibility
  - [ ] 13.1 Optimize list rendering and memory usage
    - Implement FlashList with proper getItemType for performance
    - Add image lazy loading and caching for media content (thumbnails in lists, lazy-load originals)
    - Optimize WatermelonDB queries to avoid N+1 problems
    - Implement proper component memoization and re-render prevention
    - _Requirements: 9.1, 9.5, 9.6_

  - [ ] 13.2 Add accessibility and internationalization
    - Add accessibility labels and proper focus management (44pt tap targets)
    - Implement keyboard navigation for all interactive elements
    - Add screen reader support for dynamic content updates (announce new comments via live region)
    - Create internationalization keys for all user-facing text
    - _Requirements: Accessibility compliance_

- [ ] 14. Final integration and testing
  - Integrate all components into main app navigation
  - Test complete user flows from feed to profile to interactions
  - Perform load testing with realistic data volumes
  - Validate all requirements against implemented functionality
  - Create deployment checklist and rollout plan
  - _Requirements: All requirements final validation_
