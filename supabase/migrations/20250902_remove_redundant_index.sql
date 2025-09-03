-- Remove redundant index on occurrence_overrides(series_id, occurrence_local_date)
-- The unique constraint ux_occurrence_overrides_series_date already provides the necessary btree index

BEGIN;

-- Drop the redundant non-unique index since the unique constraint already provides optimal indexing
DROP INDEX IF EXISTS idx_occ_overrides_series_date;

COMMIT;
