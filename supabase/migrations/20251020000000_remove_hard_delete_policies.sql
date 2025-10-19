-- Migration: Remove hard DELETE policies to enforce soft delete
-- Description: Remove DELETE policies from posts and post_comments tables to prevent permanent deletion
-- Requirements: 1.5, 1.6, 2.5, 2.6, 4.5, 4.6, 9.1, 9.2, 10.1
-- Dependencies: Requires posts and post_comments tables with existing RLS policies

-- Remove DELETE policy from posts table
DROP POLICY IF EXISTS "Users can delete their own posts" ON public.posts;

-- Remove DELETE policy from post_comments table
DROP POLICY IF EXISTS "Users can delete their own comments" ON public.post_comments;

-- Add comments documenting the soft delete requirement
COMMENT ON TABLE public.posts IS 'Community posts with soft delete and moderation support. Use soft_delete_post RPC function for deletion.';
COMMENT ON TABLE public.post_comments IS 'Comments on community posts with soft delete support. Use soft_delete_comment RPC function for deletion.';
