/**
 * useDeleteComment hook
 *
 * Optimistic mutation for deleting comments with:
 * - Immediate UI removal
 * - 15-second undo window
 * - Offline queue support
 * - Rollback on failure
 */

import type { QueryKey, UseMutationResult } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { showMessage } from 'react-native-flash-message';

import type { PaginateQuery } from '@/api/types';
import {
  communityPostKey,
  isCommunityCommentsKey,
  isCommunityPostsInfiniteKey,
  isCommunityUserPostsKey,
} from '@/lib/community/query-keys';
import { translate } from '@/lib/i18n';
import { database } from '@/lib/watermelon';
import type { OutboxModel } from '@/lib/watermelon-models/outbox';
import type { PostComment } from '@/types/community';

import { getCommunityApiClient } from './client';
import type { DeleteResponse } from './types';

const apiClient = getCommunityApiClient();

interface DeleteCommentVariables {
  commentId: string;
  postId: string;
}

interface DeleteCommentContext {
  previousComments?: [QueryKey, PaginateQuery<PostComment> | undefined][];
}

// Outbox creation utility
async function queueCommentDeletionInOutbox(
  commentId: string,
  clientTxId: string,
  idempotencyKey: string
): Promise<void> {
  await database.write(async () => {
    const outboxCollection = database.get<OutboxModel>('outbox');
    await outboxCollection.create((record) => {
      record.op = 'DELETE_COMMENT';
      record.payload = { commentId };
      record.clientTxId = clientTxId;
      record.idempotencyKey = idempotencyKey;
      record.createdAt = new Date();
      record.retries = 0;
      record.status = 'pending';
    });
  });
}

// Optimistic update utility
function optimisticallyRemoveComment(
  queryClient: ReturnType<typeof useQueryClient>,
  postId: string,
  commentId: string
): [QueryKey, PaginateQuery<PostComment> | undefined][] {
  const previousComments = queryClient.getQueriesData<
    PaginateQuery<PostComment>
  >({
    predicate: (query) =>
      isCommunityCommentsKey(query.queryKey) && query.queryKey[1] === postId,
  });

  queryClient.setQueriesData<PaginateQuery<PostComment>>(
    {
      predicate: (query) =>
        isCommunityCommentsKey(query.queryKey) && query.queryKey[1] === postId,
    },
    (current) => {
      if (!current) return current;
      return {
        ...current,
        results: current.results.filter((comment) => comment.id !== commentId),
        count: Math.max((current.count || 0) - 1, 0),
      };
    }
  );

  return previousComments;
}

// Success notification utility
function showDeleteSuccessMessage(undoExpiresAt: string): void {
  const secondsRemaining = Math.max(
    0,
    Math.ceil((new Date(undoExpiresAt).getTime() - Date.now()) / 1000)
  );
  showMessage({
    message: translate('community.comment_deleted'),
    description: translate('community.undo_expires', {
      seconds: secondsRemaining,
    }),
    type: 'success',
    duration: 3000,
  });
}

// Error handling utility
function handleDeleteError(
  queryClient: ReturnType<typeof useQueryClient>,
  postId: string,
  context: {
    error: Error;
    previousComments?: [QueryKey, PaginateQuery<PostComment> | undefined][];
  }
): void {
  const { error, previousComments } = context;
  if (previousComments) {
    previousComments.forEach(([key, data]) => {
      queryClient.setQueryData(key, data);
    });
  }

  showMessage({
    message: translate('community.comment_delete_failed'),
    description: error.message,
    type: 'danger',
    duration: 3000,
  });
}

/**
 * Optimistically delete a comment
 */
export function useDeleteComment(): UseMutationResult<
  DeleteResponse,
  Error,
  DeleteCommentVariables,
  DeleteCommentContext
> {
  const queryClient = useQueryClient();

  return useMutation<
    DeleteResponse,
    Error,
    DeleteCommentVariables,
    DeleteCommentContext
  >({
    mutationFn: async ({ commentId }): Promise<DeleteResponse> => {
      const idempotencyKey = randomUUID();
      const clientTxId = randomUUID();

      await queueCommentDeletionInOutbox(commentId, clientTxId, idempotencyKey);

      const response = await apiClient.deleteComment(
        commentId,
        idempotencyKey,
        clientTxId
      );

      return response;
    },

    onMutate: async ({ commentId, postId }): Promise<DeleteCommentContext> => {
      await queryClient.cancelQueries({
        predicate: (query) =>
          isCommunityCommentsKey(query.queryKey) &&
          query.queryKey[1] === postId,
      });

      const previousComments = optimisticallyRemoveComment(
        queryClient,
        postId,
        commentId
      );

      return { previousComments };
    },

    onSuccess: (data): void => {
      showDeleteSuccessMessage(data.undo_expires_at);
    },

    onError: (error, variables, context): void => {
      handleDeleteError(queryClient, variables.postId, {
        error,
        previousComments: context?.previousComments,
      });
    },

    onSettled: (_data, _error, variables): void => {
      queryClient.invalidateQueries({
        predicate: (query) =>
          isCommunityCommentsKey(query.queryKey) &&
          query.queryKey[1] === variables.postId,
      });
      queryClient.invalidateQueries({
        predicate: (query) => isCommunityPostsInfiniteKey(query.queryKey),
      });
      queryClient.invalidateQueries({
        predicate: (query) => isCommunityUserPostsKey(query.queryKey),
      });
      queryClient.invalidateQueries({
        queryKey: communityPostKey(variables.postId),
      });
    },
  });
}
