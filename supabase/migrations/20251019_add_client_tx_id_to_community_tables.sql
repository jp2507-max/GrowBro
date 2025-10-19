-- Migration: Add client_tx_id columns to community tables
-- Description: Adds nullable client_tx_id columns to posts, post_comments, and post_likes tables for self-echo confirmation
-- Requirements: 3.6 (Self-echo detection using client_tx_id matching)

-- Add client_tx_id to posts table
ALTER TABLE public.posts
ADD COLUMN IF NOT EXISTS client_tx_id TEXT;

-- Add client_tx_id to post_comments table
ALTER TABLE public.post_comments
ADD COLUMN IF NOT EXISTS client_tx_id TEXT;

-- Add client_tx_id to post_likes table
ALTER TABLE public.post_likes
ADD COLUMN IF NOT EXISTS client_tx_id TEXT;

-- Add indexes for efficient client_tx_id lookups (used by outbox confirmation)
CREATE INDEX IF NOT EXISTS idx_posts_client_tx_id ON public.posts(client_tx_id) WHERE client_tx_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_post_comments_client_tx_id ON public.post_comments(client_tx_id) WHERE client_tx_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_post_likes_client_tx_id ON public.post_likes(client_tx_id) WHERE client_tx_id IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.posts.client_tx_id IS 'Client-generated transaction ID for self-echo detection and outbox confirmation';
COMMENT ON COLUMN public.post_comments.client_tx_id IS 'Client-generated transaction ID for self-echo detection and outbox confirmation';
COMMENT ON COLUMN public.post_likes.client_tx_id IS 'Client-generated transaction ID for self-echo detection and outbox confirmation';
