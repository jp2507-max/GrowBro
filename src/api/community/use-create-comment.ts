/**
 * useCreateComment hook
 *
 * Optimistic mutation for creating comments with:
 * - Temp local ID with pending status
 * - Offline queue support
 * - Server ID replacement on success
 * - Pending retry UI on failure
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
import { translate, type TxKeyPath } from '@/lib/i18n';
import { database } from '@/lib/watermelon';
import type { OutboxModel } from '@/lib/watermelon-models/outbox';
import type { PostComment } from '@/types/community';

import { getCommunityApiClient, ValidationError } from './client';

const apiClient = getCommunityApiClient();

interface CreateCommentVariables {
  postId: string;
  body: string;
}

interface CreateCommentContext {
  previousComments?: [QueryKey, PaginateQuery<PostComment> | undefined][];
  tempComment: PostComment;
}

// Validation utilities
function validateCommentBody(body: string): void {
  if (!body || body.trim().length === 0) {
    throw new ValidationError('community.comment_body_empty');
  }

  if (body.length > 500) {
    throw new ValidationError('community.comment_too_long');
  }
}

const OUTBOX_QUEUE_FAILED = 'OUTBOX_QUEUE_FAILED' as const;
type ErrorWithCode = Error & { code?: string };

function hasErrorCode(e: unknown, code: string): e is ErrorWithCode {
  return (
    !!e &&
    typeof e === 'object' &&
    'code' in e &&
    (e as Record<string, unknown>).code === code
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
  const tempId = `temp-${randomUUID()}`;
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
  queryClient.setQueriesData<PaginateQuery<PostComment>>(
    {
      predicate: (query) =>
        isCommunityCommentsKey(query.queryKey) && query.queryKey[1] === postId,
    },
    (previousComments) => {
      if (previousComments) {
        return {
          ...previousComments,
          results: [...previousComments.results, tempComment],
          count: (previousComments.count || 0) + 1,
        };
      }

      return {
        results: [tempComment],
        count: 1,
        next: null,
        previous: null,
      };
    }
  );
}

// Success handling utility
function replaceTempCommentWithServerComment(
  queryClient: ReturnType<typeof useQueryClient>,
  postId: string,
  context: { tempComment: PostComment; newComment: PostComment }
): void {
  const { tempComment, newComment } = context;
  queryClient.setQueriesData<PaginateQuery<PostComment>>(
    {
      predicate: (query) =>
        isCommunityCommentsKey(query.queryKey) && query.queryKey[1] === postId,
    },
    (currentComments) => {
      if (!currentComments) return currentComments;
      return {
        ...currentComments,
        results: currentComments.results.map((comment) =>
          comment.id === tempComment.id ? newComment : comment
        ),
      };
    }
  );
}

// Error handling utilities
function handleValidationError(
  queryClient: ReturnType<typeof useQueryClient>,
  postId: string,
  context: {
    error: ValidationError;
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
    message: translate('community.invalid_comment'),
    description: translate(error.message as TxKeyPath),
    type: 'danger',
    duration: 3000,
  });
}

function handleNetworkError(): void {
  showMessage({
    message: translate('community.comment_queued'),
    description: translate('community.comment_queued_description'),
    type: 'warning',
    duration: 3000,
  });
}

function handleOutboxQueueError(
  context: CreateCommentContext | undefined,
  queryClient: ReturnType<typeof useQueryClient>
): void {
  if (context?.previousComments) {
    context.previousComments.forEach(([key, data]) => {
      queryClient.setQueryData(key, data);
    });
  }
  showMessage({
    message: translate('community.comment_offline_failed'),
    description: translate('community.comment_offline_failed_description'),
    type: 'danger',
    duration: 3000,
  });
}

function invalidateCommentRelatedQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  postId: string
): void {
  queryClient.invalidateQueries({
    predicate: (query) =>
      isCommunityCommentsKey(query.queryKey) && query.queryKey[1] === postId,
  });
  queryClient.invalidateQueries({
    predicate: (query) => isCommunityPostsInfiniteKey(query.queryKey),
  });
  queryClient.invalidateQueries({
    predicate: (query) => isCommunityUserPostsKey(query.queryKey),
  });
  queryClient.invalidateQueries({
    queryKey: communityPostKey(postId),
  });
}

/**
 * Optimistically create a comment
 */
export function useCreateComment(): UseMutationResult<
  PostComment,
  Error,
  CreateCommentVariables,
  CreateCommentContext
> {
  const queryClient = useQueryClient();

  return useMutation<
    PostComment,
    Error,
    CreateCommentVariables,
    CreateCommentContext
  >({
    mutationFn: async ({ postId, body }): Promise<PostComment> => {
      validateCommentBody(body);
      const idempotencyKey = randomUUID();
      const clientTxId = randomUUID();
      await queueCommentInOutbox({ postId, body, clientTxId, idempotencyKey });
      return apiClient.createComment(
        { postId, body },
        idempotencyKey,
        clientTxId
      );
    },

    onMutate: async ({ postId, body }): Promise<CreateCommentContext> => {
      await queryClient.cancelQueries({
        predicate: (query) =>
          isCommunityCommentsKey(query.queryKey) &&
          query.queryKey[1] === postId,
      });
      const previousComments = queryClient.getQueriesData<
        PaginateQuery<PostComment>
      >({
        predicate: (query) =>
          isCommunityCommentsKey(query.queryKey) &&
          query.queryKey[1] === postId,
      });
      const tempComment = createTempComment(postId, body);
      optimisticallyAddComment(queryClient, postId, tempComment);
      return { previousComments, tempComment };
    },

    onSuccess: (newComment, variables, context): void => {
      if (context) {
        replaceTempCommentWithServerComment(queryClient, variables.postId, {
          tempComment: context.tempComment,
          newComment,
        });
      }
    },

    onError: (error, variables, context): void => {
      if (error instanceof ValidationError) {
        handleValidationError(queryClient, variables.postId, {
          error,
          previousComments: context?.previousComments,
        });
      } else if (hasErrorCode(error, OUTBOX_QUEUE_FAILED)) {
        handleOutboxQueueError(context, queryClient);
      } else {
        handleNetworkError();
      }
    },

    onSettled: (_data, _error, variables): void => {
      invalidateCommentRelatedQueries(queryClient, variables.postId);
    },
  });
}
