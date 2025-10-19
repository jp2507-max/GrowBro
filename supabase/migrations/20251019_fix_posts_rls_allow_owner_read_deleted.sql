-- Migration: Fix posts RLS to allow owners to read their own soft-deleted posts
-- Description: Add policy allowing post owners to read their own soft-deleted posts for undo functionality
-- Requirements: 1.5, 1.6, 2.5, 2.6, 4.5, 4.6, 9.1, 9.2, 10.1
-- Dependencies: Requires posts table and existing RLS policies

-- Allow owners to read their own soft-deleted posts (for undo functionality)
CREATE POLICY "Owners can view their own deleted posts" ON public.posts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id AND deleted_at IS NOT NULL);

COMMENT ON POLICY "Owners can view their own deleted posts" ON public.posts IS
  'Allows post owners to read their own soft-deleted posts for undo functionality within the 15-second window.';
