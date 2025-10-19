/**
 * useCreateComment hook
 *
 * Optimistic mutation for creating comments with:
 * - Temp local ID with pending status
 * - Offline queue support
 * - Server ID replacement on success
 * - Pending retry UI on failure
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { showMessage } from 'react-native-flash-message';
import { v4 as uuidv4 } from 'uuid';

import { database } from '@/lib/watermelon';
import type { OutboxModel } from '@/lib/watermelon-models/outbox';
import type { PostComment } from '@/types/community';

import { getCommunityApiClient, ValidationError } from './client';
import type { PaginatedResponse } from './types';

const apiClient = getCommunityApiClient();

interface CreateCommentVariables {
  postId: string;
  body: string;
}

interface CreateCommentContext {
  previousComments?: PaginatedResponse<PostComment>;
  tempComment: PostComment;
}

// Validation utilities
function validateCommentBody(body: string): void {
  if (!body || body.trim().length === 0) {
    throw new ValidationError('Comment body cannot be empty');
  }

  if (body.length > 500) {
    throw new ValidationError('Comment cannot exceed 500 characters');
  }
}

const OUTBOX_QUEUE_FAILED = 'OUTBOX_QUEUE_FAILED' as const;
type ErrorWithCode = Error & { code?: string };

function hasErrorCode(e: unknown, code: string): e is ErrorWithCode {
  return (
    !!e &&
    typeof e === 'object' &&
    'code' in (e as any) &&
    (e as any).code === code
  );
}

// Outbox creation utility
async function queueCommentInOutbox(payload: {
  postId: string;
  body: string;
  clientTxId: string;
  idempotencyKey: string;
}): Promise<void> {
  const { postId, body, clientTxId, idempotencyKey } = payload;
  try {
    await database.write(async () => {
      const outboxCollection = database.get<OutboxModel>('outbox');
      await outboxCollection.create((record) => {
        record.op = 'COMMENT';
        record.payload = { postId, body };
        record.clientTxId = clientTxId;
        record.idempotencyKey = idempotencyKey;
        record.createdAt = new Date();
        record.retries = 0;
        record.status = 'pending';
      });
    });
  } catch {
    const err = new Error('Failed to queue comment in outbox') as ErrorWithCode;
    err.code = OUTBOX_QUEUE_FAILED;
    throw err;
  }
}

// Optimistic update utilities
function createTempComment(postId: string, body: string): PostComment {
  const tempId = `temp-${uuidv4()}`;
  return {
    id: tempId,
    post_id: postId,
    user_id: 'temp-user', // Will be replaced with actual user_id
    body,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function optimisticallyAddComment(
  queryClient: ReturnType<typeof useQueryClient>,
  postId: string,
  tempComment: PostComment
): void {
  const previousComments = queryClient.getQueryData<
    PaginatedResponse<PostComment>
  >(['comments', postId]);

  if (previousComments) {
    queryClient.setQueryData<PaginatedResponse<PostComment>>(
      ['comments', postId],
      {
        ...previousComments,
        results: [...previousComments.results, tempComment],
        count: (previousComments.count || 0) + 1,
      }
    );
  } else {
    queryClient.setQueryData<PaginatedResponse<PostComment>>(
      ['comments', postId],
      {
        results: [tempComment],
        count: 1,
        next: null,
        previous: null,
      }
    );
  }
}

// Success handling utility
function replaceTempCommentWithServerComment(
  queryClient: ReturnType<typeof useQueryClient>,
  postId: string,
  context: { tempComment: PostComment; newComment: PostComment }
): void {
  const { tempComment, newComment } = context;
  const currentComments = queryClient.getQueryData<
    PaginatedResponse<PostComment>
  >(['comments', postId]);

  if (currentComments) {
    queryClient.setQueryData<PaginatedResponse<PostComment>>(
      ['comments', postId],
      {
        ...currentComments,
        results: currentComments.results.map((comment) =>
          comment.id === tempComment.id ? newComment : comment
        ),
      }
    );
  }
}

// Error handling utilities
function handleValidationError(
  queryClient: ReturnType<typeof useQueryClient>,
  postId: string,
  context: {
    error: ValidationError;
    previousComments?: PaginatedResponse<PostComment>;
  }
): void {
  const { error, previousComments } = context;
  if (previousComments) {
    queryClient.setQueryData(['comments', postId], previousComments);
  }

  showMessage({
    message: 'Invalid comment',
    description: error.message,
    type: 'danger',
    duration: 3000,
  });
}

function handleNetworkError(): void {
  showMessage({
    message: 'Comment queued for retry',
    description: 'Will automatically retry when connection is restored',
    type: 'warning',
    duration: 3000,
  });
}

/**
 * Optimistically create a comment
 */
export function useCreateComment() {
  const queryClient = useQueryClient();

  return useMutation<
    PostComment,
    Error,
    CreateCommentVariables,
    CreateCommentContext
  >({
    mutationFn: async ({ postId, body }) => {
      validateCommentBody(body);

      const idempotencyKey = uuidv4();
      const clientTxId = uuidv4();

      await queueCommentInOutbox({ postId, body, clientTxId, idempotencyKey });

      const comment = await apiClient.createComment(
        { post_id: postId, body },
        idempotencyKey,
        clientTxId
      );

      return comment;
    },

    onMutate: async ({ postId, body }) => {
      await queryClient.cancelQueries({ queryKey: ['comments', postId] });

      const previousComments = queryClient.getQueryData<
        PaginatedResponse<PostComment>
      >(['comments', postId]);
      const tempComment = createTempComment(postId, body);

      optimisticallyAddComment(queryClient, postId, tempComment);

      return { previousComments, tempComment };
    },

    onSuccess: (newComment, variables, context) => {
      if (context) {
        replaceTempCommentWithServerComment(queryClient, variables.postId, {
          tempComment: context.tempComment,
          newComment,
        });
      }
    },

    onError: (error, variables, context) => {
      if (error instanceof ValidationError) {
        handleValidationError(queryClient, variables.postId, {
          error,
          previousComments: context?.previousComments,
        });
      } else if (hasErrorCode(error, OUTBOX_QUEUE_FAILED)) {
        if (context?.previousComments) {
          queryClient.setQueryData(
            ['comments', variables.postId],
            context.previousComments
          );
        }
        showMessage({
          message: 'Could not save comment offline',
          description: 'Please try again.',
          type: 'danger',
          duration: 3000,
        });
      } else {
        handleNetworkError();
      }
    },

    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['comments', variables.postId],
      });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
  });
}
