-- Migration: Create posts table with moderation columns
-- Description: Core table for community posts with soft delete and moderation support
-- Requirements: 1.5, 1.6, 2.5, 2.6, 4.5, 4.6, 9.1, 9.2, 10.1

CREATE TABLE IF NOT EXISTS public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  image_url TEXT,
  like_count INTEGER DEFAULT 0 NOT NULL,
  comment_count INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  deleted_at TIMESTAMPTZ,
  hidden_at TIMESTAMPTZ,
  moderation_reason TEXT,
  undo_expires_at TIMESTAMPTZ
);

-- Enable Row Level Security
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- Add comments for documentation
COMMENT ON TABLE public.posts IS 'Community posts with soft delete and moderation support';
COMMENT ON COLUMN public.posts.deleted_at IS 'Soft delete timestamp - set when user deletes post';
COMMENT ON COLUMN public.posts.hidden_at IS 'Moderation timestamp - set when moderator hides post';
COMMENT ON COLUMN public.posts.moderation_reason IS 'Reason provided by moderator when hiding content';
COMMENT ON COLUMN public.posts.undo_expires_at IS 'Server-owned 15s undo timer for delete operations';
