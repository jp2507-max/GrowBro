/**
 * useUnlikePost hook
 *
 * Optimistic mutation for unliking posts with:
 * - Immediate UI update
 * - Offline queue support
 * - Rollback on failure
 * - 409 conflict reconciliation
 */

import type {
  InfiniteData,
  QueryKey,
  UseMutationResult,
} from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { showMessage } from 'react-native-flash-message';

import type { PaginateQuery } from '@/api/types';
import {
  updatePostInInfiniteFeed,
  updatePostInUserPosts,
  updateSinglePost,
} from '@/lib/community/cache-updaters';
import {
  communityPostKey,
  isCommunityPostsInfiniteKey,
  isCommunityUserPostsKey,
} from '@/lib/community/query-keys';
import { translate } from '@/lib/i18n';
import { database } from '@/lib/watermelon';
import type { OutboxModel } from '@/lib/watermelon-models/outbox';
import type { Post } from '@/types/community';

import { ConflictError, getCommunityApiClient } from './client';

const apiClient = getCommunityApiClient();

interface UnlikePostVariables {
  postId: string;
}

interface UnlikePostContext {
  previousInfiniteQueries?: [
    QueryKey,
    InfiniteData<PaginateQuery<Post>> | undefined,
  ][];
  previousUserPostsQueries?: [
    QueryKey,
    InfiniteData<PaginateQuery<Post>> | undefined,
  ][];
  previousPost?: Post;
}

/**
 * Handle error and rollback
 */
function handleUnlikeError(
  error: Error,
  context: UnlikePostContext | undefined,
  queryClient: ReturnType<typeof useQueryClient>
): void {
  const restoreQueries = (
    snapshots?: [QueryKey, InfiniteData<PaginateQuery<Post>> | undefined][]
  ): void => {
    if (!snapshots) return;
    snapshots.forEach(([key, data]) => {
      queryClient.setQueryData(key, data);
    });
  };

  restoreQueries(context?.previousInfiniteQueries);
  restoreQueries(context?.previousUserPostsQueries);

  if (context?.previousPost) {
    queryClient.setQueryData(
      communityPostKey(context.previousPost.id),
      context.previousPost
    );
  }

  // Handle specific error types
  if (error instanceof ConflictError) {
    // 409 Conflict: reconcile to server state
    console.log('[useUnlikePost] Conflict detected, reconciling...');

    const canonicalState = error.canonicalState;
    if (canonicalState?.post_id) {
      updatePostInInfiniteFeed({
        queryClient,
        matchPostId: canonicalState.post_id,
        updater: (post) => ({
          ...post,
          user_has_liked: canonicalState.exists,
        }),
      });
      updatePostInUserPosts({
        queryClient,
        matchPostId: canonicalState.post_id,
        updater: (post) => ({
          ...post,
          user_has_liked: canonicalState.exists,
        }),
      });
      updateSinglePost({
        queryClient,
        postId: canonicalState.post_id,
        updater: (post) => ({
          ...post,
          user_has_liked: canonicalState.exists,
        }),
      });
    }

    showMessage({
      message: translate('community.action_reconciled'),
      type: 'info',
      duration: 2000,
    });
  } else {
    showMessage({
      message: translate('community.unlike_failed'),
      description: error.message,
      type: 'danger',
      duration: 3000,
    });
  }
}

function invalidateUnlikeQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  postId: string | undefined
): void {
  void queryClient.invalidateQueries({
    predicate: (query) => isCommunityPostsInfiniteKey(query.queryKey),
  });
  void queryClient.invalidateQueries({
    predicate: (query) => isCommunityUserPostsKey(query.queryKey),
  });
  if (postId) {
    void queryClient.invalidateQueries({
      queryKey: communityPostKey(postId),
    });
  }
}

async function prepareOptimisticUnlike(
  queryClient: ReturnType<typeof useQueryClient>,
  postId: string
): Promise<UnlikePostContext> {
  await queryClient.cancelQueries({
    predicate: (query) => isCommunityPostsInfiniteKey(query.queryKey),
  });
  await queryClient.cancelQueries({
    predicate: (query) => isCommunityUserPostsKey(query.queryKey),
  });
  await queryClient.cancelQueries({ queryKey: communityPostKey(postId) });

  const previousInfiniteQueries = queryClient.getQueriesData<
    InfiniteData<PaginateQuery<Post>>
  >({
    predicate: (query) => isCommunityPostsInfiniteKey(query.queryKey),
  });
  const previousUserPostsQueries = queryClient.getQueriesData<
    InfiniteData<PaginateQuery<Post>>
  >({
    predicate: (query) => isCommunityUserPostsKey(query.queryKey),
  });
  const previousPost = queryClient.getQueryData<Post>(communityPostKey(postId));

  const optimisticUpdater = (post: Post): Post => {
    if (!post.user_has_liked) return post;
    return {
      ...post,
      like_count: Math.max((post.like_count ?? 0) - 1, 0),
      user_has_liked: false,
    };
  };

  updatePostInInfiniteFeed({
    queryClient,
    matchPostId: postId,
    updater: optimisticUpdater,
  });
  updatePostInUserPosts({
    queryClient,
    matchPostId: postId,
    updater: optimisticUpdater,
  });
  updateSinglePost({ queryClient, postId, updater: optimisticUpdater });

  return { previousInfiniteQueries, previousUserPostsQueries, previousPost };
}

/**
 * Optimistically unlike a post
 */
export function useUnlikePost(): UseMutationResult<
  void,
  Error,
  UnlikePostVariables,
  UnlikePostContext
> {
  const queryClient = useQueryClient();

  return useMutation<void, Error, UnlikePostVariables, UnlikePostContext>({
    mutationFn: async ({ postId }): Promise<void> => {
      const idempotencyKey = randomUUID();
      const clientTxId = randomUUID();

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

      await apiClient.unlikePost(postId, idempotencyKey, clientTxId);
    },

    onMutate: async ({ postId }) =>
      prepareOptimisticUnlike(queryClient, postId),

    onError: (error, _variables, context): void => {
      handleUnlikeError(error, context, queryClient);
    },

    onSettled: (_data, _error, variables): void => {
      invalidateUnlikeQueries(queryClient, variables?.postId);
    },
  });
}
