import type { PostLike, RealtimeEvent } from '@/types/community';

type KeyExtractor<T> = (row: T) => string;

// Timestamp store for tracking last-applied commit_timestamp per composite key
// Used for post_likes to ensure proper ordering of events
const lastAppliedTimestamps = new Map<string, string>();

export type ShouldApplyParams<T> = {
  incoming: T;
  local?: T;
  getKey?: KeyExtractor<T>;
  timestampField?: string;
  eventTimestamp?: string;
  usePersistentTimestamps?: boolean;
};

/**
 * Decide whether an incoming realtime row should be applied on top of a
 * local row. By default this uses an `id` key and the `updated_at` field for
 * Last-Write-Wins ordering, but callers may provide a custom key extractor
 * and/or a different timestamp field (for example `commit_timestamp`).
 *
 * For post_likes, uses a persistent timestamp store instead of row-based timestamps.
 *
 * Requirements: 3.5 (LWW deduplication)
 */
export function shouldApply<T>(params: ShouldApplyParams<T>): boolean {
  const {
    incoming,
    local,
    getKey = (r: any) => (r as any).id,
    timestampField = 'updated_at',
    eventTimestamp,
    usePersistentTimestamps = false,
  } = params;

  if (!local) return true;

  const key = getKey(incoming);

  let incomingTs: Date;
  let localTs: Date;

  if (usePersistentTimestamps && eventTimestamp) {
    // For post_likes: use persistent timestamp store
    incomingTs = new Date(eventTimestamp);
    const storedTimestamp = lastAppliedTimestamps.get(key);
    localTs = storedTimestamp ? new Date(storedTimestamp) : new Date(0);
  } else {
    // Default behavior: use eventTimestamp if provided, otherwise extract from incoming object
    incomingTs = eventTimestamp
      ? new Date(eventTimestamp)
      : new Date((incoming as any)[timestampField]);
    localTs = new Date((local as any)[timestampField]);
  }

  // If either timestamp is missing or unparsable, conservatively allow apply
  if (isNaN(incomingTs.getTime()) || isNaN(localTs.getTime())) return true;

  return incomingTs > localTs;
}

/**
 * Store the last applied timestamp for a composite key
 * Used for post_likes to track ordering
 */
export function recordAppliedTimestamp(key: string, timestamp: string): void {
  lastAppliedTimestamps.set(key, timestamp);
}

/**
 * Get the last applied timestamp for a composite key
 */
export function getLastAppliedTimestamp(key: string): string | undefined {
  return lastAppliedTimestamps.get(key);
}

/**
 * Clear all stored timestamps (useful for testing)
 */
export function clearAppliedTimestamps(): void {
  lastAppliedTimestamps.clear();
}

type CacheOperations<T> = {
  get: (key: string) => T | undefined;
  upsert: (row: T) => void;
  remove: (key: string) => void;
};

type OutboxOperations = {
  has: (clientTxId: string) => boolean;
  confirm: (clientTxId: string) => void;
};

export type EventHandlerOptions<T> = {
  getKey?: KeyExtractor<T>;
  timestampField?: string;
  table?: string;
  cache: CacheOperations<T>;
  outbox: OutboxOperations;
  onInvalidate?: () => void;
};

/**
 * Handle real-time event with deduplication and self-echo detection
 *
 * Requirements:
 * - 3.4: Deduplicate events to prevent UI inconsistencies
 * - 3.5: Drop events where updated_at <= local.updated_at
 * - 3.6: Self-echo detection using client_tx_id matching
 */
