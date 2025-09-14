# Requirements Document

## Introduction

The Community Feed Improvements feature enhances the existing community functionality in GrowBro by adding interactive engagement capabilities, real-time updates, and basic moderation tools. This feature allows growers to connect, share experiences, and engage with each other's content through likes, comments, and profile interactions while maintaining a safe and moderated environment.

## Requirements

### Requirement 1

**User Story:** As a grower, I want to like and unlike posts in the community feed, so that I can show appreciation for content without having to write a comment.

#### Acceptance Criteria

1. WHEN a user taps the like button on a post THEN the system SHALL toggle the like status immediately with optimistic UI updates
2. WHEN a like action fails due to network issues THEN the system SHALL revert the UI state and show an error message
3. WHEN a user views a post THEN the system SHALL display the current like count and whether the user has liked the post
4. WHEN multiple users like the same post THEN the system SHALL update the like count in real-time for all viewers
5. WHEN the client sends a like/unlike request THEN the request SHALL include an Idempotency-Key header. The client SHALL generate the Idempotency-Key as a UUIDv4 created per user-action (per tap). The server SHALL persist received Idempotency-Keys and deduplicate requests by Idempotency-Key for a configurable window (default: 24 hours). On duplicate requests within the dedupe window the server SHALL return the prior result (no-op) with the same status and body as the original operation.
6. WHEN a like record is identified THEN the server SHALL compute the canonical like_id itself and MUST NOT trust client-supplied like_id values. The canonical like_id algorithm is: compute SHA-256 and return the lowercase hex string of the bytes for the canonical string formed by concatenating the canonical post_id, the literal ":", and the canonical user_id (i.e., SHA256_HEX(canonical_post_id + ":" + canonical_user_id)). Canonicalization/normalization rules: trim leading/trailing whitespace from both IDs, preserve case for post_id, and use the server canonical user_id (auth.uid()) — if user IDs are case-insensitive in the system, they MUST be normalized to lowercase before hashing. If a client provides a like_id that does not match the server computed canonical like_id the server SHALL ignore the client-provided like_id and proceed using the server-computed value; the server MAY log or emit a telemetry event for mismatches.
7. WHEN writing likes to storage THEN the system SHALL enforce UNIQUE (post_id, user_id) at the database level. The server SHALL perform writes using atomic UPSERT semantics (for example, PostgreSQL INSERT ... ON CONFLICT (post_id, user_id) DO UPDATE ... or MERGE semantics where supported) inside a transaction to avoid race conditions. Implementations MUST ensure operations are atomic and idempotent when combined with Idempotency-Key deduplication.
8. WHEN true write conflicts occur (for example, simultaneous opposing operations that cannot be resolved by deduplication/upsert) THEN the server SHALL return HTTP 409 Conflict and include the canonical server state for the like (including post_id, user_id, like_id, exists boolean, and updated_at) in the response body. The server SHALL also reconcile to the canonical state internally (i.e., the DB must reflect the canonical result) before returning the 409.
9. WHEN the client receives a 409 or a server state that differs from the optimistic UI THEN the client SHALL reconcile the UI to the server-provided canonical state within ≤300ms and display a non-blocking toast indicating the action was reconciled to server state (do not block user interaction). The toast message SHALL be dismissible and must not prevent further interactions.
10. WHEN a user attempts multiple like toggles THEN the system SHALL allow only one pending like toggle per (post_id, user_id) at a time; additional taps while a pending mutation exists SHALL be ignored or queued client-side but deduplicated before network send. The client MAY use a client_tx_id for echo matching, but server confirmation must be based on Idempotency-Key and server-computed like_id.
11. WHEN storing likes in the client Outbox for offline support THEN entries SHALL contain {client_tx_id, idempotency_key, op, payload} where client_tx_id is a local UUID for optimistic matching, idempotency_key is the UUIDv4 noted above, and payload does not rely on client-supplied like_id (server will compute canonical like_id). Clients SHALL use UPSERT semantics when reconciling with server responses and prefer server-provided like_id and timestamps.

### Requirement 2

**User Story:** As a grower, I want to comment on posts in the community feed, so that I can engage in discussions and provide feedback to other growers.

#### Acceptance Criteria

