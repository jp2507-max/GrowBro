/**
 * useLikePost hook
 *
 * Optimistic mutation for liking posts with:
 * - Immediate UI update
 * - Offline queue support
 * - Rollback on failure
 * - 409 conflict reconciliation
 */

import type { QueryClient } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { showMessage } from 'react-native-flash-message';
import { v4 as uuidv4 } from 'uuid';

import { database } from '@/lib/watermelon';
import type { OutboxModel } from '@/lib/watermelon-models/outbox';
import type { Post } from '@/types/community';

import { ConflictError, getCommunityApiClient } from './client';
import type { PaginatedResponse } from './types';

const apiClient = getCommunityApiClient();

interface LikePostVariables {
  postId: string;
}

interface LikePostContext {
  previousPosts?: PaginatedResponse<Post>;
}

async function queueLikeAction(
  postId: string,
  idempotencyKey: string,
  clientTxId: string
) {
  await database.write(async () => {
    const outboxCollection = database.get<OutboxModel>('outbox');
    await outboxCollection.create((record) => {
      record.op = 'LIKE';
      record.payload = { postId };
      record.clientTxId = clientTxId;
      record.idempotencyKey = idempotencyKey;
      record.createdAt = new Date();
      record.retries = 0;
      record.status = 'pending';
    });
  });
}

function handleLikeError(
  error: Error,
  queryClient: QueryClient,
  context?: LikePostContext
) {
  if (context?.previousPosts) {
    queryClient.setQueryData(['posts'], context.previousPosts);
  }

  if (error instanceof ConflictError) {
    const serverState = (error as any).serverState;
    if (serverState) {
      const currentData = queryClient.getQueryData<PaginatedResponse<Post>>([
        'posts',
      ]);
      if (currentData) {
        queryClient.setQueryData<PaginatedResponse<Post>>(['posts'], {
          ...currentData,
          results: currentData.results.map((post) =>
            post.id === serverState.post_id
              ? { ...post, user_has_liked: serverState.exists }
              : post
          ),
        });
      }
    }
    showMessage({ message: 'Action reconciled', type: 'info', duration: 2000 });
  } else {
    showMessage({
      message: 'Failed to like post',
      description: error.message,
      type: 'danger',
      duration: 3000,
    });
  }
}

/**
 * Optimistically like a post
 */
export function useLikePost() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, LikePostVariables, LikePostContext>({
    mutationFn: async ({ postId }) => {
      const idempotencyKey = uuidv4();
      const clientTxId = uuidv4();
      await queueLikeAction(postId, idempotencyKey, clientTxId);
      await apiClient.likePost(postId, idempotencyKey, clientTxId);
    },

    onMutate: async ({ postId }) => {
      await queryClient.cancelQueries({ queryKey: ['posts'] });
      const previousPosts = queryClient.getQueryData<PaginatedResponse<Post>>([
        'posts',
      ]);

      if (previousPosts) {
        queryClient.setQueryData<PaginatedResponse<Post>>(['posts'], {
          ...previousPosts,
          results: previousPosts.results.map((post) =>
            post.id === postId
              ? {
                  ...post,
                  like_count: (post.like_count || 0) + 1,
                  user_has_liked: true,
                }
              : post
          ),
        });
      }

      return { previousPosts };
    },

    onError: (error, _variables, context) => {
      handleLikeError(error, queryClient, context);
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
  });
}
