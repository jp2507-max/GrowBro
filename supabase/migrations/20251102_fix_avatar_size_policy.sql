-- Fix avatar upload policy to properly check file size
-- The original policy was using OCTET_LENGTH which measures string byte-length
-- instead of the actual numeric file size

DO $$ BEGIN
  -- Drop the existing policy
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Users can upload their own avatars') THEN
    DROP POLICY "Users can upload their own avatars" ON storage.objects;
  END IF;

  -- Recreate with correct size checking
  CREATE POLICY "Users can upload their own avatars"
    ON storage.objects FOR INSERT
    WITH CHECK (
      bucket_id = 'avatars' AND
      (storage.foldername(name))[1] = auth.uid()::text AND
      -- Limit file size to 5MB - cast metadata size to bigint for proper numeric comparison
      (metadata->>'size')::bigint <= 5242880
    );
END $$;
