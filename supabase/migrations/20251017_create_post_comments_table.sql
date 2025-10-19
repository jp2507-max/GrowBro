-- Migration: Create post_comments table
-- Description: Comments for community posts with soft delete and undo support
-- Requirements: 1.5, 1.6, 2.5, 2.6, 4.5, 4.6

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS public.post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  deleted_at TIMESTAMPTZ,
  hidden_at TIMESTAMPTZ,
  undo_expires_at TIMESTAMPTZ
);

-- Create trigger to automatically update updated_at on row updates
DROP TRIGGER IF EXISTS trg_post_comments_updated_at ON public.post_comments;
CREATE TRIGGER trg_post_comments_updated_at
  BEFORE UPDATE ON public.post_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Create indexes for efficient FK lookups and ordering
CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON public.post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_user_id ON public.post_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_created_at ON public.post_comments(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- POST_COMMENTS TABLE POLICIES
-- ============================================================================

-- Public read access for non-deleted, non-hidden comments
CREATE POLICY "Comments are viewable by everyone" ON public.post_comments
  FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL AND hidden_at IS NULL);

-- Users can insert their own comments
CREATE POLICY "Users can insert their own comments" ON public.post_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own comments (content only)
CREATE POLICY "Users can update their own comments" ON public.post_comments
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    -- Ensure users cannot set moderation fields
    AND hidden_at IS NULL
  );

-- Note: DELETE operations are not allowed. Use soft_delete_comment RPC function instead.

-- Moderators can hide comments
CREATE POLICY "Moderators can hide comments" ON public.post_comments
  FOR UPDATE
  TO authenticated
  USING (
    auth.jwt() ->> 'role' IN ('admin', 'moderator')
    OR (auth.jwt() -> 'app_metadata' -> 'roles')::jsonb ? 'moderator'
    OR (auth.jwt() -> 'app_metadata' -> 'roles')::jsonb ? 'admin'
  )
  WITH CHECK (
    (hidden_at IS NOT NULL)
    AND (
      auth.jwt() ->> 'role' IN ('admin', 'moderator')
      OR (auth.jwt() -> 'app_metadata' -> 'roles')::jsonb ? 'moderator'
      OR (auth.jwt() -> 'app_metadata' -> 'roles')::jsonb ? 'admin'
    )
  );

-- Add comments for documentation
COMMENT ON TABLE public.post_comments IS 'Comments on community posts with soft delete support';
COMMENT ON COLUMN public.post_comments.deleted_at IS 'Soft delete timestamp - set when user deletes comment';
COMMENT ON COLUMN public.post_comments.hidden_at IS 'Moderation timestamp - set when moderator hides comment';
COMMENT ON COLUMN public.post_comments.undo_expires_at IS 'Server-owned 15s undo timer for delete operations';
