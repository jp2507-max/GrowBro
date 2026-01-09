import { type Database } from '@nozbe/watermelondb';
import { Q } from '@nozbe/watermelondb';
import type { InfiniteData } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import * as React from 'react';

import type { PaginateQuery } from '@/api/types';
import {
  communityPostKey,
  isCommunityPostsInfiniteKey,
  isCommunityUserPostsKey,
} from '@/lib/community/query-keys';
import type {
  CachedPostLike,
  Post,
  PostComment,
  PostLike,
  RealtimeEvent,
} from '@/types/community';

import {
  type EventHandlerOptions,
  getLikeKey,
  handleRealtimeEvent,
} from './event-deduplicator';
import { getOutboxProcessor } from './outbox-processor';
import { RealtimeConnectionManager } from './realtime-manager';

type RealtimeOptions = {
  /**
   * Optional post ID to filter comments subscription
   * If provided, only comments for this post will be received
   */
  postId?: string;

  /**
   * Callback for connection state changes
   */
  onConnectionStateChange?: (
    state: 'disconnected' | 'connecting' | 'connected' | 'error'
  ) => void;

  /**
   * Enable/disable the subscription
   * @default true
   */
  enabled?: boolean;

  /**
   * Outbox adapter for self-echo detection and confirmation
   */
  outboxAdapter: OutboxAdapter;
};

type CacheAdapter<T> = {
  get: (key: string) => T | undefined;
  upsert: (row: T) => void;
  remove: (key: string) => void;
};

type OutboxAdapter = {
  has: (clientTxId: string) => boolean | Promise<boolean>;
  confirm: (clientTxId: string) => void | Promise<void>;
};

function matchesQueryKeyPrefix(
  queryKey: readonly unknown[],
  prefix: readonly unknown[]
): boolean {
  if (queryKey.length < prefix.length) return false;
  return prefix.every((part, index) => queryKey[index] === part);
}

/**
 * Create a cache adapter for React Query that works with query key prefixes
 * This handles paginated queries where the cache key includes parameters like
 * ['community-comments', postId, cursor, limit]
 */
export function createQueryCacheAdapter<TStored, TCache = TStored>(
  queryClient: ReturnType<typeof useQueryClient>,
  options: {
    queryKeyPrefix: readonly unknown[];
    keySelector: (row: TCache) => string;
    toStored?: (cached: TCache) => TStored;
    fromStored?: (stored: TStored, id: string) => TCache;
  }
): CacheAdapter<TCache> {
  const { queryKeyPrefix, keySelector, toStored, fromStored } = options;

  return {
    get: (key: string) => {
      // Find the first matching query that has data
      const queries = queryClient.getQueriesData<TStored[]>({
        predicate: (query) =>
          matchesQueryKeyPrefix(query.queryKey, queryKeyPrefix),
      });

      for (const [, data] of queries) {
        if (!data) continue;
        const storedItem = data.find((item) => {
          const cached = fromStored
            ? fromStored(item, key)
            : (item as unknown as TCache);
          return keySelector(cached) === key;
        });
        if (storedItem) {
          return fromStored
            ? fromStored(storedItem, key)
            : (storedItem as unknown as TCache);
        }
      }
      return undefined;
    },
    upsert: (row: TCache) => {
      const storedRow = toStored ? toStored(row) : (row as unknown as TStored);
      const rowKey = keySelector(row);

      // Update all queries that match our prefix
      queryClient.setQueriesData<TStored[]>(
        {
          predicate: (query) =>
            matchesQueryKeyPrefix(query.queryKey, queryKeyPrefix),
        },
        (old) => {
          if (!old) return [storedRow];
          const index = old.findIndex((item) => {
            const cached = fromStored
              ? fromStored(item, rowKey)
              : (item as unknown as TCache);
            return keySelector(cached) === rowKey;
          });
          if (index >= 0) {
            const updated = [...old];
            updated[index] = storedRow;
            return updated;
          }
          return [...old, storedRow];
        }
      );
    },
    remove: (key: string) => {
      // Remove from all queries that match our prefix
      queryClient.setQueriesData<TStored[]>(
        {
          predicate: (query) =>
            matchesQueryKeyPrefix(query.queryKey, queryKeyPrefix),
        },
        (old) => {
          if (!old) return [];
          return old.filter((item) => {
            const cached = fromStored
              ? fromStored(item, key)
              : (item as unknown as TCache);
            return keySelector(cached) !== key;
          });
        }
      );
    },
  };
}

