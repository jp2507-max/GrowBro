-- perform_sync_pull_v2: cursor-based incremental pull for tasks (active + tombstones)
-- Notes:
-- - Captures a stable server_ts at TX start (or reuses from cursor) to bound the window
-- - Paginates tasks by ORDER BY (updated_at, id) for active rows and (deleted_at, id) for tombstones
-- - Returns hasMore and nextCursor (as json) that should be passed back verbatim on subsequent calls
-- - For simplicity, series and occurrence_overrides are returned empty here; extend similarly if needed

CREATE OR REPLACE FUNCTION public.perform_sync_pull_v2(
  last_pulled_at_ms bigint,
  cursor jsonb DEFAULT NULL,
  page_size integer DEFAULT 500
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  last_ts timestamptz := to_timestamp(COALESCE(last_pulled_at_ms, 0) / 1000.0);
  server_ts timestamptz;
  server_ms bigint;

  -- Cursors for tasks active stream
  tasks_active_cursor_ts timestamptz := NULL;
  tasks_active_cursor_id uuid := NULL;

  -- Cursors for tasks tombstone stream
  tasks_tomb_cursor_ts timestamptz := NULL;
  tasks_tomb_cursor_id uuid := NULL;

  -- Output aggregates
  tasks_active_rows jsonb := '[]'::jsonb;
  tasks_deleted_rows jsonb := '[]'::jsonb;
  has_more_active boolean := false;
  has_more_tomb boolean := false;
  has_more boolean := false;

  _limit integer := GREATEST(1, LEAST(COALESCE(page_size, 1), 5000));
BEGIN
  -- Determine server_ts: reuse from cursor if provided, else bind to TX start
  IF cursor IS NULL OR NOT (cursor ? 'server_ts_ms') THEN
    server_ts := transaction_timestamp();
  ELSE
    server_ts := to_timestamp((cursor->>'server_ts_ms')::bigint / 1000.0);
  END IF;
  server_ms := (floor(extract(epoch FROM server_ts) * 1000))::bigint;

  -- Parse task cursors when provided
  IF cursor ? 'tasks' THEN
    IF (cursor->'tasks'->'active') IS NOT NULL THEN
      IF (cursor->'tasks'->'active' ? 'ts_ms') THEN
        tasks_active_cursor_ts := to_timestamp(((cursor->'tasks'->'active'->>'ts_ms')::bigint) / 1000.0);
      END IF;
      IF (cursor->'tasks'->'active' ? 'id') THEN
        tasks_active_cursor_id := (cursor->'tasks'->'active'->>'id')::uuid;
      END IF;
    END IF;
    IF (cursor->'tasks'->'tombstone') IS NOT NULL THEN
      IF (cursor->'tasks'->'tombstone' ? 'ts_ms') THEN
        tasks_tomb_cursor_ts := to_timestamp(((cursor->'tasks'->'tombstone'->>'ts_ms')::bigint) / 1000.0);
      END IF;
      IF (cursor->'tasks'->'tombstone' ? 'id') THEN
        tasks_tomb_cursor_id := (cursor->'tasks'->'tombstone'->>'id')::uuid;
      END IF;
    END IF;
  END IF;

  -- Active tasks page (updated_at window)
  WITH task_candidates AS (
    SELECT
      t.id,
      t.series_id,
      t.title,
      t.description,
      t.due_at_local,
      t.due_at_utc,
      t.timezone,
      t.reminder_at_local,
      t.reminder_at_utc,
      t.plant_id,
      t.status,
      t.completed_at,
      t.metadata,
      t.created_at,
      t.updated_at,
      t.server_revision,
      t.server_updated_at_ms
    FROM public.tasks t
    WHERE t.updated_at > last_ts
      AND t.updated_at <= server_ts
      AND t.deleted_at IS NULL
      AND (
        tasks_active_cursor_ts IS NULL
        OR t.updated_at > tasks_active_cursor_ts
        OR (t.updated_at = tasks_active_cursor_ts AND (tasks_active_cursor_id IS NULL OR t.id > tasks_active_cursor_id))
      )
    ORDER BY t.updated_at, t.id
    LIMIT _limit + 1
  ), task_page AS (
    SELECT * FROM task_candidates ORDER BY updated_at, id LIMIT _limit
  )
  SELECT
    COALESCE(jsonb_agg(jsonb_build_object(
      'id', task_page.id,
      'series_id', task_page.series_id,
      'title', task_page.title,
      'description', task_page.description,
      'due_at_local', to_char(task_page.due_at_local, 'YYYY-MM-DD"T"HH24:MI:SS'),
      'due_at_utc', to_char(task_page.due_at_utc AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'timezone', task_page.timezone,
      'reminder_at_local', CASE WHEN task_page.reminder_at_local IS NULL THEN NULL ELSE to_char(task_page.reminder_at_local, 'YYYY-MM-DD"T"HH24:MI:SS') END,
      'reminder_at_utc', CASE WHEN task_page.reminder_at_utc IS NULL THEN NULL ELSE to_char(task_page.reminder_at_utc AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END,
      'plant_id', task_page.plant_id,
      'status', task_page.status,
      'completed_at', CASE WHEN task_page.completed_at IS NULL THEN NULL ELSE to_char(task_page.completed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END,
      'metadata', COALESCE(task_page.metadata, '{}'::jsonb),
      'server_revision', task_page.server_revision,
      'server_updated_at_ms', task_page.server_updated_at_ms,
      'createdAt', floor(extract(epoch FROM task_page.created_at) * 1000),
      'updatedAt', floor(extract(epoch FROM task_page.updated_at) * 1000)
    ) ORDER BY task_page.updated_at DESC, task_page.id DESC), '[]'::jsonb) AS rows,
    EXISTS(SELECT 1 FROM task_candidates OFFSET _limit) AS more
  FROM task_page
    (SELECT updated_at FROM task_page ORDER BY updated_at, id DESC LIMIT 1) AS last_ts,
    (SELECT id FROM task_page ORDER BY updated_at, id DESC LIMIT 1) AS last_id
  INTO tasks_active_rows, has_more_active, tasks_active_cursor_ts, tasks_active_cursor_id;

  -- Task tombstones page (deleted_at window)
  WITH tomb_candidates AS (
    SELECT t.id, t.deleted_at
    FROM public.tasks t
    WHERE t.deleted_at IS NOT NULL
      AND t.deleted_at > last_ts
      AND t.deleted_at <= server_ts
      AND (
        tasks_tomb_cursor_ts IS NULL
        OR (t.deleted_at > tasks_tomb_cursor_ts)
        OR (t.deleted_at = tasks_tomb_cursor_ts AND t.id > tasks_tomb_cursor_id)
      )
    ORDER BY t.deleted_at, t.id
    LIMIT _limit + 1
  ), tomb_page AS (
    SELECT * FROM tomb_candidates ORDER BY deleted_at DESC, id DESC LIMIT _limit
  )
  SELECT
    COALESCE(jsonb_agg(jsonb_build_object(
      'id', id,
      'deleted_at', (floor(extract(epoch FROM deleted_at) * 1000))::bigint
    ) ORDER BY deleted_at DESC, id DESC), '[]'::jsonb) AS rows,
    EXISTS(SELECT 1 FROM tomb_page OFFSET _limit) AS more,
    (SELECT (floor(extract(epoch FROM deleted_at) * 1000))::bigint FROM tomb_page ORDER BY deleted_at DESC, id DESC LIMIT 1) AS last_ts,
    (SELECT id FROM tomb_page ORDER BY deleted_at DESC, id DESC LIMIT 1) AS last_id
  FROM tomb_page
  INTO tasks_deleted_rows, has_more_tomb, tasks_tomb_cursor_ts, tasks_tomb_cursor_id;

  has_more := has_more_active OR has_more_tomb;

  RETURN jsonb_build_object(
    'serverTimestamp', server_ms,
    'hasMore', has_more,
    'nextCursor', jsonb_build_object(
      'server_ts_ms', server_ms,
      'tasks', jsonb_build_object(
        'active', CASE WHEN has_more_active THEN jsonb_build_object('ts_ms', floor(extract(epoch FROM tasks_active_cursor_ts) * 1000), 'id', tasks_active_cursor_id::text) ELSE NULL END,
        'tombstone', CASE WHEN has_more_tomb THEN jsonb_build_object('ts_ms', floor(extract(epoch FROM tasks_tomb_cursor_ts) * 1000), 'id', tasks_tomb_cursor_id::text) ELSE NULL END
      )
    ),
    'migrationRequired', false,
    'changes', jsonb_build_object(
      'tasks', jsonb_build_object(
        'created', '[]'::jsonb, -- created handled via upsert on client
        'updated', tasks_active_rows,
        'deleted', tasks_deleted_rows
      ),
      'series', jsonb_build_object('created', '[]'::jsonb, 'updated', '[]'::jsonb, 'deleted', '[]'::jsonb),
      'occurrence_overrides', jsonb_build_object('created', '[]'::jsonb, 'updated', '[]'::jsonb, 'deleted', '[]'::jsonb)
    )
  );
END;
$$;

-- Indexes to support efficient pagination on tasks
CREATE INDEX IF NOT EXISTS idx_tasks_updated_at_id_active
  ON public.tasks (updated_at, id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_deleted_at_id_tombstones
  ON public.tasks (deleted_at, id)
  WHERE deleted_at IS NOT NULL;


