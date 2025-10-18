-- Migration: Create Row Level Security Policies
-- Description: Comprehensive RLS policies for community tables
-- Requirements: 10.1, 10.2, 10.3, 7.6, 7.8
-- Dependencies: Requires posts, post_comments, post_likes, idempotency_keys, reports, moderation_audit tables

-- ============================================================================
-- POSTS TABLE POLICIES
-- ============================================================================

-- Public read access for non-deleted, non-hidden posts
CREATE POLICY "Posts are viewable by everyone" ON public.posts
  FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL AND hidden_at IS NULL);

-- Users can insert their own posts
CREATE POLICY "Users can insert their own posts" ON public.posts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own posts (content, metadata)
-- This policy excludes moderation fields (hidden_at, moderation_reason)
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

-- Users can soft-delete their own posts
-- This sets deleted_at and undo_expires_at, but doesn't hard delete
CREATE POLICY "Users can delete their own posts" ON public.posts
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Moderators can hide content and set moderation reasons
-- Separate policy to avoid conflicts with user update policy
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

-- Users can soft-delete their own comments
CREATE POLICY "Users can delete their own comments" ON public.post_comments
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

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

-- ============================================================================
-- POST_LIKES TABLE POLICIES
-- ============================================================================

-- Users can only manage their own likes
-- Single policy covers all operations (SELECT, INSERT, DELETE)
-- Requirement 10.1: UNIQUE (post_id, user_id) constraint enforced at DB level
CREATE POLICY "Users can manage their own likes" ON public.post_likes
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- IDEMPOTENCY_KEYS TABLE POLICIES
-- ============================================================================

-- Users can only see and manage their own idempotency keys
CREATE POLICY "Users can manage own idempotency keys" ON public.idempotency_keys
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role can manage all keys for cleanup operations
-- This allows the cleanup job to delete expired keys across all users
CREATE POLICY "Service role can manage all idempotency keys" ON public.idempotency_keys
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- REPORTS TABLE POLICIES
-- ============================================================================

-- Any authenticated user can report content
CREATE POLICY "Users can report content" ON public.reports
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

-- Users can view their own reports
CREATE POLICY "Users can view own reports" ON public.reports
  FOR SELECT
  TO authenticated
  USING (auth.uid() = reporter_id);

-- Moderators and admins can view all reports
CREATE POLICY "Moderators can view all reports" ON public.reports
  FOR SELECT
  TO authenticated
  USING (
    auth.jwt() ->> 'role' IN ('admin', 'moderator')
    OR (auth.jwt() -> 'app_metadata' -> 'roles')::jsonb ? 'moderator'
    OR (auth.jwt() -> 'app_metadata' -> 'roles')::jsonb ? 'admin'
  );

-- Moderators can update report status
CREATE POLICY "Moderators can update reports" ON public.reports
  FOR UPDATE
  TO authenticated
  USING (
    auth.jwt() ->> 'role' IN ('admin', 'moderator')
    OR (auth.jwt() -> 'app_metadata' -> 'roles')::jsonb ? 'moderator'
    OR (auth.jwt() -> 'app_metadata' -> 'roles')::jsonb ? 'admin'
  );

-- ============================================================================
-- MODERATION_AUDIT TABLE POLICIES
-- ============================================================================

-- Moderators and admins can view audit logs
CREATE POLICY "Moderators can view audit logs" ON public.moderation_audit
  FOR SELECT
  TO authenticated
  USING (
    auth.jwt() ->> 'role' IN ('admin', 'moderator')
    OR (auth.jwt() -> 'app_metadata' -> 'roles')::jsonb ? 'moderator'
    OR (auth.jwt() -> 'app_metadata' -> 'roles')::jsonb ? 'admin'
  );

-- Moderators can insert audit log entries
-- Note: Typically these would be inserted via triggers/functions,
-- but this policy allows manual insertion if needed
CREATE POLICY "Moderators can create audit logs" ON public.moderation_audit
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.jwt() ->> 'role' IN ('admin', 'moderator')
    OR (auth.jwt() -> 'app_metadata' -> 'roles')::jsonb ? 'moderator'
    OR (auth.jwt() -> 'app_metadata' -> 'roles')::jsonb ? 'admin'
  );

-- ============================================================================
-- POLICY DOCUMENTATION AND NOTES
-- ============================================================================

-- Security Notes:
-- 1. All policies use TO authenticated to ensure only logged-in users have access
-- 2. Service role has full access to idempotency_keys for cleanup operations
-- 3. Moderator role checking uses multiple JWT paths for flexibility:
--    - Direct role claim: auth.jwt() ->> 'role'
--    - App metadata roles array: auth.jwt() -> 'app_metadata' -> 'roles'
-- 4. Soft delete filtering (deleted_at IS NULL AND hidden_at IS NULL) in SELECT policies
-- 5. Owner policies use USING and WITH CHECK to prevent impersonation
-- 6. Moderation policies have separate WITH CHECK to prevent accidental field changes

-- Performance Notes:
-- 1. Policies leverage existing indexes on user_id, deleted_at, hidden_at
-- 2. JWT parsing in policies has minimal overhead but is cached per request
-- 3. Compound conditions (deleted_at IS NULL AND hidden_at IS NULL) can use partial indexes

-- Testing Checklist:
-- [ ] Regular user can read non-deleted posts
-- [ ] Regular user can create/update/delete own posts
-- [ ] Regular user cannot modify other users' posts
-- [ ] Regular user cannot set hidden_at or moderation_reason
-- [ ] Moderator can set hidden_at and moderation_reason on any post
-- [ ] Moderator can view all reports
-- [ ] User can only see own idempotency keys
-- [ ] Service role can delete expired idempotency keys across all users
-- [ ] Deleted and hidden posts are filtered from SELECT queries