1. WHEN a user submits a comment THEN the system SHALL display it immediately with optimistic UI updates
2. WHEN a comment submission fails THEN the system SHALL show the comment as pending retry and attempt to resubmit
3. WHEN new comments are added by other users THEN the system SHALL display them within 1-3 seconds using real-time updates
4. WHEN a user views a post THEN the system SHALL display all comments in chronological order with author information
5. WHEN creating a new comment THEN the system SHALL assign a temporary local ID and client_tx_id with UI showing pending status
6. WHEN comment submission fails THEN the system SHALL enter the comment into an Outbox with exponential backoff and show "Tap to retry / cancel" UI
7. WHEN comment submission succeeds THEN the server ID SHALL replace the temp ID and UI SHALL deduplicate by client_tx_id
8. WHEN comments exceed 500 characters THEN the system SHALL prevent submission and show character count warning

### Requirement 3

**User Story:** As a grower, I want to see real-time updates for likes and comments, so that I can engage in active conversations without manually refreshing.

#### Acceptance Criteria

1. WHEN a post receives a new like or comment THEN the system SHALL update the counters and content within 1-3 seconds for all viewers
2. WHEN the real-time connection is lost THEN the system SHALL attempt to reconnect automatically
3. WHEN real-time updates fail THEN the system SHALL fall back to periodic polling every 30 seconds
4. WHEN duplicate events are received THEN the system SHALL deduplicate them to prevent UI inconsistencies
5. WHEN real-time events are received THEN the system SHALL include (table, id, op, updated_at, client_tx_id) and ignore events where updated_at <= local.updated_at(id)
6. WHEN a self-echo event is received THEN the system SHALL check if client_tx_id matches a locally pending mutation and mark it confirmed instead of re-applying
7. WHEN WebSocket connection drops THEN the system SHALL auto-reconnect with backoff (1s→32s) and after 3 failures fallback to polling every 30s
8. WHEN counters are updated optimistically THEN the system SHALL reconcile with server fetch at least every 30 seconds

### Requirement 4

**User Story:** As a content author, I want to delete my own posts and comments, so that I can remove content I no longer want to share.

#### Acceptance Criteria

1. WHEN an author deletes their own post or comment THEN the system SHALL remove it immediately from all users' feeds
2. WHEN a deletion action is performed THEN the system SHALL provide a 15-second undo option
3. WHEN the undo period expires THEN the system SHALL permanently delete the content
4. WHEN an undo is triggered THEN the system SHALL restore the content and make it visible again to all users
5. WHEN delete is triggered THEN the system SHALL set deleted_at = now() and undo_expires_at = now() + 15s (soft delete) with content disappearing immediately
6. WHEN undo is allowed THEN the system SHALL permit it on any device for 15s and clear deleted_at and undo_expires_at
7. WHEN 15 seconds expire THEN the server SHALL finalize by either hard-delete or tombstone, and clients SHALL filter tombstones from UI
8. WHEN only the content author is authenticated THEN the system SHALL allow delete operations on their own content

### Requirement 5

**User Story:** As a grower, I want to view other users' profiles, so that I can learn more about community members and see their recent activity.

#### Acceptance Criteria

1. WHEN a user taps on another user's handle or avatar THEN the system SHALL navigate to their profile screen
2. WHEN viewing a profile THEN the system SHALL display the user's avatar, username, and recent posts
3. WHEN a profile is private or restricted THEN the system SHALL show appropriate messaging about limited visibility
4. WHEN profile data is loading THEN the system SHALL show loading states for all content sections
5. WHEN displaying profile posts THEN the system SHALL paginate recent posts (page size 20), created_at DESC, excluding deleted_at IS NOT NULL or hidden_at IS NOT NULL
6. WHEN a profile is restricted THEN the system SHALL show a standardized empty state with reason text and appropriate CTA
7. WHEN profile content loads THEN the system SHALL respect the same filtering rules as the main feed for consistency

### Requirement 6

**User Story:** As a user, I want the community feed to work offline, so that I can view cached content and queue actions when I don't have internet connectivity.

#### Acceptance Criteria

1. WHEN the app is offline THEN the system SHALL display the last 50 cached posts and comments
2. WHEN a user performs actions offline THEN the system SHALL queue likes and comments for later synchronization
3. WHEN connectivity is restored THEN the system SHALL automatically sync queued actions and update the feed
4. WHEN offline actions conflict with server state THEN the system SHALL resolve conflicts using last-write-wins strategy
5. WHEN caching content THEN the system SHALL store the last 50 posts + associated comments (up to 50/post) and display when offline
6. WHEN queuing actions THEN the system SHALL use FIFO queue with entries {id, op, payload, client_tx_id, idempotency_key, created_at, retries}
7. WHEN retrying failed actions THEN the system SHALL use exponential backoff (1s, 2s, 4s, … up to 32s), max 5 attempts, then mark as failed with retry button
8. WHEN connectivity restores THEN the system SHALL process Outbox before fetching new pages to minimize flicker
9. WHEN target content was deleted while offline THEN the system SHALL drop the queued action and inform the user

