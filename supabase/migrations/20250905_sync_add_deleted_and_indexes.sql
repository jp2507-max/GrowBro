-- Sync: add missing deleted_at and composite pagination indexes
-- Notes:
-- - Use CONCURRENTLY and avoid wrapping in a transaction
-- - Partial indexes align with queries for active records and tombstones

-- Ensure occurrence_overrides has deleted_at for soft-deletes
ALTER TABLE IF EXISTS public.occurrence_overrides
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- series: active records pagination
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_series_updated_at_id_active
  ON public.series (updated_at, id)
  WHERE deleted_at IS NULL;

-- series: tombstones pagination
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_series_deleted_at_id_tombstones
  ON public.series (deleted_at, id)
  WHERE deleted_at IS NOT NULL;

-- tasks: active records pagination
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_updated_at_id_active
  ON public.tasks (updated_at, id)
  WHERE deleted_at IS NULL;

-- tasks: tombstones pagination
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_deleted_at_id_tombstones
  ON public.tasks (deleted_at, id)
  WHERE deleted_at IS NOT NULL;

-- occurrence_overrides: active records pagination
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_occurrence_overrides_updated_at_id_active
  ON public.occurrence_overrides (updated_at, id)
  WHERE deleted_at IS NULL;

-- occurrence_overrides: tombstones pagination
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_occurrence_overrides_deleted_at_id_tombstones
  ON public.occurrence_overrides (deleted_at, id)
  WHERE deleted_at IS NOT NULL;


