ALTER TABLE series
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