### Requirement 7

**User Story:** As a platform administrator, I want basic content moderation capabilities, so that inappropriate content can be managed effectively.

#### Acceptance Criteria

1. WHEN inappropriate content is reported THEN the system SHALL flag it for review
2. WHEN content violates community guidelines THEN authorized users SHALL be able to hide or remove it
3. WHEN content is moderated THEN the system SHALL log the action with timestamp and reason
4. WHEN a user repeatedly violates guidelines THEN the system SHALL support temporary restrictions on their posting ability
5. WHEN content is reported THEN the system SHALL create a reports row {target_type, target_id, reporter_id, reason, created_at, status}
6. WHEN authorized roles (mod, admin) moderate content THEN the system SHALL set hidden_at and moderation_reason, excluding content from default queries
7. WHEN moderation actions occur THEN the system SHALL create audit log entry {actor_id, action, target, reason, timestamp}
8. WHEN determining moderation permissions THEN the system SHALL verify roles via auth.jwt() claim with only mod/admin able to set hidden_at/moderation_reason

### Requirement 8

**User Story:** As a grower, I want to receive notifications for interactions on my posts, so that I can stay engaged with the community discussions.

#### Acceptance Criteria

1. WHEN someone likes my post THEN the system SHALL send a push notification (if enabled)
2. WHEN someone comments on my post THEN the system SHALL send a push notification with the comment preview
3. WHEN I have notification preferences set THEN the system SHALL respect those settings for all community interactions
4. WHEN notifications are tapped THEN the system SHALL navigate directly to the relevant post or comment
5. WHEN managing notification preferences THEN the system SHALL respect per-type preferences (likes, comments) with defaults: comments ON, likes ON
6. WHEN sending like notifications THEN the system SHALL rate-limit to max 1 per post per 5 min per recipient, batching multiple likers into one notification
7. WHEN notification is tapped THEN the system SHALL deep-link to the post and scroll to the specific comment if provided
8. WHEN tracking notification performance THEN the system SHALL monitor delivery/open rates (anonymized) for Android background mode reliability

### Requirement 9

**User Story:** As a user, I want the community feed to perform well with large amounts of content, so that I can browse smoothly without delays or performance issues.

#### Acceptance Criteria

1. WHEN loading the feed THEN the system SHALL paginate with 20-30 items per page, ordered by created_at DESC
2. WHEN loading comments THEN the system SHALL paginate with 20 comments per page in chronological order within each post
3. WHEN users create content THEN the system SHALL enforce max lengths: Post 2,000 chars; Comment 500 chars
4. WHEN users interact with content THEN the system SHALL enforce rate limits: Comments ≤10/min/user; Likes ≤30/min/user (server-enforced)
5. WHEN handling images THEN the system SHALL store them as filesystem/storage files referenced by URI with precomputed thumbnails, not as DB blobs
6. WHEN measuring performance THEN the system SHALL maintain median real-time latency < 1.5s, P95 < 3s (event received → UI updated)

### Requirement 10

**User Story:** As a platform operator, I want secure and reliable data handling, so that user data is protected and system integrity is maintained.

#### Acceptance Criteria

1. WHEN managing post likes THEN the system SHALL enforce UNIQUE (post_id, user_id) constraint with RLS: INSERT/DELETE only if auth.uid() = user_id
2. WHEN accessing posts and comments THEN the system SHALL allow public read, owner write/delete, filtering deleted_at IS NULL AND hidden_at IS NULL for default selects
3. WHEN performing moderation THEN the system SHALL verify roles via auth.jwt() claim with only mod/admin able to set hidden_at/moderation_reason
4. WHEN processing write operations THEN the system SHALL ensure all writes are idempotent via Idempotency-Key with server returning prior result on duplicate
5. WHEN tracking system health THEN the system SHALL monitor: WS reconnects/session, dedupe drops/min, Outbox depth, undo usage, failed mutations/day (<2%)
6. WHEN errors occur THEN the system SHALL send error events and unexpected state transitions to Sentry with lightweight, privacy-safe context
