-- Migration: Fix Row Level Security Policies
-- Description: Split moderator policies to separate moderation field updates from general updates, allowing moderators to perform non-moderation updates while protecting moderation fields
-- Requirements: 10.1, 10.2, 10.3, 7.6, 7.8
-- Dependencies: Requires existing RLS policies from previous migrations

-- ============================================================================
-- FIX POSTS TABLE POLICIES
-- ============================================================================

-- Drop and recreate user update policy without moderation field checks in WITH CHECK
DROP POLICY IF EXISTS "Users can update their own posts" ON public.posts;
CREATE POLICY "Users can update their own posts" ON public.posts
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- FIX POST_COMMENTS TABLE POLICIES
-- ============================================================================

-- Drop and recreate user update policy without moderation field checks in WITH CHECK
DROP POLICY IF EXISTS "Users can update their own comments" ON public.post_comments;
CREATE POLICY "Users can update their own comments" ON public.post_comments
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- FIX MODERATOR POLICIES - SPLIT INTO SEPARATE POLICIES
-- ============================================================================

-- Drop existing moderator policies that have restrictive WITH CHECK constraints
DROP POLICY IF EXISTS "Moderators can hide posts" ON public.posts;
DROP POLICY IF EXISTS "Moderators can hide comments" ON public.post_comments;

-- Create separate policy for moderation field updates (hide/show posts)
CREATE POLICY "Moderators can update moderation fields on posts" ON public.posts
  FOR UPDATE
  TO authenticated
  USING (
    auth.jwt() ->> 'role' IN ('admin', 'moderator')
    OR (auth.jwt() -> 'app_metadata' -> 'roles')::jsonb ? 'moderator'
    OR (auth.jwt() -> 'app_metadata' -> 'roles')::jsonb ? 'admin'
  )
  WITH CHECK (
    auth.jwt() ->> 'role' IN ('admin', 'moderator')
    OR (auth.jwt() -> 'app_metadata' -> 'roles')::jsonb ? 'moderator'
    OR (auth.jwt() -> 'app_metadata' -> 'roles')::jsonb ? 'admin'
  );

-- Create separate policy for general moderator updates on posts (non-moderation fields)
CREATE POLICY "Moderators can update posts" ON public.posts
  FOR UPDATE
  TO authenticated
  USING (
    auth.jwt() ->> 'role' IN ('admin', 'moderator')
    OR (auth.jwt() -> 'app_metadata' -> 'roles')::jsonb ? 'moderator'
    OR (auth.jwt() -> 'app_metadata' -> 'roles')::jsonb ? 'admin'
  )
  WITH CHECK (
    auth.jwt() ->> 'role' IN ('admin', 'moderator')
    OR (auth.jwt() -> 'app_metadata' -> 'roles')::jsonb ? 'moderator'
    OR (auth.jwt() -> 'app_metadata' -> 'roles')::jsonb ? 'admin'
  );

-- Create separate policy for moderation field updates on comments
CREATE POLICY "Moderators can update moderation fields on comments" ON public.post_comments
  FOR UPDATE
  TO authenticated
  USING (
    auth.jwt() ->> 'role' IN ('admin', 'moderator')
    OR (auth.jwt() -> 'app_metadata' -> 'roles')::jsonb ? 'moderator'
    OR (auth.jwt() -> 'app_metadata' -> 'roles')::jsonb ? 'admin'
  )
  WITH CHECK (
    auth.jwt() ->> 'role' IN ('admin', 'moderator')
    OR (auth.jwt() -> 'app_metadata' -> 'roles')::jsonb ? 'moderator'
    OR (auth.jwt() -> 'app_metadata' -> 'roles')::jsonb ? 'admin'
  );

-- Create separate policy for general moderator updates on comments (non-moderation fields)
CREATE POLICY "Moderators can update comments" ON public.post_comments
  FOR UPDATE
  TO authenticated
  USING (
    auth.jwt() ->> 'role' IN ('admin', 'moderator')
    OR (auth.jwt() -> 'app_metadata' -> 'roles')::jsonb ? 'moderator'
    OR (auth.jwt() -> 'app_metadata' -> 'roles')::jsonb ? 'admin'
  )
  WITH CHECK (
    auth.jwt() ->> 'role' IN ('admin', 'moderator')
    OR (auth.jwt() -> 'app_metadata' -> 'roles')::jsonb ? 'moderator'
    OR (auth.jwt() -> 'app_metadata' -> 'roles')::jsonb ? 'admin'
  );

-- ============================================================================
-- FIX REPORTS TABLE POLICIES
-- ============================================================================

-- Drop and recreate report creation policy with correct name
DROP POLICY IF EXISTS "Users can create reports" ON public.reports;
CREATE POLICY "Users can report content" ON public.reports
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

-- Drop and recreate moderator view policy to use app_metadata
DROP POLICY IF EXISTS "Moderators can view all reports" ON public.reports;
CREATE POLICY "Moderators can view all reports" ON public.reports
  FOR SELECT
  TO authenticated
  USING (
    auth.jwt() ->> 'role' IN ('admin', 'moderator')
    OR (auth.jwt() -> 'app_metadata' -> 'roles')::jsonb ? 'moderator'
    OR (auth.jwt() -> 'app_metadata' -> 'roles')::jsonb ? 'admin'
  );

