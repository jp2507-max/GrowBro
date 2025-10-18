-- Migration: Create soft_delete_comment RPC function
-- Description: Atomically soft delete a comment with undo window

CREATE OR REPLACE FUNCTION public.soft_delete_comment(
  comment_id UUID,
  user_id UUID
)
RETURNS TABLE(id UUID, undo_expires_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  -- Attempt to update the comment atomically
  UPDATE public.post_comments
  SET
    deleted_at = now(),
    undo_expires_at = now() + interval '15 seconds'
  WHERE
    id = comment_id
    AND post_comments.user_id = user_id
    AND deleted_at IS NULL;

  -- Check if any row was updated
  GET DIAGNOSTICS updated_count = ROW_COUNT;

  IF updated_count = 0 THEN
    RAISE EXCEPTION 'Comment not found or already deleted' USING ERRCODE = 'P0002';
  END IF;

  -- Return the updated values
  RETURN QUERY
  SELECT pc.id, pc.undo_expires_at
  FROM public.post_comments pc
  WHERE pc.id = comment_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.soft_delete_comment(UUID, UUID) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.soft_delete_comment(UUID, UUID) IS 'Soft delete a comment atomically with 15-second undo window. Raises P0002 if comment not found or already deleted.';