function createPaginatedQueryCacheAdapter<T>(
  queryClient: ReturnType<typeof useQueryClient>,
  options: {
    queryKeyPrefix: readonly unknown[];
    keySelector: (row: T) => string;
  }
): CacheAdapter<T> {
  const { queryKeyPrefix, keySelector } = options;

  return {
    get: (key: string): T | undefined => {
      const queries = queryClient.getQueriesData<PaginateQuery<T>>({
        predicate: (query) =>
          matchesQueryKeyPrefix(query.queryKey, queryKeyPrefix),
      });

      for (const [, data] of queries) {
        if (!data) continue;
        const found = data.results.find((row) => keySelector(row) === key);
        if (found) return found;
      }
      return undefined;
    },
    upsert: (row: T): void => {
      const rowKey = keySelector(row);
      queryClient.setQueriesData<PaginateQuery<T>>(
        {
          predicate: (query) =>
            matchesQueryKeyPrefix(query.queryKey, queryKeyPrefix),
        },
        (old) => {
          if (!old) return old;
          const exists = old.results.some(
            (item) => keySelector(item) === rowKey
          );
          if (exists) {
            return {
              ...old,
              results: old.results.map((item) =>
                keySelector(item) === rowKey ? row : item
              ),
            };
          }
          return {
            ...old,
            results: [...old.results, row],
            count: (old.count || 0) + 1,
          };
        }
      );
    },
    remove: (key: string): void => {
      queryClient.setQueriesData<PaginateQuery<T>>(
        {
          predicate: (query) =>
            matchesQueryKeyPrefix(query.queryKey, queryKeyPrefix),
        },
        (old) => {
          if (!old) return old;
          const originalLength = old.results.length;
          const filteredResults = old.results.filter(
            (item) => keySelector(item) !== key
          );
          const actualRemoved = originalLength - filteredResults.length;
          return {
            ...old,
            results: filteredResults,
            count: Math.max((old.count || 0) - actualRemoved, 0),
          };
        }
      );
    },
  };
}

function createInfiniteQueryCacheAdapter<T>(
  queryClient: ReturnType<typeof useQueryClient>,
  options: {
    queryKeyPrefix: readonly unknown[];
    keySelector: (row: T) => string;
  }
): CacheAdapter<T> {
  const { queryKeyPrefix, keySelector } = options;

  const updatePages = (
    data: InfiniteData<PaginateQuery<T>>,
    updater: (page: PaginateQuery<T>) => PaginateQuery<T>
  ): InfiniteData<PaginateQuery<T>> => {
    return {
      ...data,
      pages: data.pages.map((page) => updater(page)),
    };
  };

  return {
    get: (key: string): T | undefined => {
      const queries = queryClient.getQueriesData<
        InfiniteData<PaginateQuery<T>>
      >({
        predicate: (query) =>
          matchesQueryKeyPrefix(query.queryKey, queryKeyPrefix),
      });

      for (const [, data] of queries) {
        if (!data) continue;
        for (const page of data.pages) {
          const found = page.results.find((row) => keySelector(row) === key);
          if (found) return found;
        }
      }
      return undefined;
    },
    upsert: (row: T): void => {
      const rowKey = keySelector(row);
      queryClient.setQueriesData<InfiniteData<PaginateQuery<T>>>(
        {
          predicate: (query) =>
            matchesQueryKeyPrefix(query.queryKey, queryKeyPrefix),
        },
        (old) => {
          if (!old) return old;
          return updatePages(old, (page) => {
            const exists = page.results.some(
              (item) => keySelector(item) === rowKey
            );
            if (exists) {
              return {
                ...page,
                results: page.results.map((item) =>
                  keySelector(item) === rowKey ? row : item
                ),
              };
            }
            // Note: Inserts are not handled here to maintain consistency.
            // New items should be added via invalidateQueries/refetch.
            return page;
          });
        }
      );
    },
    remove: (key: string): void => {
      queryClient.setQueriesData<InfiniteData<PaginateQuery<T>>>(
        {
          predicate: (query) =>
            matchesQueryKeyPrefix(query.queryKey, queryKeyPrefix),
        },
        (old) => {
          if (!old) return old;
          return updatePages(old, (page) => ({
            ...page,
            results: page.results.filter((item) => keySelector(item) !== key),
          }));
        }
      );
    },
  };
}

/**
 * Create an outbox adapter backed by the WatermelonDB outbox table
 * Used for self-echo detection and confirmation in real-time subscriptions
 */
export function createOutboxAdapter(database: Database): OutboxAdapter {
  const processor = getOutboxProcessor(database);

  return {
    has: async (clientTxId: string) => {
      const outboxCollection = database.get('outbox');
      const entries = await outboxCollection
        .query(
          Q.where('client_tx_id', clientTxId),
          Q.where(
            'status',
            Q.oneOf([
              'pending',
              'in_progress',
              'processed',
              'failed',
              'expired',
            ])
          )
        )
        .fetch();
      return entries.length > 0;
    },
    confirm: async (clientTxId: string) => {
      await processor.confirmEntry(clientTxId);
    },
  };
}

