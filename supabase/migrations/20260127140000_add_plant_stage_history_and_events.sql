-- Add stage_entered_at and plant stage/event tables
-- Digital Twin TaskEngine data layer support

BEGIN;

ALTER TABLE public.plants
  ADD COLUMN IF NOT EXISTS stage_entered_at timestamptz;

-- Backfill stage_entered_at from planted_at when available
UPDATE public.plants
SET stage_entered_at = planted_at
WHERE stage_entered_at IS NULL
  AND planted_at IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Table: plant_stage_history
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.plant_stage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id uuid NOT NULL,
  from_stage text,
  to_stage text,
  trigger text NOT NULL,
  reason text,
  occurred_at timestamptz NOT NULL,
  metadata_json jsonb,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  server_revision bigint,
  server_updated_at_ms bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

COMMENT ON TABLE public.plant_stage_history IS 'Plant stage transition history for digital twin scheduling.';

CREATE INDEX IF NOT EXISTS idx_plant_stage_history_plant
  ON public.plant_stage_history(plant_id);
CREATE INDEX IF NOT EXISTS idx_plant_stage_history_user_updated
  ON public.plant_stage_history(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_plant_stage_history_occurred_at
  ON public.plant_stage_history(occurred_at);

ALTER TABLE public.plant_stage_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "plant_stage_history_select_own" ON public.plant_stage_history;
CREATE POLICY "plant_stage_history_select_own"
  ON public.plant_stage_history FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "plant_stage_history_insert_own" ON public.plant_stage_history;
CREATE POLICY "plant_stage_history_insert_own"
  ON public.plant_stage_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "plant_stage_history_update_own" ON public.plant_stage_history;
CREATE POLICY "plant_stage_history_update_own"
  ON public.plant_stage_history FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "plant_stage_history_delete_own" ON public.plant_stage_history;
CREATE POLICY "plant_stage_history_delete_own"
  ON public.plant_stage_history FOR DELETE
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Table: plant_events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.plant_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id uuid NOT NULL,
  kind text NOT NULL,
  occurred_at timestamptz NOT NULL,
  payload_json jsonb,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  server_revision bigint,
  server_updated_at_ms bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

COMMENT ON TABLE public.plant_events IS 'Discrete plant events used by the digital twin engine.';

CREATE INDEX IF NOT EXISTS idx_plant_events_plant
  ON public.plant_events(plant_id);
CREATE INDEX IF NOT EXISTS idx_plant_events_user_updated
  ON public.plant_events(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_plant_events_occurred_at
  ON public.plant_events(occurred_at);

ALTER TABLE public.plant_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "plant_events_select_own" ON public.plant_events;
CREATE POLICY "plant_events_select_own"
  ON public.plant_events FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "plant_events_insert_own" ON public.plant_events;
CREATE POLICY "plant_events_insert_own"
  ON public.plant_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "plant_events_update_own" ON public.plant_events;
CREATE POLICY "plant_events_update_own"
  ON public.plant_events FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "plant_events_delete_own" ON public.plant_events;
CREATE POLICY "plant_events_delete_own"
  ON public.plant_events FOR DELETE
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['plant_stage_history', 'plant_events'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated_at ON public.%I;', tbl, tbl);
    EXECUTE format(
      'CREATE TRIGGER trg_%1$I_updated_at BEFORE INSERT OR UPDATE ON public.%1$I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();',
      tbl
    );
  END LOOP;
END$$;

COMMIT;
