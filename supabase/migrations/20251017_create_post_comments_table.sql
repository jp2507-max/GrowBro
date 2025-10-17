-- Migration: Create post_comments table
-- Description: Comments for community posts with soft delete and undo support
-- Requirements: 1.5, 1.6, 2.5, 2.6, 4.5, 4.6

CREATE TABLE IF NOT EXISTS public.post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  deleted_at TIMESTAMPTZ,
  hidden_at TIMESTAMPTZ,
  undo_expires_at TIMESTAMPTZ
);

-- Enable Row Level Security
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

-- Add comments for documentation
COMMENT ON TABLE public.post_comments IS 'Comments on community posts with soft delete support';
COMMENT ON COLUMN public.post_comments.deleted_at IS 'Soft delete timestamp - set when user deletes comment';
COMMENT ON COLUMN public.post_comments.hidden_at IS 'Moderation timestamp - set when moderator hides comment';
COMMENT ON COLUMN public.post_comments.undo_expires_at IS 'Server-owned 15s undo timer for delete operations';
