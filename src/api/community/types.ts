// Community feed API types
import type { PaginateQuery } from '@/api/types';
import type {
  CreateCommentData,
  CreatePostData,
  Post,
  PostComment,
  PostLike,
} from '@/types/community';

export type CommunityPostSort = 'new' | 'top_7d';

export type CommunityPostsDiscoverParams = {
  query?: string;
  cursor?: string;
  limit?: number;
  sort?: CommunityPostSort;
  photosOnly?: boolean;
  mineOnly?: boolean;
  category?: string | null;
};

// Re-export for convenience
export type { PaginateQuery };

// Backwards-compatible alias: some code/tests expect "PaginatedResponse<T>"
// Historically this project used the name `PaginatedResponse`; provide a
// lightweight alias to avoid widespread changes.
export type PaginatedResponse<T> = PaginateQuery<T>;

// Re-export other community types for convenience
// Re-export other community types for convenience
export type { CreateCommentData, CreatePostData, Post, PostComment, PostLike };

export type OutboxEntry = {
  id: string;
  op: 'LIKE' | 'UNLIKE' | 'COMMENT' | 'DELETE_POST' | 'DELETE_COMMENT';
  payload: Record<string, unknown>;
  client_tx_id: string;
  idempotency_key: string;
  created_at: string;
  retries: number;
  next_retry_at?: string;
  status: 'pending' | 'failed' | 'processed';
};

export type UserProfile = {
  id: string;
  username: string;
  avatar_url?: string;
  bio?: string;
  created_at: string;
};

export type DeleteResponse = {
  undo_expires_at: string;
};

export type ConflictResponse = {
  post_id?: string;
  user_id?: string;
  like_id?: string;
  exists: boolean;
  updated_at: string;
  message: string;
};

// API error types
export type ApiError = {
  message: string;
  code?: string;
  status?: number;
  details?: unknown;
};

// Idempotency key record
export type IdempotencyKey = {
  id: string;
  idempotency_key: string;
  client_tx_id: string;
  user_id: string;
  endpoint: string;
  payload_hash: string;
  response_payload?: unknown;
  error_details?: unknown;
  status: 'completed' | 'processing' | 'failed';
  created_at: string;
  expires_at: string;
};

// Community API interface
export interface CommunityAPI {
  // Posts
  getPost(postId: string): Promise<Post>;
  getPosts(cursor?: string, limit?: number): Promise<PaginateQuery<Post>>;
  getPostsDiscover(
    params: CommunityPostsDiscoverParams
  ): Promise<PaginateQuery<Post>>;
  createPost(
    data: CreatePostData,
    idempotencyKey?: string,
    clientTxId?: string
  ): Promise<Post>;
  deletePost(
    postId: string,
    idempotencyKey?: string,
    clientTxId?: string
  ): Promise<DeleteResponse>;
  undoDeletePost(
    postId: string,
    idempotencyKey?: string,
    clientTxId?: string
  ): Promise<Post>;

  // Likes
  likePost(
    postId: string,
    idempotencyKey?: string,
    clientTxId?: string
  ): Promise<void>;
  unlikePost(
    postId: string,
    idempotencyKey?: string,
    clientTxId?: string
  ): Promise<void>;

  // Comments
  getComments(
    postId: string,
    cursor?: string,
    limit?: number
  ): Promise<PaginateQuery<PostComment>>;
  createComment(
    data: CreateCommentData,
    idempotencyKey?: string,
    clientTxId?: string
  ): Promise<PostComment>;
  deleteComment(
    commentId: string,
    idempotencyKey?: string,
    clientTxId?: string
  ): Promise<DeleteResponse>;
  undoDeleteComment(
    commentId: string,
    idempotencyKey?: string,
    clientTxId?: string
  ): Promise<PostComment>;

  // Profiles
  getUserProfile(userId: string): Promise<UserProfile>;
  getUserProfiles(userIds: string[]): Promise<UserProfile[]>;
  getUserPosts(
    userId: string,
    cursor?: string,
    limit?: number
  ): Promise<PaginateQuery<Post>>;
}
