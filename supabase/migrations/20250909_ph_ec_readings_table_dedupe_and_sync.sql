BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Create nutrient readings table
CREATE TABLE IF NOT EXISTS public.ph_ec_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id uuid NULL,
  reservoir_id uuid NULL,
  measured_at timestamptz NOT NULL,
  ph double precision NULL,
  ec_raw double precision NULL,
  ec_25c double precision NULL,
  temp_c double precision NULL,
  atc_on boolean NULL,
  ppm_scale text NULL,
  meter_id uuid NULL,
  note text NULL,
  quality_flags jsonb NULL,
  -- helper columns for dedupe (maintained by trigger)
  measured_at_sec timestamptz NULL,
  meter_id_fallback uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);

-- 2) Backfill helper columns for existing data (idempotent)
UPDATE public.ph_ec_readings
SET measured_at_sec = date_trunc('second', measured_at),
    meter_id_fallback = COALESCE(meter_id, '00000000-0000-0000-0000-000000000000'::uuid)
WHERE measured_at_sec IS NULL OR meter_id_fallback IS NULL;

-- 3) Trigger to maintain helper columns on write
CREATE OR REPLACE FUNCTION public.ph_ec_readings_set_helpers()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.measured_at_sec := date_trunc('second', NEW.measured_at);
  NEW.meter_id_fallback := COALESCE(NEW.meter_id, '00000000-0000-0000-0000-000000000000'::uuid);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ph_ec_readings_helpers ON public.ph_ec_readings;
CREATE TRIGGER trg_ph_ec_readings_helpers
BEFORE INSERT OR UPDATE ON public.ph_ec_readings
FOR EACH ROW EXECUTE FUNCTION public.ph_ec_readings_set_helpers();

-- 4) Unique dedupe guard: (plant_id, meter_fallback, measured_at second bucket)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ux_ph_ec_readings_dedupe_cols'
  ) THEN
    ALTER TABLE public.ph_ec_readings
      ADD CONSTRAINT ux_ph_ec_readings_dedupe_cols UNIQUE (plant_id, meter_id_fallback, measured_at_sec);
  END IF;
END $$;

-- 5) Helpful indexes
CREATE INDEX IF NOT EXISTS idx_ph_ec_readings_measured_at ON public.ph_ec_readings (measured_at);
CREATE INDEX IF NOT EXISTS idx_ph_ec_readings_updated_at ON public.ph_ec_readings (updated_at);
CREATE INDEX IF NOT EXISTS idx_ph_ec_readings_plant ON public.ph_ec_readings (plant_id);
CREATE INDEX IF NOT EXISTS idx_ph_ec_readings_meter ON public.ph_ec_readings (meter_id);

