/**
 * useDeleteComment hook
 *
 * Optimistic mutation for deleting comments with:
 * - Immediate UI removal
 * - 15-second undo window
 * - Offline queue support
 * - Rollback on failure
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { showMessage } from 'react-native-flash-message';
import { v4 as uuidv4 } from 'uuid';

import type { PaginateQuery } from '@/api/types';
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
  previousComments?: PaginateQuery<PostComment>;
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
): PaginateQuery<PostComment> | undefined {
  const previousComments = queryClient.getQueryData<PaginateQuery<PostComment>>(
    ['comments', postId]
  );

  if (previousComments) {
    queryClient.setQueryData<PaginateQuery<PostComment>>(['comments', postId], {
      ...previousComments,
      results: previousComments.results.filter(
        (comment) => comment.id !== commentId
      ),
      count: Math.max((previousComments.count || 0) - 1, 0),
    });
  }

  return previousComments;
}

// Success notification utility
function showDeleteSuccessMessage(undoExpiresAt: string): void {
  const secondsRemaining = Math.max(
    0,
    Math.ceil((new Date(undoExpiresAt).getTime() - Date.now()) / 1000)
  );
  showMessage({
    message: 'Comment deleted',
    description: `Undo available for ${secondsRemaining}s`,
    type: 'success',
    duration: 3000,
  });
}

// Error handling utility
function handleDeleteError(
  queryClient: ReturnType<typeof useQueryClient>,
  postId: string,
  context: { error: Error; previousComments?: PaginateQuery<PostComment> }
): void {
  const { error, previousComments } = context;
  if (previousComments) {
    queryClient.setQueryData(['comments', postId], previousComments);
  }

  showMessage({
    message: 'Failed to delete comment',
    description: error.message,
    type: 'danger',
    duration: 3000,
  });
}

/**
 * Optimistically delete a comment
 */
export function useDeleteComment() {
  const queryClient = useQueryClient();

  return useMutation<
    DeleteResponse,
    Error,
    DeleteCommentVariables,
    DeleteCommentContext
  >({
    mutationFn: async ({ commentId }) => {
      const idempotencyKey = uuidv4();
      const clientTxId = uuidv4();

      await queueCommentDeletionInOutbox(commentId, clientTxId, idempotencyKey);

      const response = await apiClient.deleteComment(
        commentId,
        idempotencyKey,
        clientTxId
      );

      return response;
    },

    onMutate: async ({ commentId, postId }) => {
      await queryClient.cancelQueries({ queryKey: ['comments', postId] });

      const previousComments = optimisticallyRemoveComment(
        queryClient,
        postId,
        commentId
      );

      return { previousComments };
    },

    onSuccess: (data) => {
      showDeleteSuccessMessage(data.undo_expires_at);
    },

    onError: (error, variables, context) => {
      handleDeleteError(queryClient, variables.postId, {
        error,
        previousComments: context?.previousComments,
      });
    },

    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['comments', variables.postId],
      });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
  });
}
