/**
 * useLikePost hook
 *
 * Optimistic mutation for liking posts with:
 * - Immediate UI update
 * - Offline queue support
 * - Rollback on failure
 * - 409 conflict reconciliation
 */

import type {
  InfiniteData,
  QueryClient,
  QueryKey,
  UseMutationResult,
} from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { showMessage } from 'react-native-flash-message';
import { v4 as uuidv4 } from 'uuid';

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

interface LikePostVariables {
  postId: string;
}

interface LikePostContext {
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

async function queueLikeAction(
  postId: string,
  idempotencyKey: string,
  clientTxId: string
): Promise<void> {
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

  if (error instanceof ConflictError) {
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
      message: translate('community.like_failed'),
      description: error.message,
      type: 'danger',
      duration: 3000,
    });
  }
}

/**
 * Optimistically like a post
 */
export function useLikePost(): UseMutationResult<
  void,
  Error,
  LikePostVariables,
  LikePostContext
> {
  const queryClient = useQueryClient();

  return useMutation<void, Error, LikePostVariables, LikePostContext>({
    mutationFn: async ({ postId }): Promise<void> => {
      const idempotencyKey = uuidv4();
      const clientTxId = uuidv4();
      await queueLikeAction(postId, idempotencyKey, clientTxId);
      await apiClient.likePost(postId, idempotencyKey, clientTxId);
    },

    onMutate: async ({ postId }): Promise<LikePostContext> => {
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
      const previousPost = queryClient.getQueryData<Post>(
        communityPostKey(postId)
      );

      const optimisticUpdater = (post: Post): Post => {
        if (post.user_has_liked) return post;
        return {
          ...post,
          like_count: (post.like_count ?? 0) + 1,
          user_has_liked: true,
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
      updateSinglePost({
        queryClient,
        postId,
        updater: optimisticUpdater,
      });

      return {
        previousInfiniteQueries,
        previousUserPostsQueries,
        previousPost,
      };
    },

    onError: (error, _variables, context): void => {
      handleLikeError(error, queryClient, context);
    },

    onSettled: (_data, _error, variables): void => {
      queryClient.invalidateQueries({
        predicate: (query) => isCommunityPostsInfiniteKey(query.queryKey),
      });
      queryClient.invalidateQueries({
        predicate: (query) => isCommunityUserPostsKey(query.queryKey),
      });
      if (variables?.postId) {
        queryClient.invalidateQueries({
          queryKey: communityPostKey(variables.postId),
        });
      }
    },
  });
}
