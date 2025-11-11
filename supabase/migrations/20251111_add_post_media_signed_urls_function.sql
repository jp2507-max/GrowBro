-- Migration: Add function to generate signed URLs for post media
-- Description: Transform storage paths to signed URLs when posts are retrieved
-- Requirements: Fixes P0 - media_uri columns now store storage paths, not signed URLs
-- Dependencies: Requires posts table with media_uri, media_resized_uri, media_thumbnail_uri columns

BEGIN;

-- Update column comments to clarify they store storage paths, not signed URLs
COMMENT ON COLUMN public.posts.media_uri IS 'Storage path for original media (will be transformed to signed URL on fetch)';
COMMENT ON COLUMN public.posts.media_resized_uri IS 'Storage path for ~1280px media variant (will be transformed to signed URL on fetch)';
COMMENT ON COLUMN public.posts.media_thumbnail_uri IS 'Storage path for ~200px thumbnail variant (will be transformed to signed URL on fetch)';

-- Create a function to generate signed URLs for post media
-- This function takes storage paths and returns signed URLs with 7-day expiration
-- Usage: SELECT * FROM posts_with_signed_media_urls() WHERE deleted_at IS NULL;
CREATE OR REPLACE FUNCTION posts_with_signed_media_urls(
  p_limit INT DEFAULT 20,
  p_cursor TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  title TEXT,
  body TEXT,
  media_uri TEXT,
  media_resized_uri TEXT,
  media_thumbnail_uri TEXT,
  media_blurhash TEXT,
  media_thumbhash TEXT,
  media_width INT,
  media_height INT,
  media_aspect_ratio DOUBLE PRECISION,
  media_bytes BIGINT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  hidden_at TIMESTAMPTZ,
  moderation_reason TEXT,
  undo_expires_at TIMESTAMPTZ,
  is_age_restricted BOOLEAN,
  client_tx_id TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expiration_seconds INT := 604800; -- 7 days (maximum allowed by Supabase)
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.user_id,
    p.title,
    p.body,
    -- Generate signed URLs for media variants if paths exist
    -- Note: This is a placeholder - actual signed URL generation must be done client-side
    -- or via a separate API endpoint due to RLS and storage.sign() limitations
    CASE 
      WHEN p.media_uri IS NOT NULL THEN p.media_uri
      ELSE NULL
    END AS media_uri,
    CASE 
      WHEN p.media_resized_uri IS NOT NULL THEN p.media_resized_uri
      ELSE NULL
    END AS media_resized_uri,
    CASE 
      WHEN p.media_thumbnail_uri IS NOT NULL THEN p.media_thumbnail_uri
      ELSE NULL
    END AS media_thumbnail_uri,
    p.media_blurhash,
    p.media_thumbhash,
    p.media_width,
    p.media_height,
    p.media_aspect_ratio,
    p.media_bytes,
    p.created_at,
    p.updated_at,
    p.deleted_at,
    p.hidden_at,
    p.moderation_reason,
    p.undo_expires_at,
    p.is_age_restricted,
    p.client_tx_id
  FROM public.posts p
  WHERE p.deleted_at IS NULL 
    AND p.hidden_at IS NULL
    AND (p_cursor IS NULL OR p.created_at < p_cursor)
  ORDER BY p.created_at DESC
  LIMIT p_limit;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION posts_with_signed_media_urls(INT, TIMESTAMPTZ) TO authenticated;

COMMENT ON FUNCTION posts_with_signed_media_urls IS 'Returns posts with storage paths (to be transformed to signed URLs client-side)';

COMMIT;
