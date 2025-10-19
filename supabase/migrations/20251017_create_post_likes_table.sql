-- Migration: Create post_likes table
-- Description: User likes for posts with unique constraint
-- Requirements: 1.5, 1.6, 1.7, 1.10

CREATE TABLE IF NOT EXISTS public.post_likes (
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (post_id, user_id)
);

-- Add unique constraint for enforcement (redundant with PK but explicit for clarity)
-- The PRIMARY KEY already enforces UNIQUE(post_id, user_id)

-- Enable Row Level Security
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- POST_LIKES TABLE POLICIES
-- ============================================================================

-- Public read access for all likes
CREATE POLICY "Likes are viewable by everyone" ON public.post_likes
  FOR SELECT
  TO authenticated
  USING (true);

-- Users can insert their own likes
CREATE POLICY "Users can insert their own likes" ON public.post_likes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own likes
CREATE POLICY "Users can delete their own likes" ON public.post_likes
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Add comments for documentation
COMMENT ON TABLE public.post_likes IS 'User likes for posts with unique constraint per user per post';
COMMENT ON CONSTRAINT post_likes_pkey ON public.post_likes IS 'Ensures one like per user per post - enforces Requirement 1.7';
