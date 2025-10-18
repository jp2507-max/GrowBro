export type Post = {
  userId: number | string;
  id: number | string;
  title?: string;
  body: string;
  // Community feed fields
  user_id?: string;
  media_uri?: string;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string;
  hidden_at?: string;
  moderation_reason?: string;
  undo_expires_at?: string;
  // Derived UI-only fields
  like_count?: number;
  comment_count?: number;
  user_has_liked?: boolean;
};
