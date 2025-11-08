-- Migration: Create community-posts storage bucket with RLS policies
-- Description: Secure bucket for community post media (original, resized, thumbnail variants)
-- Requirements: 5.4 (media upload), Security (user-folder isolation)
-- Context: Fixes missing bucket and RLS policies for client-side uploads

BEGIN;

-- 1) Create bucket if not exists (private, not public-facing)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'community-posts',
  'community-posts',
  false, -- Private bucket (requires auth + RLS)
  10485760, -- 10MB per file limit (original + resized + thumbnail should stay under this)
  ARRAY['image/jpeg', 'image/png', 'image/webp'] -- Only allow image uploads
)
ON CONFLICT (id) DO UPDATE
SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2) Drop existing policies (idempotent migration)
DROP POLICY IF EXISTS "community-posts: read own media" ON storage.objects;
DROP POLICY IF EXISTS "community-posts: upload to own folder" ON storage.objects;
DROP POLICY IF EXISTS "community-posts: delete own media" ON storage.objects;
DROP POLICY IF EXISTS "community-posts: update own media" ON storage.objects;

-- 3) SELECT: Users can read their own media (first folder = auth.uid())
CREATE POLICY "community-posts: read own media"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'community-posts'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 4) INSERT: Users can upload only into their own folder (userId/contentHash/variant.jpg)
CREATE POLICY "community-posts: upload to own folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'community-posts'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
    -- Path format: {userId}/{contentHash}/original.jpg|resized.jpg|thumbnail.jpg
    -- This prevents directory traversal and ensures user isolation
  );

-- 5) DELETE: Users can delete their own media (needed for rollback/cleanup)
CREATE POLICY "community-posts: delete own media"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'community-posts'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 6) UPDATE: Users can update their own media metadata (rare, but allow for consistency)
CREATE POLICY "community-posts: update own media"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'community-posts'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'community-posts'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

COMMIT;

-- Documentation
COMMENT ON TABLE storage.buckets IS 'Storage buckets with file_size_limit and allowed_mime_types enforcement';

-- Security Notes:
-- 1. User isolation: (storage.foldername(name))[1] = auth.uid()::text ensures users can only access their own folder
-- 2. Path validation: Client sanitizes userId/contentHash to prevent directory traversal
-- 3. File size: 10MB limit enforced at bucket level + client pre-validation
-- 4. MIME types: Only image/* allowed to prevent malicious file uploads
-- 5. Private bucket: public=false means no anonymous access; all access requires auth + RLS check

