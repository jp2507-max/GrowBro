-- Migration: Fix Row Level Security Policies
-- Description: Update existing RLS policies to add proper WITH CHECK constraints
-- Requirements: 10.1, 10.2, 10.3, 7.6, 7.8
-- Dependencies: Requires existing RLS policies from previous migrations

-- ============================================================================
-- FIX POSTS TABLE POLICIES
-- ============================================================================

-- Drop and recreate user update policy with proper WITH CHECK constraint
DROP POLICY IF EXISTS "Users can update their own posts" ON public.posts;
CREATE POLICY "Users can update their own posts" ON public.posts
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    -- Ensure users cannot set moderation fields via this policy
    AND hidden_at IS NULL
    AND moderation_reason IS NULL
  );

-- Drop and recreate moderator policy to use app_metadata instead of user_metadata
-- and add proper WITH CHECK constraints
DROP POLICY IF EXISTS "Moderators can hide posts" ON public.posts;
CREATE POLICY "Moderators can hide posts" ON public.posts
  FOR UPDATE
  TO authenticated
  USING (
    -- Check if user has moderator or admin role via JWT
    auth.jwt() ->> 'role' IN ('admin', 'moderator')
    OR (auth.jwt() -> 'app_metadata' -> 'roles')::jsonb ? 'moderator'
    OR (auth.jwt() -> 'app_metadata' -> 'roles')::jsonb ? 'admin'
  )
  WITH CHECK (
    -- Verify the update is setting moderation fields
    (hidden_at IS NOT NULL OR moderation_reason IS NOT NULL)
    -- Revalidate actor role in WITH CHECK
    AND (
      auth.jwt() ->> 'role' IN ('admin', 'moderator')
      OR (auth.jwt() -> 'app_metadata' -> 'roles')::jsonb ? 'moderator'
      OR (auth.jwt() -> 'app_metadata' -> 'roles')::jsonb ? 'admin'
    )
  );

-- ============================================================================
-- FIX POST_COMMENTS TABLE POLICIES
-- ============================================================================

-- Drop and recreate user update policy with proper WITH CHECK constraint
DROP POLICY IF EXISTS "Users can update their own comments" ON public.post_comments;
CREATE POLICY "Users can update their own comments" ON public.post_comments
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    -- Ensure users cannot set moderation fields
    AND hidden_at IS NULL
  );

-- Drop and recreate moderator policy to use app_metadata and add WITH CHECK
DROP POLICY IF EXISTS "Moderators can hide comments" ON public.post_comments;
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
    auth.jwt() ->> 'role' IN ('admin', 'moderator')
    OR (auth.jwt() -> 'app_metadata' -> 'roles')::jsonb ? 'moderator'
    OR (auth.jwt() -> 'app_metadata' -> 'roles')::jsonb ? 'admin'
  );

-- ============================================================================
-- DOCUMENTATION
-- ============================================================================

-- Key Changes:
-- 1. Added WITH CHECK constraints to user update policies to prevent setting moderation fields
-- 2. Changed all moderator role checks from 'user_metadata' to 'app_metadata' for consistency
-- 3. Added WITH CHECK constraints to moderator policies to prevent accidental field changes
-- 4. Renamed policies for consistency with design spec
-- 5. All moderator policies now use both 'role' claim and 'app_metadata.roles' array for flexibility

COMMENT ON POLICY "Users can update their own posts" ON public.posts IS 
  'Users can update their own posts but cannot set moderation fields (hidden_at, moderation_reason)';

COMMENT ON POLICY "Moderators can hide posts" ON public.posts IS 
  'Moderators/admins can set hidden_at and moderation_reason. Checks role via JWT claim and app_metadata.roles';

COMMENT ON POLICY "Users can update their own comments" ON public.post_comments IS 
  'Users can update their own comments but cannot set hidden_at';

COMMENT ON POLICY "Moderators can hide comments" ON public.post_comments IS 
  'Moderators/admins can set hidden_at on comments. Checks role via JWT claim and app_metadata.roles';