/**
 * Create cache adapters for real-time subscriptions
 */
function createRealtimeCacheAdapters(
  queryClient: ReturnType<typeof useQueryClient>
) {
  const postsInfiniteCache = createInfiniteQueryCacheAdapter<Post>(
    queryClient,
    {
      queryKeyPrefix: ['community-posts', 'infinite'],
      keySelector: (post) => post.id,
    }
  );
  const userPostsCache = createInfiniteQueryCacheAdapter<Post>(queryClient, {
    queryKeyPrefix: ['community-user-posts'],
    keySelector: (post) => post.id,
  });
  const commentsCache = createPaginatedQueryCacheAdapter<PostComment>(
    queryClient,
    {
      queryKeyPrefix: ['community-comments'],
      keySelector: (comment) => comment.id,
    }
  );
  const likesCache = createQueryCacheAdapter<CachedPostLike>(queryClient, {
    queryKeyPrefix: ['post-likes'],
    keySelector: (like) => like.id,
  });

  return { postsInfiniteCache, userPostsCache, commentsCache, likesCache };
}

function createPostsCacheAdapter(
  queryClient: ReturnType<typeof useQueryClient>,
  postsInfiniteCache: CacheAdapter<Post>,
  userPostsCache: CacheAdapter<Post>
): CacheAdapter<Post> {
  return {
    get: (key) =>
      queryClient.getQueryData<Post>(communityPostKey(key)) ??
      postsInfiniteCache.get(key) ??
      userPostsCache.get(key),
    upsert: (row) => {
      queryClient.setQueryData(communityPostKey(row.id), row);
      postsInfiniteCache.upsert(row);
      userPostsCache.upsert(row);
    },
    remove: (key) => {
      postsInfiniteCache.remove(key);
      userPostsCache.remove(key);
    },
  };
}

function invalidatePostsQueries(
  queryClient: ReturnType<typeof useQueryClient>
): void {
  queryClient.invalidateQueries({
    predicate: (query) => isCommunityPostsInfiniteKey(query.queryKey),
  });
  queryClient.invalidateQueries({
    predicate: (query) => isCommunityUserPostsKey(query.queryKey),
  });
  queryClient.invalidateQueries({ queryKey: ['community-post'] });
}

function invalidateCommunityFeedQueries(
  queryClient: ReturnType<typeof useQueryClient>
): void {
  invalidatePostsQueries(queryClient);
  queryClient.invalidateQueries({ queryKey: ['community-comments'] });
}

/**
 * Create event handlers for real-time subscriptions
 */
function createRealtimeHandlers(
  queryClient: ReturnType<typeof useQueryClient>,
  outbox: OutboxAdapter
) {
  const { postsInfiniteCache, userPostsCache, commentsCache, likesCache } =
    createRealtimeCacheAdapters(queryClient);
  const postsCache = createPostsCacheAdapter(
    queryClient,
    postsInfiniteCache,
    userPostsCache
  );

  return {
    onPostChange: async (event: RealtimeEvent<Post>) => {
      await handleRealtimeEvent(event, {
        table: 'posts',
        cache: postsCache,
        outbox,
        onInvalidate: () => invalidatePostsQueries(queryClient),
      } as EventHandlerOptions<Post>);
    },
    onCommentChange: async (event: RealtimeEvent<PostComment>) => {
      await handleRealtimeEvent(event, {
        table: 'post_comments',
        cache: commentsCache,
        outbox,
        onInvalidate: () =>
          queryClient.invalidateQueries({ queryKey: ['community-comments'] }),
      } as EventHandlerOptions<PostComment>);
    },
    onLikeChange: async (event: RealtimeEvent<PostLike>) => {
      await handleRealtimeEvent(event, {
        table: 'post_likes',
        getKey: getLikeKey,
        cache: likesCache,
        outbox,
        onInvalidate: () => invalidatePostsQueries(queryClient),
      } as EventHandlerOptions<PostLike>);
    },
  };
}

/**
 * Setup polling check interval to track polling state
 */
function setupPollingMonitor(
  manager: RealtimeConnectionManager,
  setIsPolling: (polling: boolean) => void
): NodeJS.Timeout {
  const pollingCheckInterval = setInterval(() => {
    setIsPolling(manager.isPollingActive());
  }, 1000);
  return pollingCheckInterval;
}

