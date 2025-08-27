-- Adds nullable moderation & soft-delete columns to post_comments and ensures
-- partial indexes reference the correct columns (deleted_at, hidden_at).
BEGIN;

-- Add columns if they don't already exist (safe to run multiple times)
ALTER TABLE IF EXISTS post_comments
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS moderation_reason TEXT,
  ADD COLUMN IF NOT EXISTS undo_expires_at TIMESTAMPTZ;

-- Ensure indexes match the default visibility filter used by selects
-- (only include non-deleted, non-hidden comments)
CREATE INDEX IF NOT EXISTS idx_post_comments_post_created ON post_comments (post_id, created_at)
  WHERE deleted_at IS NULL AND hidden_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_post_comments_post ON post_comments (post_id);

CREATE INDEX IF NOT EXISTS idx_post_comments_updated_at ON post_comments (updated_at);

-- Optional: add/replace trigger to keep updated_at set on update (idempotent)
DO $$
DECLARE
  trigger_exists BOOLEAN;
  function_exists BOOLEAN;
  column_exists BOOLEAN;
BEGIN
  -- Check if updated_at column exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'post_comments' AND column_name = 'updated_at'
  ) INTO column_exists;

  IF NOT column_exists THEN
    RAISE NOTICE 'updated_at column does not exist in post_comments table, skipping trigger creation';
    RETURN;
  END IF;

  -- Check if trigger function exists
  SELECT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'update_updated_at_column'
  ) INTO function_exists;

  -- Create trigger function if it doesn't exist
  IF NOT function_exists THEN
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$ language 'plpgsql';
  END IF;

  -- Check if trigger exists
  SELECT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'handle_updated_at' AND tgrelid = 'post_comments'::regclass
  ) INTO trigger_exists;

  -- Create trigger if it doesn't exist
  IF NOT trigger_exists THEN
    CREATE TRIGGER handle_updated_at
      BEFORE UPDATE ON post_comments
      FOR EACH ROW
      EXECUTE PROCEDURE update_updated_at_column();
  END IF;

EXCEPTION WHEN others THEN
  -- If trigger creation isn't possible here, ignore (keep migration idempotent)
  RAISE NOTICE 'Skipping trigger creation in migration: %', SQLERRM;
END$$;

COMMIT;
