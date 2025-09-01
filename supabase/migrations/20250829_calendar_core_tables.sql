-- Calendar 2.0 core tables: series, tasks, occurrence_overrides, notification_queue
-- Covers Task 1 requirements: 1.5, 1.6, 6.1, 6.7, 7.1, 8.1

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Recurring series definitions
CREATE TABLE IF NOT EXISTS series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NULL,
  dtstart_local text NOT NULL,
  dtstart_utc text NOT NULL,
  timezone text NOT NULL,
  rrule text NOT NULL,
  until_utc text NULL,
  count int NULL CHECK (count IS NULL OR count >= 0),
  plant_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);

-- Per-occurrence overrides for a given series occurrence (skip/reschedule/complete)
CREATE TABLE IF NOT EXISTS occurrence_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id uuid NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  occurrence_local_date text NOT NULL, -- YYYY-MM-DD representing local date of occurrence
  due_at_local text NULL,
  due_at_utc text NULL,
  reminder_at_local text NULL,
  reminder_at_utc text NULL,
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
  due_at_local text NOT NULL,
  due_at_utc text NOT NULL,
  timezone text NOT NULL,
  reminder_at_local text NULL,
  reminder_at_utc text NULL,
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
  scheduled_for_local text NOT NULL,
  scheduled_for_utc text NOT NULL,
  timezone text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending','sent','failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_tasks_series_id ON tasks(series_id);
CREATE INDEX IF NOT EXISTS idx_tasks_updated_at ON tasks(updated_at);
CREATE INDEX IF NOT EXISTS idx_series_updated_at ON series(updated_at);
CREATE INDEX IF NOT EXISTS idx_occ_overrides_series_date ON occurrence_overrides(series_id, occurrence_local_date);

-- Unique dedupe for queue entries to prevent duplicates for same task/time
CREATE UNIQUE INDEX IF NOT EXISTS ux_notification_queue_task_at_utc
  ON notification_queue(task_id, scheduled_for_utc);

COMMIT;