-- 6) updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS set_updated_at_ph_ec_readings ON public.ph_ec_readings;
CREATE TRIGGER set_updated_at_ph_ec_readings
BEFORE UPDATE ON public.ph_ec_readings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 7) Extend sync pull to include nutrient readings
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
  WITH
  series_created AS (
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
    WHERE created_at > last_ts AND updated_at <= server_ts AND deleted_at IS NULL
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
    WHERE created_at <= last_ts AND updated_at > last_ts AND updated_at <= server_ts AND deleted_at IS NULL
  ), series_deleted AS (
    SELECT jsonb_agg(id)::jsonb AS arr
    FROM public.series
    WHERE deleted_at IS NOT NULL AND deleted_at > last_ts AND deleted_at <= server_ts
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
    WHERE created_at > last_ts AND updated_at <= server_ts AND deleted_at IS NULL
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
    WHERE created_at <= last_ts AND updated_at > last_ts AND updated_at <= server_ts AND deleted_at IS NULL
  ), tasks_deleted AS (
    SELECT jsonb_agg(id)::jsonb AS arr
    FROM public.tasks
    WHERE deleted_at IS NOT NULL AND deleted_at > last_ts AND deleted_at <= server_ts
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
    WHERE created_at > last_ts AND updated_at <= server_ts AND deleted_at IS NULL
  ), occ_updated AS (
    SELECT jsonb_agg(jsonb_build_object(
      'id', id,
      'series_id', series_id,
      'occurrence_local_date', occurrence_local_date::date,
      'due_at_local', CASE WHEN due_at_local IS NULL THEN NULL ELSE to_char(due_at_local, 'YYYY-MM-DD"T"HH24:MI:SS') END,
      'due_at_utc', CASE WHEN due_at_utc IS NULL THEN NULL ELSE to_char(due_at_utc AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END,
      'reminder_at_local', CASE WHEN reminder_at_local IS NULL THEN NULL ELSE to_char(reminder_at_local, 'YYYY-MM-DD"T"HH24:MI:SS') END,
      'reminder_at_utc', CASE WHEN reminder_at_utc IS NULL THEN NULL ELSE to_char(reminder_at_utc AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END,
      'status', status,
      'created_at', floor(extract(epoch FROM created_at) * 1000),
      'updated_at', floor(extract(epoch FROM updated_at) * 1000)
    )) AS arr
    FROM public.occurrence_overrides
    WHERE created_at <= last_ts AND updated_at > last_ts AND updated_at <= server_ts AND deleted_at IS NULL
  ), occ_deleted AS (
    SELECT jsonb_agg(id)::jsonb AS arr
    FROM public.occurrence_overrides
    WHERE deleted_at IS NOT NULL AND deleted_at > last_ts AND deleted_at <= server_ts
  )
  , ph_created AS (
    SELECT jsonb_agg(jsonb_build_object(
      'id', id,
      'plant_id', plant_id,
      'reservoir_id', reservoir_id,
      'measured_at', to_char(measured_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'ph', ph,
      'ec_raw', ec_raw,
      'ec_25c', ec_25c,
      'temp_c', temp_c,
      'atc_on', atc_on,
      'ppm_scale', ppm_scale,
      'meter_id', meter_id,
      'note', note,
      'quality_flags', COALESCE(quality_flags, '{}'::jsonb),
      'created_at', floor(extract(epoch FROM created_at) * 1000),
      'updated_at', floor(extract(epoch FROM updated_at) * 1000)
    )) AS arr
    FROM public.ph_ec_readings
    WHERE created_at > last_ts AND updated_at <= server_ts AND deleted_at IS NULL
  ), ph_updated AS (
    SELECT jsonb_agg(jsonb_build_object(
      'id', id,
      'plant_id', plant_id,
      'reservoir_id', reservoir_id,
      'measured_at', to_char(measured_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'ph', ph,
      'ec_raw', ec_raw,
      'ec_25c', ec_25c,
      'temp_c', temp_c,
      'atc_on', atc_on,
      'ppm_scale', ppm_scale,
      'meter_id', meter_id,
      'note', note,
      'quality_flags', COALESCE(quality_flags, '{}'::jsonb),
      'created_at', floor(extract(epoch FROM created_at) * 1000),
      'updated_at', floor(extract(epoch FROM updated_at) * 1000)
    )) AS arr
    FROM public.ph_ec_readings
    WHERE created_at <= last_ts AND updated_at > last_ts AND updated_at <= server_ts AND deleted_at IS NULL
  ), ph_deleted AS (
    SELECT jsonb_agg(id)::jsonb AS arr
    FROM public.ph_ec_readings
    WHERE deleted_at IS NOT NULL AND deleted_at > last_ts AND deleted_at <= server_ts
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
      ),
      'ph_ec_readings', jsonb_build_object(
        'created', COALESCE((SELECT arr FROM ph_created), '[]'::jsonb),
        'updated', COALESCE((SELECT arr FROM ph_updated), '[]'::jsonb),
        'deleted', COALESCE((SELECT arr FROM ph_deleted), '[]'::jsonb)
      )
    ),
    'timestamp', server_ms
  ) INTO result;

  RETURN result;
END;
$$;

-- 8) Extend sync push to upsert nutrient readings using the dedupe constraint
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
  INSERT INTO public.sync_idempotency (user_id, idempotency_key)
  VALUES (COALESCE(auth.uid()::uuid, '00000000-0000-0000-0000-000000000000'::uuid), p_idempotency_key)
  ON CONFLICT DO NOTHING
  RETURNING id INTO inserted_id;

  IF inserted_id IS NULL THEN
    RETURN COALESCE((SELECT response_payload FROM public.sync_idempotency
                     WHERE user_id = COALESCE(auth.uid()::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
                       AND idempotency_key = p_idempotency_key), jsonb_build_object('applied', true));
  END IF;

  -- conflict checks (series/tasks/occurrence_overrides)
  SELECT COUNT(*) INTO conflict_count FROM public.series s
  WHERE s.id IN (
    SELECT (rec->>'id')::uuid FROM jsonb_array_elements(COALESCE(changes->'series'->'updated', '[]'::jsonb)) rec
    UNION
    SELECT (id)::uuid FROM (
      SELECT (elem)::text AS id FROM jsonb_array_elements_text(COALESCE(changes->'series'->'deleted','[]'::jsonb)) elem
    ) ids
  ) AND s.updated_at > last_ts;
  IF conflict_count > 0 THEN RAISE EXCEPTION 'changed since lastPulledAt' USING ERRCODE = 'P0001'; END IF;

  SELECT COUNT(*) INTO conflict_count FROM public.tasks t
  WHERE t.id IN (
    SELECT (rec->>'id')::uuid FROM jsonb_array_elements(COALESCE(changes->'tasks'->'updated', '[]'::jsonb)) rec
    UNION
    SELECT (id)::uuid FROM (
      SELECT (elem)::text AS id FROM jsonb_array_elements_text(COALESCE(changes->'tasks'->'deleted','[]'::jsonb)) elem
    ) ids
  ) AND t.updated_at > last_ts;
  IF conflict_count > 0 THEN RAISE EXCEPTION 'changed since lastPulledAt' USING ERRCODE = 'P0001'; END IF;

  SELECT COUNT(*) INTO conflict_count FROM public.occurrence_overrides o
  WHERE o.id IN (
    SELECT (rec->>'id')::uuid FROM jsonb_array_elements(COALESCE(changes->'occurrence_overrides'->'updated', '[]'::jsonb)) rec
    UNION
    SELECT (id)::uuid FROM (
      SELECT (elem)::text AS id FROM jsonb_array_elements_text(COALESCE(changes->'occurrence_overrides'->'deleted','[]'::jsonb)) elem
    ) ids
  ) AND o.updated_at > last_ts;
  IF conflict_count > 0 THEN RAISE EXCEPTION 'changed since lastPulledAt' USING ERRCODE = 'P0001'; END IF;

  -- ph_ec_readings conflict check
  SELECT COUNT(*) INTO conflict_count FROM public.ph_ec_readings r
  WHERE r.id IN (
    SELECT (rec->>'id')::uuid FROM jsonb_array_elements(COALESCE(changes->'ph_ec_readings'->'updated', '[]'::jsonb)) rec
    UNION
    SELECT (id)::uuid FROM (
      SELECT (elem)::text AS id FROM jsonb_array_elements_text(COALESCE(changes->'ph_ec_readings'->'deleted','[]'::jsonb)) elem
    ) ids
  ) AND r.updated_at > last_ts;
  IF conflict_count > 0 THEN RAISE EXCEPTION 'changed since lastPulledAt' USING ERRCODE = 'P0001'; END IF;

  -- Creates (series/tasks/occ preserved)
  -- ph_ec_readings created with dedupe via unique constraint
  INSERT INTO public.ph_ec_readings (
    id, plant_id, reservoir_id, measured_at, ph, ec_raw, ec_25c, temp_c, atc_on, ppm_scale, meter_id, note, quality_flags
  )
  SELECT
    CASE WHEN rec ? 'id' AND rec->>'id' <> '' THEN (rec->>'id')::uuid ELSE gen_random_uuid() END,
    CASE WHEN rec ? 'plant_id' AND rec->>'plant_id' <> '' THEN (rec->>'plant_id')::uuid ELSE NULL END,
    CASE WHEN rec ? 'reservoir_id' AND rec->>'reservoir_id' <> '' THEN (rec->>'reservoir_id')::uuid ELSE NULL END,
    (rec->>'measured_at')::timestamptz,
    NULLIF(rec->>'ph','')::double precision,
    NULLIF(rec->>'ec_raw','')::double precision,
    NULLIF(rec->>'ec_25c','')::double precision,
    NULLIF(rec->>'temp_c','')::double precision,
    CASE WHEN rec ? 'atc_on' THEN (rec->>'atc_on')::boolean ELSE NULL END,
    NULLIF(rec->>'ppm_scale','')::text,
    CASE WHEN rec ? 'meter_id' AND rec->>'meter_id' <> '' THEN (rec->>'meter_id')::uuid ELSE NULL END,
    NULLIF(rec->>'note','')::text,
    COALESCE((rec->>'quality_flags')::jsonb, NULL)
  FROM jsonb_array_elements(COALESCE(changes->'ph_ec_readings'->'created','[]'::jsonb)) rec
  ON CONFLICT ON CONSTRAINT ux_ph_ec_readings_dedupe_cols DO UPDATE SET
    ph = EXCLUDED.ph,
    ec_raw = EXCLUDED.ec_raw,
    ec_25c = EXCLUDED.ec_25c,
    temp_c = EXCLUDED.temp_c,
    atc_on = EXCLUDED.atc_on,
    ppm_scale = EXCLUDED.ppm_scale,
    note = EXCLUDED.note,
    quality_flags = EXCLUDED.quality_flags,
    updated_at = now();

  -- Updates
  UPDATE public.ph_ec_readings r SET
    plant_id = rec.plant_id,
    reservoir_id = rec.reservoir_id,
    measured_at = rec.measured_at,
    ph = rec.ph,
    ec_raw = rec.ec_raw,
    ec_25c = rec.ec_25c,
    temp_c = rec.temp_c,
    atc_on = rec.atc_on,
    ppm_scale = rec.ppm_scale,
    meter_id = rec.meter_id,
    note = rec.note,
    quality_flags = rec.quality_flags
  FROM (
    SELECT (rec->>'id')::uuid AS id,
           CASE WHEN rec ? 'plant_id' AND rec->>'plant_id' <> '' THEN (rec->>'plant_id')::uuid ELSE NULL END AS plant_id,
           CASE WHEN rec ? 'reservoir_id' AND rec->>'reservoir_id' <> '' THEN (rec->>'reservoir_id')::uuid ELSE NULL END AS reservoir_id,
           (rec->>'measured_at')::timestamptz AS measured_at,
           NULLIF(rec->>'ph','')::double precision AS ph,
           NULLIF(rec->>'ec_raw','')::double precision AS ec_raw,
           NULLIF(rec->>'ec_25c','')::double precision AS ec_25c,
           NULLIF(rec->>'temp_c','')::double precision AS temp_c,
           CASE WHEN rec ? 'atc_on' THEN (rec->>'atc_on')::boolean ELSE NULL END AS atc_on,
           NULLIF(rec->>'ppm_scale','')::text AS ppm_scale,
           CASE WHEN rec ? 'meter_id' AND rec->>'meter_id' <> '' THEN (rec->>'meter_id')::uuid ELSE NULL END AS meter_id,
           NULLIF(rec->>'note','')::text AS note,
           COALESCE((rec->>'quality_flags')::jsonb, NULL) AS quality_flags
    FROM jsonb_array_elements(COALESCE(changes->'ph_ec_readings'->'updated','[]'::jsonb)) rec
  ) rec
  WHERE r.id = rec.id;

  -- Soft deletes
  UPDATE public.ph_ec_readings SET deleted_at = now()
  WHERE id IN (
    SELECT (elem)::uuid FROM jsonb_array_elements_text(COALESCE(changes->'ph_ec_readings'->'deleted','[]'::jsonb)) elem
  );

  UPDATE public.sync_idempotency SET response_payload = response, updated_at = now()
  WHERE id = inserted_id;

  RETURN response;
END;
$$;

COMMIT;


