import { useQuery } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { createMutation, createQuery } from 'react-query-kit';

import { type ConflictError, getCommunityApiClient } from './client';
import type {
  CreatePostData,
  DeleteResponse,
  PaginatedResponse,
  Post,
  PostComment,
  UserProfile,
} from './types';

export * from './client';
export * from './types';
export * from './use-create-comment';
export * from './use-delete-comment';
export * from './use-like-post';
export * from './use-unlike-post';
export * from './use-user-posts';

// Resolve client on-demand to pick up resets in tests and env switches

// ==================== Post Queries ====================

export const usePost = createQuery<Post, { postId: string }, AxiosError>({
  queryKey: ['post', 'postId'],
  fetcher: ({ postId }) => getCommunityApiClient().getPost(postId),
});

export const usePosts = ({
  cursor,
  limit,
}: { cursor?: string; limit?: number } = {}) => {
  return useQuery<PaginatedResponse<Post>, AxiosError>({
    queryKey: ['posts', cursor, limit],
    queryFn: () => getCommunityApiClient().getPosts(cursor, limit),
  });
};

export const useUserProfile = createQuery<
  UserProfile,
  { userId: string },
  AxiosError
>({
  queryKey: ['user-profile'],
  fetcher: ({ userId }) => getCommunityApiClient().getUserProfile(userId),
});

// ==================== Comment Queries ====================

export const useComments = ({
  postId,
  cursor,
  limit,
}: {
  postId: string;
  cursor?: string;
  limit?: number;
}) => {
  return useQuery<PaginatedResponse<PostComment>, AxiosError>({
    queryKey: ['comments', postId, cursor, limit],
    queryFn: () => getCommunityApiClient().getComments(postId, cursor, limit),
  });
};

// ==================== Post Mutations ====================

export const useCreatePost = createMutation<
  Post,
  {
    data: CreatePostData;
    idempotencyKey?: string;
    clientTxId?: string;
  },
  AxiosError
>({
  mutationFn: ({ data, idempotencyKey, clientTxId }) =>
    getCommunityApiClient().createPost(data, idempotencyKey, clientTxId),
});

export const useDeletePost = createMutation<
  DeleteResponse,
  {
    postId: string;
    idempotencyKey?: string;
    clientTxId?: string;
  },
  AxiosError
>({
  mutationFn: ({ postId, idempotencyKey, clientTxId }) =>
    getCommunityApiClient().deletePost(postId, idempotencyKey, clientTxId),
});

export const useUndoDeletePost = createMutation<
  Post,
  {
    postId: string;
    idempotencyKey?: string;
    clientTxId?: string;
  },
  AxiosError | ConflictError
>({
  mutationFn: ({ postId, idempotencyKey, clientTxId }) =>
    getCommunityApiClient().undoDeletePost(postId, idempotencyKey, clientTxId),
});

// ==================== Like Mutations ====================
// NOTE: useLikePost and useUnlikePost are exported from ./use-like-post and ./use-unlike-post with optimistic updates

// ==================== Comment Mutations ====================
// NOTE: useCreateComment and useDeleteComment are exported from their respective files with optimistic updates

export const useUndoDeleteComment = createMutation<
  PostComment,
  {
    commentId: string;
    idempotencyKey?: string;
    clientTxId?: string;
  },
  AxiosError | ConflictError
>({
  mutationFn: ({ commentId, idempotencyKey, clientTxId }) =>
    getCommunityApiClient().undoDeleteComment(
      commentId,
      idempotencyKey,
      clientTxId
    ),
});
