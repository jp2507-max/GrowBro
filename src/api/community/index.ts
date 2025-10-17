import type { AxiosError } from 'axios';
import { createMutation, createQuery } from 'react-query-kit';

import { type ConflictError, getCommunityApiClient } from './client';
import type {
  CreateCommentData,
  CreatePostData,
  DeleteResponse,
  PaginatedResponse,
  Post,
  PostComment,
  UserProfile,
} from './types';

export * from './client';
export * from './types';

const apiClient = getCommunityApiClient();

// ==================== Post Queries ====================

export const usePost = createQuery<Post, { postId: string }, AxiosError>({
  queryKey: ['post'],
  fetcher: ({ postId }) => apiClient.getPost(postId),
});

export const usePosts = createQuery<
  PaginatedResponse<Post>,
  { cursor?: string; limit?: number },
  AxiosError
>({
  queryKey: ['posts'],
  fetcher: ({ cursor, limit }) => apiClient.getPosts(cursor, limit),
});

export const useUserProfile = createQuery<
  UserProfile,
  { userId: string },
  AxiosError
>({
  queryKey: ['user-profile'],
  fetcher: ({ userId }) => apiClient.getUserProfile(userId),
});

export const useUserPosts = createQuery<
  PaginatedResponse<Post>,
  { userId: string; cursor?: string; limit?: number },
  AxiosError
>({
  queryKey: ['user-posts'],
  fetcher: ({ userId, cursor, limit }) =>
    apiClient.getUserPosts(userId, cursor, limit),
});

// ==================== Comment Queries ====================

export const useComments = createQuery<
  PaginatedResponse<PostComment>,
  { postId: string; cursor?: string; limit?: number },
  AxiosError
>({
  queryKey: ['comments'],
  fetcher: ({ postId, cursor, limit }) =>
    apiClient.getComments(postId, cursor, limit),
});

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
    apiClient.createPost(data, idempotencyKey, clientTxId),
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
    apiClient.deletePost(postId, idempotencyKey, clientTxId),
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
    apiClient.undoDeletePost(postId, idempotencyKey, clientTxId),
});

// ==================== Like Mutations ====================

export const useLikePost = createMutation<
  void,
  {
    postId: string;
    idempotencyKey?: string;
    clientTxId?: string;
  },
  AxiosError
>({
  mutationFn: ({ postId, idempotencyKey, clientTxId }) =>
    apiClient.likePost(postId, idempotencyKey, clientTxId),
});

export const useUnlikePost = createMutation<
  void,
  {
    postId: string;
    idempotencyKey?: string;
    clientTxId?: string;
  },
  AxiosError
>({
  mutationFn: ({ postId, idempotencyKey, clientTxId }) =>
    apiClient.unlikePost(postId, idempotencyKey, clientTxId),
});

// ==================== Comment Mutations ====================

export const useCreateComment = createMutation<
  PostComment,
  {
    data: CreateCommentData;
    idempotencyKey?: string;
    clientTxId?: string;
  },
  AxiosError
>({
  mutationFn: ({ data, idempotencyKey, clientTxId }) =>
    apiClient.createComment(data, idempotencyKey, clientTxId),
});

export const useDeleteComment = createMutation<
  DeleteResponse,
  {
    commentId: string;
    idempotencyKey?: string;
    clientTxId?: string;
  },
  AxiosError
>({
  mutationFn: ({ commentId, idempotencyKey, clientTxId }) =>
    apiClient.deleteComment(commentId, idempotencyKey, clientTxId),
});

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
    apiClient.undoDeleteComment(commentId, idempotencyKey, clientTxId),
});