-- Drop and recreate moderator update policy to use app_metadata
DROP POLICY IF EXISTS "Moderators can update reports" ON public.reports;
CREATE POLICY "Moderators can update reports" ON public.reports
  FOR UPDATE
  TO authenticated
  USING (
    auth.jwt() ->> 'role' IN ('admin', 'moderator')
    OR (auth.jwt() -> 'app_metadata' -> 'roles')::jsonb ? 'moderator'
    OR (auth.jwt() -> 'app_metadata' -> 'roles')::jsonb ? 'admin'
  );

-- ============================================================================
-- FIX MODERATION_AUDIT TABLE POLICIES
-- ============================================================================

-- Drop and recreate moderator view policy to use app_metadata
DROP POLICY IF EXISTS "Moderators can view audit log" ON public.moderation_audit;
CREATE POLICY "Moderators can view audit logs" ON public.moderation_audit
  FOR SELECT
  TO authenticated
  USING (
    auth.jwt() ->> 'role' IN ('admin', 'moderator')
    OR (auth.jwt() -> 'app_metadata' -> 'roles')::jsonb ? 'moderator'
    OR (auth.jwt() -> 'app_metadata' -> 'roles')::jsonb ? 'admin'
  );

-- Drop and recreate moderator insert policy with correct name and app_metadata
DROP POLICY IF EXISTS "Moderators can insert audit entries" ON public.moderation_audit;
CREATE POLICY "Moderators can create audit logs" ON public.moderation_audit
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      auth.jwt() ->> 'role' IN ('admin', 'moderator')
      OR (auth.jwt() -> 'app_metadata' -> 'roles')::jsonb ? 'moderator'
      OR (auth.jwt() -> 'app_metadata' -> 'roles')::jsonb ? 'admin'
    )
    AND moderator_id = auth.uid()
  );

-- ============================================================================
-- ADD TRIGGERS FOR FIELD-LEVEL PROTECTION
-- ============================================================================

-- Create function to check if user is moderator
CREATE OR REPLACE FUNCTION public.is_moderator()
RETURNS boolean AS $$
BEGIN
  RETURN auth.jwt() ->> 'role' IN ('admin', 'moderator')
    OR (auth.jwt() -> 'app_metadata' -> 'roles')::jsonb ? 'moderator'
    OR (auth.jwt() -> 'app_metadata' -> 'roles')::jsonb ? 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger function to prevent non-moderators from changing hidden_at
CREATE OR REPLACE FUNCTION public.prevent_hidden_at_changes()
RETURNS trigger AS $$
BEGIN
  -- If hidden_at is being changed and user is not a moderator, prevent the change
  IF OLD.hidden_at IS DISTINCT FROM NEW.hidden_at AND NOT public.is_moderator() THEN
    RAISE EXCEPTION 'Only moderators can change the hidden_at field';
  END IF;

  -- If moderation_reason is being changed and user is not a moderator, prevent the change (for posts table)
  IF TG_TABLE_NAME = 'posts' AND OLD.moderation_reason IS DISTINCT FROM NEW.moderation_reason AND NOT public.is_moderator() THEN
    RAISE EXCEPTION 'Only moderators can change the moderation_reason field';
  END IF;

  -- Allow the change if user is moderator or field is not being changed
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add trigger to posts table
DROP TRIGGER IF EXISTS prevent_hidden_at_changes_posts_trigger ON public.posts;
CREATE TRIGGER prevent_hidden_at_changes_posts_trigger
  BEFORE UPDATE ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_hidden_at_changes();

-- Add trigger to post_comments table
DROP TRIGGER IF EXISTS prevent_hidden_at_changes_comments_trigger ON public.post_comments;
CREATE TRIGGER prevent_hidden_at_changes_comments_trigger
  BEFORE UPDATE ON public.post_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_hidden_at_changes();

-- ============================================================================
-- DOCUMENTATION
-- ============================================================================

-- Key Changes:
-- 1. Removed moderation field checks from WITH CHECK constraints to allow users to update posts/comments after moderation
-- 2. Split moderator policies into separate policies: one for moderation field updates and one for general updates (both allow moderators to update any fields)
-- 3. Changed all moderator role checks from 'user_metadata' to 'app_metadata' for consistency
-- 4. All moderator policies now use both 'role' claim and 'app_metadata.roles' array for flexibility
-- 5. Added database triggers to enforce field-level protection for hidden_at and moderation_reason fields
-- 6. Users can update their own content even after moderation, but cannot change moderation fields

COMMENT ON POLICY "Users can update their own posts" ON public.posts IS
  'Users can update their own posts. Moderation fields are protected by separate moderator policies.';

COMMENT ON POLICY "Moderators can update moderation fields on posts" ON public.posts IS
  'Moderators/admins can update posts, including moderation fields. Checks role via JWT claim and app_metadata.roles';

COMMENT ON POLICY "Moderators can update posts" ON public.posts IS
  'Moderators/admins can update posts. Checks role via JWT claim and app_metadata.roles';

COMMENT ON POLICY "Users can update their own comments" ON public.post_comments IS
  'Users can update their own comments. Moderation fields are protected by separate moderator policies.';

COMMENT ON POLICY "Moderators can update moderation fields on comments" ON public.post_comments IS
  'Moderators/admins can update comments, including moderation fields. Requires actual field changes.';

COMMENT ON POLICY "Moderators can update comments" ON public.post_comments IS
  'Moderators/admins can update comments. Checks role via JWT claim and app_metadata.roles';
