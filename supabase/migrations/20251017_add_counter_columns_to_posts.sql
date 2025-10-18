-- Migration: Add counter columns to posts table
-- Description: Adds like_count and comment_count columns for cached counters
-- Requirements: 1.5, 1.6 (data consistency)

ALTER TABLE public.posts
ADD COLUMN IF NOT EXISTS like_count INTEGER DEFAULT 0 NOT NULL;

ALTER TABLE public.posts
ADD COLUMN IF NOT EXISTS comment_count INTEGER DEFAULT 0 NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.posts.like_count IS 'Cached count of likes - maintained by triggers';
COMMENT ON COLUMN public.posts.comment_count IS 'Cached count of comments - maintained by triggers';
