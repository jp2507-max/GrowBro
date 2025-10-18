import { useQueryClient } from '@tanstack/react-query';
import * as React from 'react';

import type {
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
};

type CacheAdapter<T> = {
  get: (key: string) => T | undefined;
  upsert: (row: T) => void;
  remove: (key: string) => void;
};

type OutboxAdapter = {
  has: (clientTxId: string) => boolean;
  confirm: (clientTxId: string) => void;
};

/**
 * Create a cache adapter for React Query
 */
function createQueryCacheAdapter<T>(
  queryClient: ReturnType<typeof useQueryClient>,
  queryKey: string[],
  keySelector: (row: T) => string
): CacheAdapter<T> {
  return {
    get: (key: string) => {
      const data = queryClient.getQueryData<T[]>(queryKey);
      return data?.find((item) => keySelector(item) === key);
    },
    upsert: (row: T) => {
      queryClient.setQueryData<T[]>(queryKey, (old) => {
        if (!old) return [row];
        const rowKey = keySelector(row);
        const index = old.findIndex((item) => keySelector(item) === rowKey);
        if (index >= 0) {
          const updated = [...old];
          updated[index] = row;
          return updated;
        }
        return [...old, row];
      });
    },
    remove: (key: string) => {
      queryClient.setQueryData<T[]>(queryKey, (old) => {
        if (!old) return [];
        return old.filter((item) => keySelector(item) !== key);
      });
    },
  };
}

/**
 * Create a simple outbox adapter for testing self-echo detection
 * In production, this should be backed by the actual outbox implementation
 */
function createOutboxAdapter(): OutboxAdapter {
  const pendingTxIds = new Set<string>();

  return {
    has: (clientTxId: string) => pendingTxIds.has(clientTxId),
    confirm: (clientTxId: string) => {
      pendingTxIds.delete(clientTxId);
      console.log('Outbox confirmed:', clientTxId);
    },
  };
}

/**
 * Create event handlers for real-time subscriptions
 */
function createRealtimeHandlers(
  queryClient: ReturnType<typeof useQueryClient>,
  outbox: OutboxAdapter
) {
  const postsCache = createQueryCacheAdapter<Post>(
    queryClient,
    ['posts'],
    (post) => post.id
  );
  const commentsCache = createQueryCacheAdapter<PostComment>(
    queryClient,
    ['post-comments'],
    (comment) => comment.id
  );
  const likesCache = createQueryCacheAdapter<PostLike>(
    queryClient,
    ['post-likes'],
    (like) => `${like.post_id}-${like.user_id}`
  );

  return {
    onPostChange: (event: RealtimeEvent<Post>) => {
      handleRealtimeEvent(event, {
        table: 'posts',
        cache: postsCache,
        outbox,
        onInvalidate: () =>
          queryClient.invalidateQueries({ queryKey: ['posts'] }),
      } as EventHandlerOptions<Post>);
    },
    onCommentChange: (event: RealtimeEvent<PostComment>) => {
      handleRealtimeEvent(event, {
        table: 'post_comments',
        cache: commentsCache,
        outbox,
        onInvalidate: () =>
          queryClient.invalidateQueries({ queryKey: ['post-comments'] }),
      } as EventHandlerOptions<PostComment>);
    },
    onLikeChange: (event: RealtimeEvent<PostLike>) => {
      handleRealtimeEvent(event, {
        table: 'post_likes',
        getKey: getLikeKey,
        cache: likesCache,
        outbox,
        onInvalidate: () =>
          queryClient.invalidateQueries({ queryKey: ['post-likes'] }),
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
 * function CommunityFeed() {
 *   const { connectionState, isPolling } = useCommunityFeedRealtime({
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
    queryClient.invalidateQueries({ queryKey: ['posts'] });
    queryClient.invalidateQueries({ queryKey: ['post-comments'] });
    queryClient.invalidateQueries({ queryKey: ['post-likes'] });
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
        queryClient.invalidateQueries({ queryKey: ['posts'] });
        queryClient.invalidateQueries({ queryKey: ['post-comments'] });
        queryClient.invalidateQueries({ queryKey: ['post-likes'] });
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

export function useCommunityFeedRealtime(options: RealtimeOptions = {}) {
  const { postId, onConnectionStateChange, enabled = true } = options;

  const queryClient = useQueryClient();
  const managerRef = React.useRef<RealtimeConnectionManager | null>(null);
  const outboxRef = React.useRef<OutboxAdapter>(createOutboxAdapter());

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
  ]);

  return {
    connectionState,
    isPolling,
    manager: managerRef.current,
  };
}
