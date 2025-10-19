// Community feed API types
import type { PaginateQuery } from '@/api/types';
import type {
  CreatePostData,
  Post,
  PostComment,
  PostLike,
} from '@/types/community';

// Re-export for convenience
export type { Post, PostComment, PostLike };

export type OutboxEntry = {
  id: string;
  op: 'LIKE' | 'UNLIKE' | 'COMMENT' | 'DELETE_POST' | 'DELETE_COMMENT';
  payload: any;
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

export type CreateCommentData = {
  postId: string;
  body: string;
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
  details?: any;
};

// Idempotency key record
export type IdempotencyKey = {
  id: string;
  idempotency_key: string;
  client_tx_id: string;
  user_id: string;
  endpoint: string;
  payload_hash: string;
  response_payload?: any;
  error_details?: any;
  status: 'completed' | 'processing' | 'failed';
  created_at: string;
  expires_at: string;
};

// Community API interface
export interface CommunityAPI {
  // Posts
  getPost(postId: string): Promise<Post>;
  getPosts(cursor?: string, limit?: number): Promise<PaginateQuery<Post>>;
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
  getUserPosts(
    userId: string,
    cursor?: string,
    limit?: number
  ): Promise<PaginateQuery<Post>>;
}
