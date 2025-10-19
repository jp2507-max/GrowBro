-- Migration: Create moderate_content RPC for atomic moderation operations
-- This SECURITY DEFINER function performs hide/unhide operations atomically with idempotency.

BEGIN;

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
SET search_path = 'public'
AS $$
DECLARE
  v_table_name text;
  v_moderator_id uuid;
  v_now timestamptz := now();
  v_existing_audit moderation_audit%ROWTYPE;
  v_result jsonb;
  v_row_count integer;
BEGIN
  -- Validate inputs
  IF p_content_type NOT IN ('post', 'comment') THEN
    RAISE EXCEPTION 'Invalid content_type: %', p_content_type;
  END IF;

  IF p_action NOT IN ('hide', 'unhide') THEN
    RAISE EXCEPTION 'Invalid action: %', p_action;
  END IF;

  -- Get current user (moderator)
  v_moderator_id := auth.uid();

  IF v_moderator_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Verify user has moderator or admin role
  -- Check multiple JWT paths for role information (same as RLS policies)
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
    -- Hide content (idempotent: only hide if not already hidden)
    EXECUTE format('
      UPDATE public.%I
      SET hidden_at = $1, moderation_reason = $2, updated_at = $1
      WHERE id = $3 AND hidden_at IS NULL
    ', v_table_name)
    USING v_now, p_reason, p_content_id;

    -- Check if any rows were affected
    GET DIAGNOSTICS v_row_count = ROW_COUNT;

    -- Only insert audit log if content was actually hidden
    IF v_row_count > 0 THEN
      INSERT INTO public.moderation_audit (
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
    ELSE
      -- Return early if no rows were affected (already hidden)
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Content is already hidden'
      );
    END IF;

  ELSIF p_action = 'unhide' THEN
    -- Unhide content (idempotent: only unhide if currently hidden)
    EXECUTE format('
      UPDATE public.%I
      SET hidden_at = NULL, moderation_reason = NULL, updated_at = $1
      WHERE id = $2 AND hidden_at IS NOT NULL
    ', v_table_name)
    USING v_now, p_content_id;

    -- Check if any rows were affected
    GET DIAGNOSTICS v_row_count = ROW_COUNT;

    -- Only insert audit log if content was actually unhidden
    IF v_row_count > 0 THEN
      INSERT INTO public.moderation_audit (
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
    ELSE
      -- Return early if no rows were affected (not hidden)
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Content is not hidden'
      );
    END IF;
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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.moderate_content(text, uuid, text, text, text) TO authenticated;

COMMIT;