export function handleRealtimeEvent<T>(
  event: RealtimeEvent<T>,
  options: EventHandlerOptions<T>
): void {
  const {
    eventType,
    new: newRow,
    old: oldRow,
    client_tx_id,
    commit_timestamp,
  } = event;

  if (!newRow && eventType !== 'DELETE') return;

  const getKey = options.getKey ?? ((r: any) => (r as any).id);
  const timestampField = options.timestampField ?? 'updated_at';
  const table = options.table;
  const { cache, outbox, onInvalidate } = options;

  // For DELETE events, use old row for key extraction
  const keyRow = (newRow ?? oldRow) as T;
  if (!keyRow) return;

  const key = getKey(keyRow);

  // Special-case: post_likes uses a composite key and commit_timestamp.
  // INSERT/DELETE on post_likes should be treated as toggle operations
  // (apply/remove) instead of relying on an `id` + `updated_at` LWW check.
  if (table === 'post_likes') {
    handlePostLikeEvent({ event, key, cache, outbox, onInvalidate });
    return;
  }

  // Default behavior for rows that have an `id` + `updated_at` style schema
  const localRow = cache.get(key);

  // For DELETE, use commit_timestamp from event; for others use newRow timestamp
  const rowForComparison = eventType === 'DELETE' ? oldRow : newRow;

  if (
    !shouldApply({
      incoming: rowForComparison as T,
      local: localRow,
      getKey,
      timestampField,
      eventTimestamp: commit_timestamp,
    })
  ) {
    console.log('Dropping stale event:', key);
    return;
  }

  // Handle self-echo confirmation (Requirements: 3.6)
  if (client_tx_id && outbox.has(client_tx_id)) {
    // Ensure we record the commit timestamp for this key before confirming
    // the outbox entry. This prevents later, older events from overwriting
    // our just-applied state due to missing timestamp bookkeeping.
    if (commit_timestamp) recordAppliedTimestamp(key, commit_timestamp);

    outbox.confirm(client_tx_id);
    console.log('Confirmed outbox entry:', client_tx_id);
    return; // Don't re-apply our own change
  }

  // Apply the change
  switch (eventType) {
    case 'INSERT':
    case 'UPDATE':
      if (newRow) cache.upsert(newRow);
      break;
    case 'DELETE':
      cache.remove(key);
      break;
  }

  // Trigger UI update
  onInvalidate?.();
}

/**
 * Handle post_likes events specially (composite key + commit_timestamp)
 */
function handlePostLikeEvent<T>(params: {
  event: RealtimeEvent<T>;
  key: string;
  cache: CacheOperations<T>;
  outbox: OutboxOperations;
  onInvalidate?: () => void;
}): void {
  const { event, key, cache, outbox, onInvalidate } = params;
  const { eventType, new: newRow, commit_timestamp, client_tx_id } = event;
  const local = cache.get(key);

  // Use commit_timestamp for ordering when available
  const should = shouldApply({
    incoming: newRow as T,
    local,
    getKey: () => key,
    timestampField: 'commit_timestamp',
    eventTimestamp: commit_timestamp,
    usePersistentTimestamps: true,
  });

  if (!should) {
    console.log('Dropping stale event (post_likes):', key);
    return;
  }

  // Handle self-echo confirmation
  if (client_tx_id && outbox.has(client_tx_id)) {
    // Preserve timestamp bookkeeping for this composite key before
    // confirming our own outbox entry. Use the event commit timestamp
    // (or the row's commit timestamp if present) so later stale events
    // won't be applied out of order.
    const commitTs = commit_timestamp || (newRow as any)?.commit_timestamp;
    if (commitTs) recordAppliedTimestamp(key, commitTs);

    outbox.confirm(client_tx_id);
    console.log('Confirmed outbox entry:', client_tx_id);
    return;
  }

  // Treat INSERT as a "like" (add) and DELETE as an "unlike" (remove).
  // If an INSERT arrives but the local cache already has the like, ignore it.
  switch (eventType) {
    case 'INSERT':
      if (!local && newRow) {
        // Ensure the stored row has a stable id equal to the composite key
        cache.upsert({ ...(newRow as any), id: key });
      }
      break;
    case 'DELETE':
      if (local) cache.remove(key);
      break;
  }

  // Store the last applied timestamp for this composite key
  if (commit_timestamp) {
    recordAppliedTimestamp(key, commit_timestamp);
  }

  onInvalidate?.();
}

/**
 * Create a composite key for post_likes (post_id:user_id)
 */
export function createLikeKey(postId: string, userId: string): string {
  return `${postId}:${userId}`;
}

/**
 * Extract post_id and user_id from a PostLike for composite key
 */
export function getLikeKey(like: PostLike): string {
  return createLikeKey(like.post_id, like.user_id);
}
