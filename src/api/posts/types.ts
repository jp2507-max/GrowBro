export type Post = {
  userId: number | string;
  id: number | string;
  title?: string;
  body: string;
  // Community feed fields
  /** @deprecated Use userId instead. This field will be removed in a future version. */
  user_id?: string;
  media_uri?: string;
  media_resized_uri?: string;
  media_thumbnail_uri?: string;
  media_blurhash?: string;
  media_thumbhash?: string;
  media_width?: number;
  media_height?: number;
  media_aspect_ratio?: number;
  media_bytes?: number;
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
  // Age-gating fields (DSA Art. 28)
  is_age_restricted?: boolean;
};
