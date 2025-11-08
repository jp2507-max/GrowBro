-- Migration: Add media variant metadata to posts table
-- Description: Store resized/thumbnail URIs, hashes, and dimension metadata for community posts
-- Requirements: 1.2 (prevent blank cells during scroll), 5.4 (memory budget enforcement)

BEGIN;

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS media_resized_uri TEXT,
  ADD COLUMN IF NOT EXISTS media_thumbnail_uri TEXT,
  ADD COLUMN IF NOT EXISTS media_blurhash TEXT,
  ADD COLUMN IF NOT EXISTS media_thumbhash TEXT,
  ADD COLUMN IF NOT EXISTS media_width INTEGER,
  ADD COLUMN IF NOT EXISTS media_height INTEGER,
  ADD COLUMN IF NOT EXISTS media_aspect_ratio DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS media_bytes BIGINT;

-- Ensure dimension metadata stays positive when provided
ALTER TABLE public.posts
  ADD CONSTRAINT posts_media_dimensions_check
  CHECK (
    (media_width IS NULL OR media_width > 0)
    AND (media_height IS NULL OR media_height > 0)
    AND (media_bytes IS NULL OR media_bytes > 0)
    AND (media_aspect_ratio IS NULL OR media_aspect_ratio > 0)
  );

COMMENT ON COLUMN public.posts.media_resized_uri IS 'Storage URI for ~1280px media variant used in feeds (Requirement 1.2)';
COMMENT ON COLUMN public.posts.media_thumbnail_uri IS 'Storage URI for ~200px thumbnail variant (Requirement 1.2)';
COMMENT ON COLUMN public.posts.media_blurhash IS 'BlurHash placeholder for progressive loading (Requirement 1.2)';
COMMENT ON COLUMN public.posts.media_thumbhash IS 'ThumbHash placeholder for progressive loading (Requirement 1.2)';
COMMENT ON COLUMN public.posts.media_width IS 'Original media width in pixels (Requirement 5.4)';
COMMENT ON COLUMN public.posts.media_height IS 'Original media height in pixels (Requirement 5.4)';
COMMENT ON COLUMN public.posts.media_aspect_ratio IS 'Original media aspect ratio (width / height) (Requirement 5.4)';
COMMENT ON COLUMN public.posts.media_bytes IS 'Original media size in bytes (Requirement 5.4)';

COMMIT;
