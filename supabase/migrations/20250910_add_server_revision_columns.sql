-- Add server_revision and server_updated_at_ms columns for sync conflict resolution
-- These columns support WatermelonDB sync engine's authority logic

BEGIN;

-- Add server_revision (numeric) and server_updated_at_ms (bigint) to series table
ALTER TABLE IF EXISTS public.series
  ADD COLUMN IF NOT EXISTS server_revision bigint NULL,
  ADD COLUMN IF NOT EXISTS server_updated_at_ms bigint NULL;

-- Add server_revision (numeric) and server_updated_at_ms (bigint) to occurrence_overrides table
ALTER TABLE IF EXISTS public.occurrence_overrides
  ADD COLUMN IF NOT EXISTS server_revision bigint NULL,
  ADD COLUMN IF NOT EXISTS server_updated_at_ms bigint NULL;

-- Add server_revision (numeric) and server_updated_at_ms (bigint) to tasks table
ALTER TABLE IF EXISTS public.tasks
  ADD COLUMN IF NOT EXISTS server_revision bigint NULL,
  ADD COLUMN IF NOT EXISTS server_updated_at_ms bigint NULL;

-- Create indexes for performance on server_revision columns (used for conflict resolution)
CREATE INDEX IF NOT EXISTS idx_series_server_revision
  ON public.series (server_revision)
  WHERE server_revision IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_occurrence_overrides_server_revision
  ON public.occurrence_overrides (server_revision)
  WHERE server_revision IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_server_revision
  ON public.tasks (server_revision)
  WHERE server_revision IS NOT NULL;

-- Create indexes for performance on server_updated_at_ms columns
CREATE INDEX IF NOT EXISTS idx_series_server_updated_at_ms
  ON public.series (server_updated_at_ms)
  WHERE server_updated_at_ms IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_occurrence_overrides_server_updated_at_ms
  ON public.occurrence_overrides (server_updated_at_ms)
  WHERE server_updated_at_ms IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_server_updated_at_ms
  ON public.tasks (server_updated_at_ms)
  WHERE server_updated_at_ms IS NOT NULL;

COMMIT;