/**
 * Hook for managing community feed real-time subscriptions
 *
 * Provides:
 * - WebSocket connection with auto-reconnect
 * - Event deduplication using LWW
 * - Self-echo detection via client_tx_id
 * - Automatic fallback to polling after 3 connection failures
 * - Proper cleanup on unmount
 *
 * Requirements: 3.1, 3.2, 3.4, 3.5, 3.6, 3.7
 *
 * @example
 * ```tsx
 * import { database } from '@/lib/watermelon';
 * import { createOutboxAdapter } from './use-community-feed-realtime';
 *
 * function CommunityFeed() {
 *   const outboxAdapter = React.useMemo(() => createOutboxAdapter(database), []);
 *
 *   const { connectionState, isPolling } = useCommunityFeedRealtime({
 *     outboxAdapter,
 *     onConnectionStateChange: (state) => console.log('Connection:', state),
 *   });
 *
 *   return (
 *     <View>
 *       {connectionState === 'connected' && <Text>Live updates</Text>}
 *       {isPolling && <Text>Polling mode</Text>}
 *     </View>
 *   );
 * }
 * ```
 */
function useReconciliationTimer(
  queryClient: ReturnType<typeof useQueryClient>
) {
  const reconciliationTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  const reconcile = React.useCallback(() => {
    console.log('Reconciling counters with server...');
    invalidateCommunityFeedQueries(queryClient);
  }, [queryClient]);

  const startReconciliation = React.useCallback(() => {
    if (reconciliationTimerRef.current)
      clearInterval(reconciliationTimerRef.current);
    reconciliationTimerRef.current = setInterval(reconcile, 30000);
  }, [reconcile]);

  const stopReconciliation = React.useCallback(() => {
    if (reconciliationTimerRef.current) {
      clearInterval(reconciliationTimerRef.current);
      reconciliationTimerRef.current = null;
    }
  }, []);

  React.useEffect(() => {
    return () => {
      if (reconciliationTimerRef.current) {
        clearInterval(reconciliationTimerRef.current);
      }
    };
  }, []);

  return { startReconciliation, stopReconciliation };
}

function usePollingEffect(
  isPolling: boolean,
  queryClient: ReturnType<typeof useQueryClient>
) {
  const pollingIntervalRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    if (isPolling) {
      // Clear any existing polling interval before creating a new one
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }

      // Start new 30s polling interval
      pollingIntervalRef.current = setInterval(() => {
        console.log('Polling: Invalidating queries...');
        invalidateCommunityFeedQueries(queryClient);
      }, 30000);
    } else {
      // Clear polling interval when not polling
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    }

    // Cleanup on unmount or when isPolling changes
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [isPolling, queryClient]);
}

export function useCommunityFeedRealtime(options: RealtimeOptions) {
  const {
    postId,
    onConnectionStateChange,
    enabled = true,
    outboxAdapter,
  } = options;

  const queryClient = useQueryClient();
  const managerRef = React.useRef<RealtimeConnectionManager | null>(null);
  const outboxRef = React.useRef<OutboxAdapter>(outboxAdapter);

  React.useEffect(() => {
    outboxRef.current = outboxAdapter;
  }, [outboxAdapter]);

  const [connectionState, setConnectionState] = React.useState<
    'disconnected' | 'connecting' | 'connected' | 'error'
  >('disconnected');
  const [isPolling, setIsPolling] = React.useState(false);

  const { startReconciliation, stopReconciliation } =
    useReconciliationTimer(queryClient);
  usePollingEffect(isPolling, queryClient);

  React.useEffect(() => {
    if (!enabled) return;

    const manager = new RealtimeConnectionManager();
    managerRef.current = manager;

    const handlers = createRealtimeHandlers(queryClient, outboxRef.current);

    manager.subscribe(
      {
        ...handlers,
        onConnectionStateChange: (state) => {
          setConnectionState(state);
          onConnectionStateChange?.(state);
          if (state === 'connected') {
            startReconciliation();
          } else {
            stopReconciliation();
          }
        },
        onPollRefresh: () => {
          console.log(
            'Poll refresh triggered, invalidating community feed queries...'
          );
          invalidateCommunityFeedQueries(queryClient);
        },
      },
      postId
    );

    const pollingCheckInterval = setupPollingMonitor(manager, setIsPolling);

    return () => {
      clearInterval(pollingCheckInterval);
      stopReconciliation();
      manager.unsubscribe();
      managerRef.current = null;
    };
  }, [
    enabled,
    postId,
    queryClient,
    onConnectionStateChange,
    startReconciliation,
    stopReconciliation,
    outboxAdapter,
  ]);

  return {
    connectionState,
    isPolling,
    manager: managerRef.current,
  };
}
