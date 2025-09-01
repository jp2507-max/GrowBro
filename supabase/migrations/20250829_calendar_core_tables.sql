-- Calendar 2.0 core tables: series, tasks, occurrence_overrides, notification_queue
-- Covers Task 1 requirements: 1.5, 1.6, 6.1, 6.7, 7.1, 8.1

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Recurring series definitions
CREATE TABLE IF NOT EXISTS series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NULL,
  dtstart_local timestamp without time zone NOT NULL,
  dtstart_utc timestamptz NOT NULL,
  timezone text NOT NULL,
  rrule text NOT NULL,
  until_utc timestamptz NULL,
  count int NULL CHECK (count IS NULL OR count >= 0),
  CONSTRAINT chk_rrule_count_until_mutual_exclusive CHECK (count IS NULL OR until_utc IS NULL),
  plant_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);

-- Per-occurrence overrides for a given series occurrence (skip/reschedule/complete)
CREATE TABLE IF NOT EXISTS occurrence_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id uuid NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  occurrence_local_date date NOT NULL, -- YYYY-MM-DD representing local date of occurrence
  due_at_local timestamp without time zone NULL,
  due_at_utc timestamptz NULL,
  reminder_at_local timestamp without time zone NULL,
  reminder_at_utc timestamptz NULL,
  status text NULL CHECK (status IN ('skip','reschedule','complete')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Materialized tasks (one-off or from series)
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id uuid NULL REFERENCES series(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text NULL,
  due_at_local timestamp without time zone NOT NULL,
  due_at_utc timestamptz NOT NULL,
  timezone text NOT NULL,
  reminder_at_local timestamp without time zone NULL,
  reminder_at_utc timestamptz NULL,
  plant_id uuid NULL,
  status text NOT NULL CHECK (status IN ('pending','completed','skipped')),
  completed_at timestamptz NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);

-- Scheduled notification queue with dedupe guard
CREATE TABLE IF NOT EXISTS notification_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  notification_id text NOT NULL,
  scheduled_for_local timestamp without time zone NOT NULL,
  scheduled_for_utc timestamptz NOT NULL,
  timezone text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending','sent','failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Handle potential duplicates in occurrence_overrides before adding unique constraint
-- Check for duplicates on (series_id, occurrence_local_date)
DO $$
DECLARE
    duplicate_count INTEGER;
BEGIN
    -- Count duplicates
    SELECT COUNT(*) INTO duplicate_count
    FROM (
        SELECT series_id, occurrence_local_date, COUNT(*) as cnt
        FROM occurrence_overrides
        GROUP BY series_id, occurrence_local_date
        HAVING COUNT(*) > 1
    ) duplicates;

    IF duplicate_count > 0 THEN
        RAISE NOTICE 'Found % duplicate combinations in occurrence_overrides. Removing duplicates...', duplicate_count;

        -- Delete duplicates, keeping the most recently created row for each (series_id, occurrence_local_date)
        DELETE FROM occurrence_overrides
        WHERE id NOT IN (
            SELECT DISTINCT ON (series_id, occurrence_local_date) id
            FROM occurrence_overrides
            ORDER BY series_id, occurrence_local_date, created_at DESC
        );

        RAISE NOTICE 'Duplicates removed successfully.';
    ELSE
        RAISE NOTICE 'No duplicates found in occurrence_overrides.';
    END IF;
END $$;

-- Add unique constraint to prevent future duplicates on (series_id, occurrence_local_date)
ALTER TABLE occurrence_overrides
ADD CONSTRAINT ux_occurrence_overrides_series_date
UNIQUE (series_id, occurrence_local_date);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_tasks_series_id ON tasks(series_id);
CREATE INDEX IF NOT EXISTS idx_tasks_updated_at ON tasks(updated_at);
CREATE INDEX IF NOT EXISTS idx_series_updated_at ON series(updated_at);
-- Note: idx_occ_overrides_series_date index is now redundant with the unique constraint above,
-- but keeping it for explicit performance optimization
CREATE INDEX IF NOT EXISTS idx_occ_overrides_series_date ON occurrence_overrides(series_id, occurrence_local_date);

-- Unique dedupe for queue entries to prevent duplicates for same task/time
CREATE UNIQUE INDEX IF NOT EXISTS ux_notification_queue_task_at_utc
  ON notification_queue(task_id, scheduled_for_utc);

-- Audit trigger to maintain updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$;

CREATE TRIGGER set_updated_at_series
BEFORE UPDATE ON series
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_occurrence_overrides
BEFORE UPDATE ON occurrence_overrides
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_tasks
BEFORE UPDATE ON tasks
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_notification_queue
BEFORE UPDATE ON notification_queue
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;


