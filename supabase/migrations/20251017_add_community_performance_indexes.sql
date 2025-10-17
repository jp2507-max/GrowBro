-- Migration: Add performance indexes for community tables
-- Description: Partial indexes for efficient queries on non-deleted content
-- Requirements: Performance optimization for default reads
-- NOTE: Run AFTER the posts migration that adds deleted_at/hidden_at/moderation_reason

-- Index for feed queries (most recent posts, excluding deleted/hidden)
CREATE INDEX IF NOT EXISTS idx_posts_created_at 
  ON public.posts (created_at DESC)
  WHERE deleted_at IS NULL AND hidden_at IS NULL;

-- Index for user profile queries (user's posts, most recent first)
CREATE INDEX IF NOT EXISTS idx_posts_user_created 
  ON public.posts (user_id, created_at DESC)
  WHERE deleted_at IS NULL AND hidden_at IS NULL;

-- Index for comment queries on a post
CREATE INDEX IF NOT EXISTS idx_post_comments_post_created 
  ON public.post_comments (post_id, created_at)
  WHERE deleted_at IS NULL AND hidden_at IS NULL;

-- Realtime subscription indexes (for LWW conflict resolution)
CREATE INDEX IF NOT EXISTS idx_posts_updated_at 
  ON public.posts (updated_at);

CREATE INDEX IF NOT EXISTS idx_post_comments_updated_at 
  ON public.post_comments (updated_at);

CREATE INDEX IF NOT EXISTS idx_post_likes_updated_at 
  ON public.post_likes (updated_at);

-- Counter optimization indexes
CREATE INDEX IF NOT EXISTS idx_post_likes_post 
  ON public.post_likes (post_id);

CREATE INDEX IF NOT EXISTS idx_post_comments_post 
  ON public.post_comments (post_id)
  WHERE deleted_at IS NULL AND hidden_at IS NULL;

-- Add comments for documentation
COMMENT ON INDEX public.idx_posts_created_at IS 'Optimized feed queries - excludes soft-deleted and hidden posts';
COMMENT ON INDEX public.idx_posts_user_created IS 'Optimized user profile queries - user posts sorted by recency';
COMMENT ON INDEX public.idx_post_comments_post_created IS 'Optimized comment list queries for a post';
COMMENT ON INDEX public.idx_posts_updated_at IS 'Supports LWW conflict resolution via updated_at timestamp';
COMMENT ON INDEX public.idx_post_comments_updated_at IS 'Supports LWW conflict resolution via updated_at timestamp';
COMMENT ON INDEX public.idx_post_likes_updated_at IS 'Supports realtime subscription and LWW resolution';
