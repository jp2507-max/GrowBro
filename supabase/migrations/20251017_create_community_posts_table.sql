-- Migration: Create posts table with moderation columns
-- Description: Core table for community posts with soft delete and moderation support
-- Requirements: 1.5, 1.6, 2.5, 2.6, 4.5, 4.6, 9.1, 9.2, 10.1

CREATE TABLE IF NOT EXISTS public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  media_uri TEXT,
  like_count INTEGER DEFAULT 0 NOT NULL,
  comment_count INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  deleted_at TIMESTAMPTZ,
  hidden_at TIMESTAMPTZ,
  moderation_reason TEXT,
  undo_expires_at TIMESTAMPTZ
);

-- Indexes for efficient feed queries and user post performance
CREATE INDEX idx_posts_created_at_desc ON public.posts (created_at DESC);
CREATE INDEX idx_posts_user_id ON public.posts (user_id);
CREATE INDEX idx_posts_visible_created_at_desc ON public.posts (created_at DESC)
WHERE deleted_at IS NULL AND hidden_at IS NULL;

-- Enable Row Level Security
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate with performance optimizations
DROP POLICY IF EXISTS "Users can view visible posts" ON public.posts;
DROP POLICY IF EXISTS "Users can create their own posts" ON public.posts;
DROP POLICY IF EXISTS "Users can update their own posts" ON public.posts;
DROP POLICY IF EXISTS "Users can delete their own posts" ON public.posts;
DROP POLICY IF EXISTS "Posts are viewable by everyone" ON public.posts;
DROP POLICY IF EXISTS "Users can insert their own posts" ON public.posts;

-- RLS Policies for authenticated users (optimized for performance)
-- Allow SELECT only for visible posts (not deleted or hidden)
CREATE POLICY "Users can view visible posts" ON public.posts
  FOR SELECT USING ((select auth.uid()) IS NOT NULL AND deleted_at IS NULL AND hidden_at IS NULL);

-- Allow INSERT only for authenticated users, ensuring user_id matches auth.uid()
CREATE POLICY "Users can create their own posts" ON public.posts
  FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL AND user_id = (select auth.uid()));

-- Allow UPDATE only for the post owner
CREATE POLICY "Users can update their own posts" ON public.posts
  FOR UPDATE USING ((select auth.uid()) IS NOT NULL AND user_id = (select auth.uid()));

-- Allow DELETE only for the post owner
CREATE POLICY "Users can delete their own posts" ON public.posts
  FOR DELETE USING ((select auth.uid()) IS NOT NULL AND user_id = (select auth.uid()));

-- Ensure updated_at trigger is created idempotently
DROP TRIGGER IF EXISTS trg_posts_updated_at ON public.posts;
CREATE TRIGGER trg_posts_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Add comments for documentation
COMMENT ON TABLE public.posts IS 'Community posts with soft delete and moderation support';
COMMENT ON COLUMN public.posts.deleted_at IS 'Soft delete timestamp - set when user deletes post';
COMMENT ON COLUMN public.posts.hidden_at IS 'Moderation timestamp - set when moderator hides post';
COMMENT ON COLUMN public.posts.moderation_reason IS 'Reason provided by moderator when hiding content';
COMMENT ON COLUMN public.posts.undo_expires_at IS 'Server-owned 15s undo timer for delete operations';
