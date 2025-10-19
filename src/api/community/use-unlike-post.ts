/**
 * useUnlikePost hook
 *
 * Optimistic mutation for unliking posts with:
 * - Immediate UI update
 * - Offline queue support
 * - Rollback on failure
 * - 409 conflict reconciliation
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { showMessage } from 'react-native-flash-message';
import { v4 as uuidv4 } from 'uuid';

import type { PaginateQuery } from '@/api/types';
import { database } from '@/lib/watermelon';
import type { OutboxModel } from '@/lib/watermelon-models/outbox';
import type { Post } from '@/types/community';

import { ConflictError, getCommunityApiClient } from './client';

const apiClient = getCommunityApiClient();

interface UnlikePostVariables {
  postId: string;
}

interface UnlikePostContext {
  previousPosts?: PaginateQuery<Post>;
}

/**
 * Handle error and rollback
 */
function handleUnlikeError(
  error: Error,
  context: UnlikePostContext | undefined,
  queryClient: ReturnType<typeof useQueryClient>
) {
  // Rollback on error
  if (context?.previousPosts) {
    queryClient.setQueryData(['posts'], context.previousPosts);
  }

  // Handle specific error types
  if (error instanceof ConflictError) {
    // 409 Conflict: reconcile to server state
    console.log('[useUnlikePost] Conflict detected, reconciling...');

    const canonicalState = error.canonicalState;
    if (canonicalState) {
      const currentData = queryClient.getQueryData<PaginateQuery<Post>>([
        'posts',
      ]);
      if (currentData) {
        queryClient.setQueryData<PaginateQuery<Post>>(['posts'], {
          ...currentData,
          results: currentData.results.map((post) =>
            post.id === canonicalState.post_id
              ? {
                  ...post,
                  user_has_liked: canonicalState.exists,
                }
              : post
          ),
        });
      }
    }

    showMessage({
      message: 'Action reconciled with server',
      type: 'info',
      duration: 2000,
    });
  } else {
    showMessage({
      message: 'Failed to unlike post',
      description: error.message,
      type: 'danger',
      duration: 3000,
    });
  }
}

/**
 * Optimistically unlike a post
 */
export function useUnlikePost() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, UnlikePostVariables, UnlikePostContext>({
    mutationFn: async ({ postId }) => {
      const idempotencyKey = uuidv4();
      const clientTxId = uuidv4();

      // Queue in outbox for offline support
      await database.write(async () => {
        const outboxCollection = database.get<OutboxModel>('outbox');
        await outboxCollection.create((record) => {
          record.op = 'UNLIKE';
          record.payload = { postId };
          record.clientTxId = clientTxId;
          record.idempotencyKey = idempotencyKey;
          record.createdAt = new Date();
          record.retries = 0;
          record.status = 'pending';
        });
      });

      // Attempt immediate API call
      await apiClient.unlikePost(postId, idempotencyKey, clientTxId);
    },

    onMutate: async ({ postId }) => {
      // Cancel any in-flight queries
      await queryClient.cancelQueries({ queryKey: ['posts'] });

      // Snapshot previous state
      const previousPosts = queryClient.getQueryData<PaginateQuery<Post>>([
        'posts',
      ]);

      // Optimistically update cache
      if (previousPosts) {
        queryClient.setQueryData<PaginateQuery<Post>>(['posts'], {
          ...previousPosts,
          results: previousPosts.results.map((post) =>
            post.id === postId
              ? {
                  ...post,
                  like_count: Math.max((post.like_count || 0) - 1, 0),
                  user_has_liked: false,
                }
              : post
          ),
        });
      }

      return { previousPosts };
    },

    onError: (error, _variables, context) => {
      handleUnlikeError(error, context, queryClient);
    },

    onSettled: () => {
      // Invalidate to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
  });
}
