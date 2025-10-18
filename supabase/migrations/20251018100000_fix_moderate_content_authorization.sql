-- Migration: Fix moderate_content RPC authorization security vulnerability
-- Description: Add role-based authorization check to prevent any authenticated user from moderating content
-- Critical Security Fix: P0 - Authorization bypass vulnerability

BEGIN;

-- Drop and recreate the function with proper authorization checks
CREATE OR REPLACE FUNCTION public.moderate_content(
  p_content_type text,
  p_content_id uuid,
  p_action text,
  p_reason text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_table_name text;
  v_moderator_id uuid;
  v_now timestamptz := now();
  v_existing_audit moderation_audit%ROWTYPE;
  v_result jsonb;
  updated_count integer := 0;
BEGIN
  -- Force search_path to prevent search_path hijacking
  SET search_path = 'public';

  -- Validate inputs
  IF p_content_type NOT IN ('post', 'comment') THEN
    RAISE EXCEPTION 'Invalid content_type: %', p_content_type;
  END IF;

  IF p_action NOT IN ('hide', 'unhide') THEN
    RAISE EXCEPTION 'Invalid action: %', p_action;
  END IF;

  -- Get current user (moderator)
  v_moderator_id := auth.current_user();

  IF v_moderator_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- CRITICAL SECURITY FIX: Verify user has moderator or admin role
  -- This prevents any authenticated user from calling this function
  -- Uses the same role checking logic as RLS policies for consistency
  IF NOT (
    auth.jwt() ->> 'role' IN ('admin', 'moderator')
    OR (auth.jwt() -> 'app_metadata' -> 'roles')::jsonb ? 'moderator'
    OR (auth.jwt() -> 'app_metadata' -> 'roles')::jsonb ? 'admin'
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions: moderator or admin role required';
  END IF;

  -- Check idempotency if key provided
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing_audit
    FROM moderation_audit
    WHERE idempotency_key = p_idempotency_key;

    IF FOUND THEN
      -- Return existing result
      RETURN jsonb_build_object(
        'success', true,
        'action', v_existing_audit.action,
        'moderated_at', v_existing_audit.created_at
      );
    END IF;
  END IF;

  -- Determine table
  v_table_name := CASE
    WHEN p_content_type = 'post' THEN 'posts'
    ELSE 'post_comments'
  END;

  -- Perform the moderation action atomically
  IF p_action = 'hide' THEN
    -- Hide content
    EXECUTE format('
      UPDATE %I
      SET hidden_at = $1, moderation_reason = $2, updated_at = $1
      WHERE id = $3 AND hidden_at IS NULL
    ', v_table_name)
    USING v_now, p_reason, p_content_id;

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    IF updated_count = 0 THEN
      RAISE EXCEPTION 'Target not found or already in desired state' USING ERRCODE = 'P0002';
    END IF;

    -- Insert audit log
    INSERT INTO moderation_audit (
      actor_id,
      action,
      target_type,
      target_id,
      reason,
      idempotency_key
    ) VALUES (
      v_moderator_id,
      'hide',
      p_content_type,
      p_content_id,
      p_reason,
      p_idempotency_key
    );

  ELSIF p_action = 'unhide' THEN
    -- Unhide content
    EXECUTE format('
      UPDATE %I
      SET hidden_at = NULL, moderation_reason = NULL, updated_at = $1
      WHERE id = $2 AND hidden_at IS NOT NULL
    ', v_table_name)
    USING v_now, p_content_id;

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    IF updated_count = 0 THEN
      RAISE EXCEPTION 'Target not found or already in desired state' USING ERRCODE = 'P0002';
    END IF;

    -- Insert audit log
    INSERT INTO moderation_audit (
      actor_id,
      action,
      target_type,
      target_id,
      reason,
      idempotency_key
    ) VALUES (
      v_moderator_id,
      'unhide',
      p_content_type,
      p_content_id,
      p_reason,
      p_idempotency_key
    );
  END IF;

  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'action', p_action,
    'moderated_at', v_now
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Grant execute permission to authenticated users (unchanged - permissions are checked at runtime)
GRANT EXECUTE ON FUNCTION public.moderate_content(text, uuid, text, text, text) TO authenticated;

COMMIT;
