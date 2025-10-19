import type {
  CachedPostLike,
  PostLike,
  RealtimeEvent,
} from '@/types/community';

import { communityMetrics } from './metrics-tracker';

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

  const key = getKey(incoming);

  if (!local && !usePersistentTimestamps) return true;

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
  has: (clientTxId: string) => boolean | Promise<boolean>;
  confirm: (clientTxId: string) => void | Promise<void>;
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
 * Extract key from event row based on table type
 */
function extractEventKey<T>(
  keyRow: T,
  table: string | undefined,
  getKey: KeyExtractor<T>
): string {
  if (table === 'post_likes') {
    return getLikeKey(keyRow as unknown as PostLike);
  }
  return getKey(keyRow);
}

/**
 * Apply event change to cache
 */
function applyEventToCache<T>(params: {
  eventType: string;
  newRow: T | undefined;
  key: string;
  cache: CacheOperations<T>;
}): void {
  const { eventType, newRow, key, cache } = params;
  switch (eventType) {
    case 'INSERT':
    case 'UPDATE':
      if (newRow) cache.upsert(newRow);
      break;
    case 'DELETE':
      cache.remove(key);
      break;
  }
}

/**
 * Handle real-time event with deduplication and self-echo detection
 *
 * Requirements:
 * - 3.4: Deduplicate events to prevent UI inconsistencies
 * - 3.5: Drop events where updated_at <= local.updated_at
 * - 3.6: Self-echo detection using client_tx_id matching
 */
export async function handleRealtimeEvent<T extends Record<string, any>>(
  event: RealtimeEvent<T>,
  options: EventHandlerOptions<T>
): Promise<void> {
  const { eventType, new: newRow, old: oldRow, commit_timestamp } = event;

  if (!newRow && eventType !== 'DELETE') return;

  const getKey = options.getKey ?? ((r: any) => r.id);
  const timestampField = options.timestampField ?? 'updated_at';
  const table = options.table;
  const { cache, outbox, onInvalidate } = options;

  // For DELETE events, use old row for key extraction
  const keyRow = (newRow ?? oldRow) as T;
  if (!keyRow) return;

  const key = extractEventKey(keyRow, table, getKey);

  // Special-case: post_likes uses a composite key and commit_timestamp.
  // INSERT/DELETE on post_likes should be treated as toggle operations
  // (apply/remove) instead of relying on an `id` + `updated_at` LWW check.
  if (table === 'post_likes') {
    await handlePostLikeEvent({
      event: event as RealtimeEvent<PostLike>,
      key,
      cache: cache as unknown as CacheOperations<CachedPostLike>,
      outbox,
      onInvalidate,
    });
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
    // Track dedupe drop (Requirement 10.5)
    communityMetrics.recordDedupeDrop();
    return;
  }

  // Self-echo confirmation: confirm outbox entries when client_tx_id is present
  if (event.client_tx_id) {
    try {
      await outbox.confirm(event.client_tx_id);
    } catch (error) {
      console.error('Failed to confirm outbox for event:', key, error);
    }
  }

  applyEventToCache({
    eventType,
    newRow,
    key,
    cache: cache as CacheOperations<T | null>,
  });

  // Trigger UI update
  onInvalidate?.();
}

/**
 * Handle post_likes events specially (composite key + commit_timestamp)
 */
async function handlePostLikeEvent(params: {
  event: RealtimeEvent<PostLike>;
  key: string;
  cache: CacheOperations<CachedPostLike>;
  outbox: OutboxOperations;
  onInvalidate?: () => void;
}): Promise<void> {
  const { event, key, cache, outbox, onInvalidate } = params;
  const { eventType, new: newRow, commit_timestamp } = event;
  const local = cache.get(key);

  // Use commit_timestamp for ordering when available
  const should = shouldApply({
    incoming: newRow as PostLike,
    local,
    getKey: () => key,
    timestampField: 'commit_timestamp',
    eventTimestamp: commit_timestamp,
    usePersistentTimestamps: true,
  });

  if (!should) {
    console.log('Dropping stale event (post_likes):', key);
    // Track dedupe drop (Requirement 10.5)
    communityMetrics.recordDedupeDrop();
    return;
  }

  // Self-echo confirmation: confirm outbox entries when client_tx_id is present
  if (event.client_tx_id) {
    try {
      await outbox.confirm(event.client_tx_id);
    } catch (error) {
      console.error('Failed to confirm outbox for like event:', key, error);
    }
  }

  // Treat INSERT as a "like" (add) and DELETE as an "unlike" (remove).
  // If an INSERT arrives but the local cache already has the like, ignore it.
  switch (eventType) {
    case 'INSERT':
      if (!local && newRow) {
        // Ensure the stored row has a stable id equal to the composite key
        const cachedLike: CachedPostLike = { ...newRow, id: key };
        cache.upsert(cachedLike);
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
