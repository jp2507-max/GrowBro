# Implementation Plan

- [ ] 1. Set up database schema and migrations

  - Create database migration for posts table with undo_expires_at TIMESTAMPTZ column and client_tx_id UUID column
  - Create database migration for post_comments table with hidden_at and undo_expires_at TIMESTAMPTZ columns and client_tx_id UUID column
  - Create database migration for post_likes table with UNIQUE(post_id, user_id) constraint and client_tx_id UUID column
  - Create database migration for reports and moderation_audit tables
  - Add partial indexes that match default reads for performance:
    ```sql
    CREATE INDEX IF NOT EXISTS idx_posts_visible ON posts (created_at DESC)
      WHERE deleted_at IS NULL AND hidden_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_comments_post_visible ON post_comments (post_id, created_at)
      WHERE deleted_at IS NULL AND hidden_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_likes_post ON post_likes (post_id);
    ```
  - Add client_tx_id indexes for realtime self-echo detection:
    ```sql
    CREATE INDEX IF NOT EXISTS idx_posts_client_tx ON posts (client_tx_id);
    CREATE INDEX IF NOT EXISTS idx_comments_client_tx ON post_comments (client_tx_id);
    CREATE INDEX IF NOT EXISTS idx_likes_client_tx ON post_likes (client_tx_id);
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

- [ ] 2. Implement Row Level Security policies (moved up for safety)

  - Create RLS policies for posts table (public read, owner write/delete)
  - Create RLS policies for post_comments table with same pattern
  - Create RLS policies for post_likes table (users manage own likes only)
  - Add moderation policies for admin/moderator roles via JWT claims
  - Document policies inline in migration files for maintainability
  - Test RLS policies with different user roles and scenarios (verify 403 on foreign edits)
  - _Requirements: 10.1, 10.2, 10.3_

- [ ] 3. Build core API service layer

  - [ ] 3.1 Implement community API service with idempotency

    - Create CommunityAPI class with all CRUD operations
    - All mutating endpoints accept Idempotency-Key + client_tx_id headers
    - Return prior result for duplicate idempotency keys (server-side deduplication)
    - Add client transaction ID support for self-echo detection
    - Implement proper error handling and retry logic
    - Add rate limiting and validation on client side
    - _Requirements: 1.5, 1.6, 2.5, 2.6, 9.4, 10.4_

  - [ ] 3.2 Implement server-side undo functionality
    - DELETE /posts/:id returns `{ undo_expires_at }` (now() + 15s)
    - POST /posts/:id/undo restores only if now() < undo_expires_at (409 if expired)
    - Add soft delete logic with proper tombstone handling
    - Create cleanup job for expired undo operations
    - _Requirements: 4.5, 4.6, 4.7_

- [ ] 4. Implement WatermelonDB schema and models

  - [ ] 4.1 Create WatermelonDB schema definitions for community tables

    - Define posts schema with all required columns including undo_expires_at
    - Define post_comments schema with hidden_at and undo_expires_at columns
    - Define post_likes schema for relationship tracking
    - Define outbox schema for offline action queuing
    - Ensure WDB models include hidden_at and undo_expires_at where present in DB
    - Keep counters (like_count, comment_count) as derived UI fields, not stored
    - _Requirements: 6.5, 6.6_

  - [ ] 4.2 Create WatermelonDB model classes with relationships
    - Implement Post model with computed like_count and comment_count properties
    - Implement PostComment model with post relationship
    - Implement PostLike model with unique constraints
    - Implement Outbox model for offline queue management
    - Add proper model relationships and lazy loading
    - Add release-build CI step that builds Dev Client and runs WDB init sanity tests
    - _Requirements: 6.5, 6.6, 9.5_

- [ ] 5. Implement real-time updates with Supabase

  - [ ] 5.1 Create realtime connection manager

    - Implement WebSocket connection with auto-reconnect and exponential backoff
    - Add connection state management and fallback to 30s polling after 3 failures
    - Subscribe narrowly: global feed channel for posts, scoped comments channel per opened post
    - Use filter: `post_id=eq.${id}` for comment subscriptions to reduce chatter
    - Implement proper cleanup and unsubscription on unmount
    - _Requirements: 3.1, 3.2, 3.7_

  - [ ] 5.2 Build event deduplication and self-echo detection
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
          if ((e as any).client_tx_id) outbox.confirm((e as any).client_tx_id);
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
    - When Realtime event arrives with matching client_tx_id, mark outbox entry confirmed
    - On reconnect, drain outbox before bulk refetch to avoid flicker
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
    - Create server-side notification triggers for likes and comments
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
    - Add test: two devices like same post simultaneously → server UNIQUE constraint prevents double insert, client reconciles count without flicker
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
