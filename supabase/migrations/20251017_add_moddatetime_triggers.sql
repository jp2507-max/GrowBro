-- Migration: Add moddatetime triggers for LWW conflict resolution
-- Description: Automatically update updated_at timestamps for reliable Last-Write-Wins
-- Requirements: 3.5, 3.6 (LWW conflict resolution)

-- Enable the moddatetime extension if not already enabled
CREATE EXTENSION IF NOT EXISTS moddatetime SCHEMA extensions;

-- Add trigger for posts table
DROP TRIGGER IF EXISTS handle_updated_at ON public.posts;
CREATE TRIGGER handle_updated_at 
  BEFORE UPDATE ON public.posts
  FOR EACH ROW 
  EXECUTE PROCEDURE extensions.moddatetime(updated_at);

-- Add trigger for post_comments table
DROP TRIGGER IF EXISTS handle_updated_at ON public.post_comments;
CREATE TRIGGER handle_updated_at
  BEFORE UPDATE ON public.post_comments
  FOR EACH ROW
  EXECUTE PROCEDURE extensions.moddatetime(updated_at);

-- Add comments for documentation
COMMENT ON TRIGGER handle_updated_at ON public.posts IS 'Auto-updates updated_at for LWW conflict resolution';
COMMENT ON TRIGGER handle_updated_at ON public.post_comments IS 'Auto-updates updated_at for LWW conflict resolution';