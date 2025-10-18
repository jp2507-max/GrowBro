/**
 * Community feed type definitions
 */

export type OutboxOperation =
  | 'LIKE'
  | 'UNLIKE'
  | 'COMMENT'
  | 'DELETE_POST'
  | 'DELETE_COMMENT'
  | 'UNDO_DELETE_POST'
  | 'UNDO_DELETE_COMMENT'
  | 'MODERATE_CONTENT';

export type OutboxStatus = 'pending' | 'failed' | 'confirmed';

export interface Post {
  id: string;
  userId: string;
  /** @deprecated Use userId instead. This field will be removed in a future version. */
  user_id?: string;
  body: string;
  media_uri?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  hidden_at?: string;
  moderation_reason?: string;
  undo_expires_at?: string;
  // Derived UI-only fields (not persisted)
  like_count?: number;
  comment_count?: number;
  user_has_liked?: boolean;
}

export interface PostComment {
  id: string;
  post_id: string;
  user_id: string;
  body: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  hidden_at?: string;
  undo_expires_at?: string;
}

export interface PostLike {
  post_id: string;
  user_id: string;
  created_at: string;
}

export interface OutboxEntry {
  id: string;
  op: OutboxOperation;
  payload: string; // JSON string
  client_tx_id: string;
  idempotency_key: string;
  created_at: number;
  retries: number;
  next_retry_at?: number;
  status: OutboxStatus;
}

export interface OutboxPayload {
  [key: string]: any;
}

// Supabase Realtime event types
export interface RealtimeEvent<T> {
  schema: 'public';
  table: 'posts' | 'post_comments' | 'post_likes';
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  commit_timestamp: string;
  new: T | null;
  old: Partial<T> | null;
  client_tx_id?: string;
}

// API request/response types
export interface CreatePostData {
  body: string;
  media_uri?: string;
}

export interface CreateCommentData {
  post_id: string;
  body: string;
}

export interface CursorPaginatedResponse<T> {
  data: T[];
  cursor?: string;
  hasMore: boolean;
}
