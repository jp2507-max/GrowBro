-- SQL functions for WatermelonDB sync
-- perform_sync_pull: returns per-table changes and a stable server timestamp
-- apply_sync_push: applies client changes transactionally with idempotency and conflict checks

CREATE OR REPLACE FUNCTION public.perform_sync_pull(
  last_pulled_at_ms bigint
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  last_ts timestamptz := to_timestamp(COALESCE(last_pulled_at_ms, 0) / 1000.0);
  server_ts timestamptz := transaction_timestamp();
  server_ms bigint := floor(extract(epoch FROM server_ts) * 1000);
  result jsonb;
BEGIN
  -- Build changes for 'series'
  WITH series_created AS (
    SELECT jsonb_agg(jsonb_build_object(
      'id', id,
      'title', title,
      'description', description,
      'dtstart_local', to_char(dtstart_local, 'YYYY-MM-DD"T"HH24:MI:SS'),
      'dtstart_utc', to_char(dtstart_utc AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'timezone', timezone,
      'rrule', rrule,
      'until_utc', CASE WHEN until_utc IS NULL THEN NULL ELSE to_char(until_utc AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END,
      'count', count,
      'plant_id', plant_id,
      'created_at', floor(extract(epoch FROM created_at) * 1000),
      'updated_at', floor(extract(epoch FROM updated_at) * 1000)
    )) AS arr
    FROM public.series
    WHERE created_at > last_ts
      AND updated_at <= server_ts
      AND deleted_at IS NULL
  ), series_updated AS (
    SELECT jsonb_agg(jsonb_build_object(
      'id', id,
      'title', title,
      'description', description,
      'dtstart_local', to_char(dtstart_local, 'YYYY-MM-DD"T"HH24:MI:SS'),
      'dtstart_utc', to_char(dtstart_utc AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'timezone', timezone,
      'rrule', rrule,
      'until_utc', CASE WHEN until_utc IS NULL THEN NULL ELSE to_char(until_utc AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END,
      'count', count,
      'plant_id', plant_id,
      'created_at', floor(extract(epoch FROM created_at) * 1000),
      'updated_at', floor(extract(epoch FROM updated_at) * 1000)
    )) AS arr
    FROM public.series
    WHERE created_at <= last_ts
      AND updated_at > last_ts
      AND updated_at <= server_ts
      AND deleted_at IS NULL
  ), series_deleted AS (
    SELECT jsonb_agg(id)::jsonb AS arr
    FROM public.series
    WHERE deleted_at IS NOT NULL
      AND deleted_at > last_ts
      AND deleted_at <= server_ts
  )
  , tasks_created AS (
    SELECT jsonb_agg(jsonb_build_object(
      'id', id,
      'series_id', series_id,
      'title', title,
      'description', description,
      'due_at_local', to_char(due_at_local, 'YYYY-MM-DD"T"HH24:MI:SS'),
      'due_at_utc', to_char(due_at_utc AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'timezone', timezone,
      'reminder_at_local', CASE WHEN reminder_at_local IS NULL THEN NULL ELSE to_char(reminder_at_local, 'YYYY-MM-DD"T"HH24:MI:SS') END,
      'reminder_at_utc', CASE WHEN reminder_at_utc IS NULL THEN NULL ELSE to_char(reminder_at_utc AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END,
      'plant_id', plant_id,
      'status', status,
      'completed_at', CASE WHEN completed_at IS NULL THEN NULL ELSE to_char(completed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END,
      'metadata', COALESCE(metadata, '{}'::jsonb),
      'created_at', floor(extract(epoch FROM created_at) * 1000),
      'updated_at', floor(extract(epoch FROM updated_at) * 1000)
    )) AS arr
    FROM public.tasks
    WHERE created_at > last_ts
      AND updated_at <= server_ts
      AND deleted_at IS NULL
  ), tasks_updated AS (
    SELECT jsonb_agg(jsonb_build_object(
      'id', id,
      'series_id', series_id,
      'title', title,
      'description', description,
      'due_at_local', to_char(due_at_local, 'YYYY-MM-DD"T"HH24:MI:SS'),
      'due_at_utc', to_char(due_at_utc AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'timezone', timezone,
      'reminder_at_local', CASE WHEN reminder_at_local IS NULL THEN NULL ELSE to_char(reminder_at_local, 'YYYY-MM-DD"T"HH24:MI:SS') END,
      'reminder_at_utc', CASE WHEN reminder_at_utc IS NULL THEN NULL ELSE to_char(reminder_at_utc AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END,
      'plant_id', plant_id,
      'status', status,
      'completed_at', CASE WHEN completed_at IS NULL THEN NULL ELSE to_char(completed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END,
      'metadata', COALESCE(metadata, '{}'::jsonb),
      'created_at', floor(extract(epoch FROM created_at) * 1000),
      'updated_at', floor(extract(epoch FROM updated_at) * 1000)
    )) AS arr
    FROM public.tasks
    WHERE created_at <= last_ts
      AND updated_at > last_ts
      AND updated_at <= server_ts
      AND deleted_at IS NULL
  ), tasks_deleted AS (
    SELECT jsonb_agg(id)::jsonb AS arr
    FROM public.tasks
    WHERE deleted_at IS NOT NULL
      AND deleted_at > last_ts
      AND deleted_at <= server_ts
  )
  , occ_created AS (
    SELECT jsonb_agg(jsonb_build_object(
      'id', id,
      'series_id', series_id,
      'occurrence_local_date', occurrence_local_date::text,
      'due_at_local', CASE WHEN due_at_local IS NULL THEN NULL ELSE to_char(due_at_local, 'YYYY-MM-DD"T"HH24:MI:SS') END,
      'due_at_utc', CASE WHEN due_at_utc IS NULL THEN NULL ELSE to_char(due_at_utc AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END,
      'reminder_at_local', CASE WHEN reminder_at_local IS NULL THEN NULL ELSE to_char(reminder_at_local, 'YYYY-MM-DD"T"HH24:MI:SS') END,
      'reminder_at_utc', CASE WHEN reminder_at_utc IS NULL THEN NULL ELSE to_char(reminder_at_utc AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END,
      'status', status,
      'created_at', floor(extract(epoch FROM created_at) * 1000),
      'updated_at', floor(extract(epoch FROM updated_at) * 1000)
    )) AS arr
    FROM public.occurrence_overrides
    WHERE created_at > last_ts
      AND updated_at <= server_ts
      AND deleted_at IS NULL
  ), occ_updated AS (
    SELECT jsonb_agg(jsonb_build_object(
      'id', id,
      'series_id', series_id,
      'occurrence_local_date', occurrence_local_date::text,
      'due_at_local', CASE WHEN due_at_local IS NULL THEN NULL ELSE to_char(due_at_local, 'YYYY-MM-DD"T"HH24:MI:SS') END,
      'due_at_utc', CASE WHEN due_at_utc IS NULL THEN NULL ELSE to_char(due_at_utc AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END,
      'reminder_at_local', CASE WHEN reminder_at_local IS NULL THEN NULL ELSE to_char(reminder_at_local, 'YYYY-MM-DD"T"HH24:MI:SS') END,
      'reminder_at_utc', CASE WHEN reminder_at_utc IS NULL THEN NULL ELSE to_char(reminder_at_utc AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END,
      'status', status,
      'created_at', floor(extract(epoch FROM created_at) * 1000),
      'updated_at', floor(extract(epoch FROM updated_at) * 1000)
    )) AS arr
    FROM public.occurrence_overrides
    WHERE created_at <= last_ts
      AND updated_at > last_ts
      AND updated_at <= server_ts
      AND deleted_at IS NULL
  ), occ_deleted AS (
    SELECT jsonb_agg(id)::jsonb AS arr
    FROM public.occurrence_overrides
    WHERE deleted_at IS NOT NULL
      AND deleted_at > last_ts
      AND deleted_at <= server_ts
  )
  SELECT jsonb_build_object(
    'changes', jsonb_build_object(
      'series', jsonb_build_object(
        'created', COALESCE((SELECT arr FROM series_created), '[]'::jsonb),
        'updated', COALESCE((SELECT arr FROM series_updated), '[]'::jsonb),
        'deleted', COALESCE((SELECT arr FROM series_deleted), '[]'::jsonb)
      ),
      'tasks', jsonb_build_object(
        'created', COALESCE((SELECT arr FROM tasks_created), '[]'::jsonb),
        'updated', COALESCE((SELECT arr FROM tasks_updated), '[]'::jsonb),
        'deleted', COALESCE((SELECT arr FROM tasks_deleted), '[]'::jsonb)
      ),
      'occurrence_overrides', jsonb_build_object(
        'created', COALESCE((SELECT arr FROM occ_created), '[]'::jsonb),
        'updated', COALESCE((SELECT arr FROM occ_updated), '[]'::jsonb),
        'deleted', COALESCE((SELECT arr FROM occ_deleted), '[]'::jsonb)
      )
    ),
    'timestamp', server_ms
  ) INTO result;

  RETURN result;
END;
$$;


CREATE OR REPLACE FUNCTION public.apply_sync_push(
  last_pulled_at_ms bigint,
  changes jsonb,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  last_ts timestamptz := to_timestamp(COALESCE(last_pulled_at_ms, 0) / 1000.0);
  inserted_id bigint;
  conflict_count int := 0;
  response jsonb := jsonb_build_object('applied', true);
BEGIN
  -- Idempotency insert or fetch existing
  INSERT INTO public.sync_idempotency (user_id, idempotency_key)
  VALUES (COALESCE(auth.uid()::uuid, '00000000-0000-0000-0000-000000000000'::uuid), p_idempotency_key)
  ON CONFLICT DO NOTHING
  RETURNING id INTO inserted_id;

  IF inserted_id IS NULL THEN
    -- Existing key, return stored response
    RETURN COALESCE((SELECT response_payload FROM public.sync_idempotency
                     WHERE user_id = COALESCE(auth.uid()::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
                       AND idempotency_key = p_idempotency_key), jsonb_build_object('applied', true));
  END IF;

  -- Pre-check conflicts for updated + deleted across tables
  -- series
  SELECT COUNT(*) INTO conflict_count FROM public.series s
  WHERE s.id IN (
    SELECT (rec->>'id')::uuid FROM jsonb_array_elements(COALESCE(changes->'series'->'updated', '[]'::jsonb)) rec
    UNION
    SELECT (id)::uuid FROM (
      SELECT (elem)::text AS id FROM jsonb_array_elements_text(COALESCE(changes->'series'->'deleted','[]'::jsonb)) elem
    ) ids
  )
  AND s.updated_at > last_ts;
  IF conflict_count > 0 THEN
    RAISE EXCEPTION 'changed since lastPulledAt' USING ERRCODE = 'P0001';
  END IF;

  -- tasks
  SELECT COUNT(*) INTO conflict_count FROM public.tasks t
  WHERE t.id IN (
    SELECT (rec->>'id')::uuid FROM jsonb_array_elements(COALESCE(changes->'tasks'->'updated', '[]'::jsonb)) rec
    UNION
    SELECT (id)::uuid FROM (
      SELECT (elem)::text AS id FROM jsonb_array_elements_text(COALESCE(changes->'tasks'->'deleted','[]'::jsonb)) elem
    ) ids
  )
  AND t.updated_at > last_ts;
  IF conflict_count > 0 THEN
    RAISE EXCEPTION 'changed since lastPulledAt' USING ERRCODE = 'P0001';
  END IF;

  -- occurrence_overrides
  SELECT COUNT(*) INTO conflict_count FROM public.occurrence_overrides o
  WHERE o.id IN (
    SELECT (rec->>'id')::uuid FROM jsonb_array_elements(COALESCE(changes->'occurrence_overrides'->'updated', '[]'::jsonb)) rec
    UNION
    SELECT (id)::uuid FROM (
      SELECT (elem)::text AS id FROM jsonb_array_elements_text(COALESCE(changes->'occurrence_overrides'->'deleted','[]'::jsonb)) elem
    ) ids
  )
  AND o.updated_at > last_ts;
  IF conflict_count > 0 THEN
    RAISE EXCEPTION 'changed since lastPulledAt' USING ERRCODE = 'P0001';
  END IF;

  -- Apply creates (idempotent upsert)
  -- series created
  INSERT INTO public.series (id, title, description, dtstart_local, dtstart_utc, timezone, rrule, until_utc, count, plant_id)
  SELECT (rec->>'id')::uuid,
         rec->>'title',
         rec->>'description',
         (rec->>'dtstart_local')::timestamp,
         (rec->>'dtstart_utc')::timestamptz,
         rec->>'timezone',
         rec->>'rrule',
         CASE WHEN rec ? 'until_utc' AND rec->>'until_utc' IS NOT NULL THEN (rec->>'until_utc')::timestamptz ELSE NULL END,
         CASE WHEN rec ? 'count' THEN NULLIF(rec->>'count','')::int ELSE NULL END,
         CASE WHEN rec ? 'plant_id' AND rec->>'plant_id' <> '' THEN (rec->>'plant_id')::uuid ELSE NULL END
  FROM jsonb_array_elements(COALESCE(changes->'series'->'created','[]'::jsonb)) rec
  ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    dtstart_local = EXCLUDED.dtstart_local,
    dtstart_utc = EXCLUDED.dtstart_utc,
    timezone = EXCLUDED.timezone,
    rrule = EXCLUDED.rrule,
    until_utc = EXCLUDED.until_utc,
    count = EXCLUDED.count,
    plant_id = EXCLUDED.plant_id;

  -- tasks created
  INSERT INTO public.tasks (id, series_id, title, description, due_at_local, due_at_utc, timezone, reminder_at_local, reminder_at_utc, plant_id, status, completed_at, metadata)
  SELECT (rec->>'id')::uuid,
         CASE WHEN rec ? 'series_id' AND rec->>'series_id' <> '' THEN (rec->>'series_id')::uuid ELSE NULL END,
         rec->>'title',
         rec->>'description',
         (rec->>'due_at_local')::timestamp,
         (rec->>'due_at_utc')::timestamptz,
         rec->>'timezone',
         CASE WHEN rec ? 'reminder_at_local' AND rec->>'reminder_at_local' IS NOT NULL THEN (rec->>'reminder_at_local')::timestamp ELSE NULL END,
         CASE WHEN rec ? 'reminder_at_utc' AND rec->>'reminder_at_utc' IS NOT NULL THEN (rec->>'reminder_at_utc')::timestamptz ELSE NULL END,
         CASE WHEN rec ? 'plant_id' AND rec->>'plant_id' <> '' THEN (rec->>'plant_id')::uuid ELSE NULL END,
         rec->>'status',
         CASE WHEN rec ? 'completed_at' AND rec->>'completed_at' IS NOT NULL THEN (rec->>'completed_at')::timestamptz ELSE NULL END,
         COALESCE((rec->>'metadata')::jsonb, '{}'::jsonb)
  FROM jsonb_array_elements(COALESCE(changes->'tasks'->'created','[]'::jsonb)) rec
  ON CONFLICT (id) DO UPDATE SET
    series_id = EXCLUDED.series_id,
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    due_at_local = EXCLUDED.due_at_local,
    due_at_utc = EXCLUDED.due_at_utc,
    timezone = EXCLUDED.timezone,
    reminder_at_local = EXCLUDED.reminder_at_local,
    reminder_at_utc = EXCLUDED.reminder_at_utc,
    plant_id = EXCLUDED.plant_id,
    status = EXCLUDED.status,
    completed_at = EXCLUDED.completed_at,
    metadata = EXCLUDED.metadata;

  -- occurrence_overrides created
  INSERT INTO public.occurrence_overrides (id, series_id, occurrence_local_date, due_at_local, due_at_utc, reminder_at_local, reminder_at_utc, status)
  SELECT (rec->>'id')::uuid,
         (rec->>'series_id')::uuid,
         (rec->>'occurrence_local_date')::date,
         CASE WHEN rec ? 'due_at_local' AND rec->>'due_at_local' IS NOT NULL THEN (rec->>'due_at_local')::timestamp ELSE NULL END,
         CASE WHEN rec ? 'due_at_utc' AND rec->>'due_at_utc' IS NOT NULL THEN (rec->>'due_at_utc')::timestamptz ELSE NULL END,
         CASE WHEN rec ? 'reminder_at_local' AND rec->>'reminder_at_local' IS NOT NULL THEN (rec->>'reminder_at_local')::timestamp ELSE NULL END,
         CASE WHEN rec ? 'reminder_at_utc' AND rec->>'reminder_at_utc' IS NOT NULL THEN (rec->>'reminder_at_utc')::timestamptz ELSE NULL END,
         rec->>'status'
  FROM jsonb_array_elements(COALESCE(changes->'occurrence_overrides'->'created','[]'::jsonb)) rec
  ON CONFLICT (id) DO UPDATE SET
    series_id = EXCLUDED.series_id,
    occurrence_local_date = EXCLUDED.occurrence_local_date,
    due_at_local = EXCLUDED.due_at_local,
    due_at_utc = EXCLUDED.due_at_utc,
    reminder_at_local = EXCLUDED.reminder_at_local,
    reminder_at_utc = EXCLUDED.reminder_at_utc,
    status = EXCLUDED.status;

  -- Apply updates
  -- series updated
  UPDATE public.series s SET
    title = rec.title,
    description = rec.description,
    dtstart_local = rec.dtstart_local,
    dtstart_utc = rec.dtstart_utc,
    timezone = rec.timezone,
    rrule = rec.rrule,
    until_utc = rec.until_utc,
    count = rec.count,
    plant_id = rec.plant_id
  FROM (
    SELECT (rec->>'id')::uuid AS id,
           rec->>'title' AS title,
           rec->>'description' AS description,
           (rec->>'dtstart_local')::timestamp AS dtstart_local,
           (rec->>'dtstart_utc')::timestamptz AS dtstart_utc,
           rec->>'timezone' AS timezone,
           rec->>'rrule' AS rrule,
           CASE WHEN rec ? 'until_utc' AND rec->>'until_utc' IS NOT NULL THEN (rec->>'until_utc')::timestamptz ELSE NULL END AS until_utc,
           CASE WHEN rec ? 'count' THEN NULLIF(rec->>'count','')::int ELSE NULL END AS count,
           CASE WHEN rec ? 'plant_id' AND rec->>'plant_id' <> '' THEN (rec->>'plant_id')::uuid ELSE NULL END AS plant_id
    FROM jsonb_array_elements(COALESCE(changes->'series'->'updated','[]'::jsonb)) rec
  ) rec
  WHERE s.id = rec.id;

  -- tasks updated
  UPDATE public.tasks t SET
    series_id = rec.series_id,
    title = rec.title,
    description = rec.description,
    due_at_local = rec.due_at_local,
    due_at_utc = rec.due_at_utc,
    timezone = rec.timezone,
    reminder_at_local = rec.reminder_at_local,
    reminder_at_utc = rec.reminder_at_utc,
    plant_id = rec.plant_id,
    status = rec.status,
    completed_at = rec.completed_at,
    metadata = rec.metadata
  FROM (
    SELECT (rec->>'id')::uuid AS id,
           CASE WHEN rec ? 'series_id' AND rec->>'series_id' <> '' THEN (rec->>'series_id')::uuid ELSE NULL END AS series_id,
           rec->>'title' AS title,
           rec->>'description' AS description,
           (rec->>'due_at_local')::timestamp AS due_at_local,
           (rec->>'due_at_utc')::timestamptz AS due_at_utc,
           rec->>'timezone' AS timezone,
           CASE WHEN rec ? 'reminder_at_local' AND rec->>'reminder_at_local' IS NOT NULL THEN (rec->>'reminder_at_local')::timestamp ELSE NULL END AS reminder_at_local,
           CASE WHEN rec ? 'reminder_at_utc' AND rec->>'reminder_at_utc' IS NOT NULL THEN (rec->>'reminder_at_utc')::timestamptz ELSE NULL END AS reminder_at_utc,
           CASE WHEN rec ? 'plant_id' AND rec->>'plant_id' <> '' THEN (rec->>'plant_id')::uuid ELSE NULL END AS plant_id,
           rec->>'status' AS status,
           CASE WHEN rec ? 'completed_at' AND rec->>'completed_at' IS NOT NULL THEN (rec->>'completed_at')::timestamptz ELSE NULL END AS completed_at,
           COALESCE((rec->>'metadata')::jsonb, '{}'::jsonb) AS metadata
    FROM jsonb_array_elements(COALESCE(changes->'tasks'->'updated','[]'::jsonb)) rec
  ) rec
  WHERE t.id = rec.id;

  -- occurrence_overrides updated
  UPDATE public.occurrence_overrides o SET
    series_id = rec.series_id,
    occurrence_local_date = rec.occurrence_local_date,
    due_at_local = rec.due_at_local,
    due_at_utc = rec.due_at_utc,
    reminder_at_local = rec.reminder_at_local,
    reminder_at_utc = rec.reminder_at_utc,
    status = rec.status
  FROM (
    SELECT (rec->>'id')::uuid AS id,
           (rec->>'series_id')::uuid AS series_id,
           (rec->>'occurrence_local_date')::date AS occurrence_local_date,
           CASE WHEN rec ? 'due_at_local' AND rec->>'due_at_local' IS NOT NULL THEN (rec->>'due_at_local')::timestamp ELSE NULL END AS due_at_local,
           CASE WHEN rec ? 'due_at_utc' AND rec->>'due_at_utc' IS NOT NULL THEN (rec->>'due_at_utc')::timestamptz ELSE NULL END AS due_at_utc,
           CASE WHEN rec ? 'reminder_at_local' AND rec->>'reminder_at_local' IS NOT NULL THEN (rec->>'reminder_at_local')::timestamp ELSE NULL END AS reminder_at_local,
           CASE WHEN rec ? 'reminder_at_utc' AND rec->>'reminder_at_utc' IS NOT NULL THEN (rec->>'reminder_at_utc')::timestamptz ELSE NULL END AS reminder_at_utc,
           rec->>'status' AS status
    FROM jsonb_array_elements(COALESCE(changes->'occurrence_overrides'->'updated','[]'::jsonb)) rec
  ) rec
  WHERE o.id = rec.id;

  -- Apply deletes (soft delete)
  UPDATE public.series SET deleted_at = now()
  WHERE id IN (
    SELECT (elem)::uuid FROM jsonb_array_elements_text(COALESCE(changes->'series'->'deleted','[]'::jsonb)) elem
  );

  UPDATE public.tasks SET deleted_at = now()
  WHERE id IN (
    SELECT (elem)::uuid FROM jsonb_array_elements_text(COALESCE(changes->'tasks'->'deleted','[]'::jsonb)) elem
  );

  UPDATE public.occurrence_overrides SET deleted_at = now()
  WHERE id IN (
    SELECT (elem)::uuid FROM jsonb_array_elements_text(COALESCE(changes->'occurrence_overrides'->'deleted','[]'::jsonb)) elem
  );

  -- Store response payload for idempotency
  UPDATE public.sync_idempotency SET response_payload = response, updated_at = now()
  WHERE id = inserted_id;

  RETURN response;
END;
$$;


