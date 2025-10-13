-- Nutrient Engine Tables Migration
-- Creates all remaining nutrient engine tables for server-side sync
-- Includes RLS policies and sync pull/push integration

BEGIN;

-- =============================================================================
-- 1. Create feeding_templates table
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.feeding_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  medium text NOT NULL CHECK (medium IN ('soil', 'coco', 'hydro')),
  phases_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  target_ranges_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_custom boolean NOT NULL DEFAULT true,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  server_revision bigint,
  server_updated_at_ms bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_feeding_templates_user ON public.feeding_templates (user_id);
CREATE INDEX IF NOT EXISTS idx_feeding_templates_medium ON public.feeding_templates (medium);
CREATE INDEX IF NOT EXISTS idx_feeding_templates_updated ON public.feeding_templates (updated_at);

-- =============================================================================
-- 2. Create reservoirs_v2 table
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.reservoirs_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  volume_l double precision NOT NULL CHECK (volume_l > 0),
  medium text NOT NULL CHECK (medium IN ('soil', 'coco', 'hydro')),
  target_ph_min double precision NOT NULL CHECK (target_ph_min >= 0 AND target_ph_min <= 14),
  target_ph_max double precision NOT NULL CHECK (target_ph_max >= 0 AND target_ph_max <= 14 AND target_ph_max > target_ph_min),
  target_ec_min_25c double precision NOT NULL CHECK (target_ec_min_25c >= 0 AND target_ec_min_25c <= 10),
  target_ec_max_25c double precision NOT NULL CHECK (target_ec_max_25c >= 0 AND target_ec_max_25c <= 10 AND target_ec_max_25c > target_ec_min_25c),
  ppm_scale text NOT NULL CHECK (ppm_scale IN ('500', '700')),
  source_water_profile_id uuid,
  playbook_binding text,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  server_revision bigint,
  server_updated_at_ms bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_reservoirs_v2_user ON public.reservoirs_v2 (user_id);
CREATE INDEX IF NOT EXISTS idx_reservoirs_v2_medium ON public.reservoirs_v2 (medium);
CREATE INDEX IF NOT EXISTS idx_reservoirs_v2_updated ON public.reservoirs_v2 (updated_at);

-- =============================================================================
-- 3. Create source_water_profiles_v2 table
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.source_water_profiles_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  baseline_ec_25c double precision NOT NULL CHECK (baseline_ec_25c >= 0 AND baseline_ec_25c <= 10),
  alkalinity_mg_per_l_caco3 double precision NOT NULL CHECK (alkalinity_mg_per_l_caco3 >= 0),
  hardness_mg_per_l double precision NOT NULL CHECK (hardness_mg_per_l >= 0),
  last_tested_at timestamptz NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  server_revision bigint,
  server_updated_at_ms bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_source_water_profiles_v2_user ON public.source_water_profiles_v2 (user_id);
CREATE INDEX IF NOT EXISTS idx_source_water_profiles_v2_updated ON public.source_water_profiles_v2 (updated_at);

-- Add foreign key from reservoirs to source water profiles
ALTER TABLE public.reservoirs_v2 
  ADD CONSTRAINT fk_reservoirs_source_water_profile 
  FOREIGN KEY (source_water_profile_id) 
  REFERENCES public.source_water_profiles_v2(id) 
  ON DELETE SET NULL;

-- =============================================================================
-- 4. Create calibrations table
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.calibrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meter_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('ph', 'ec')),
  points_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  slope double precision NOT NULL,
  cal_offset double precision NOT NULL,
  temp_c double precision NOT NULL CHECK (temp_c >= 5 AND temp_c <= 40),
  method text CHECK (method IN ('one_point', 'two_point', 'three_point')),
  valid_days integer CHECK (valid_days > 0),
  performed_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  is_valid boolean NOT NULL DEFAULT true,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  server_revision bigint,
  server_updated_at_ms bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_calibrations_meter ON public.calibrations (meter_id);
CREATE INDEX IF NOT EXISTS idx_calibrations_user ON public.calibrations (user_id);
CREATE INDEX IF NOT EXISTS idx_calibrations_updated ON public.calibrations (updated_at);
CREATE INDEX IF NOT EXISTS idx_calibrations_expires ON public.calibrations (expires_at);

-- =============================================================================
-- 5. Create deviation_alerts_v2 table
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.deviation_alerts_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reading_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('ph_high', 'ph_low', 'ec_high', 'ec_low')),
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  message text NOT NULL,
  recommendations_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommendation_codes_json jsonb DEFAULT '[]'::jsonb,
  cooldown_until timestamptz,
  triggered_at timestamptz NOT NULL,
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  delivered_at_local timestamptz,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  server_revision bigint,
  server_updated_at_ms bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_deviation_alerts_v2_reading ON public.deviation_alerts_v2 (reading_id);
CREATE INDEX IF NOT EXISTS idx_deviation_alerts_v2_user ON public.deviation_alerts_v2 (user_id);
CREATE INDEX IF NOT EXISTS idx_deviation_alerts_v2_triggered ON public.deviation_alerts_v2 (triggered_at);
CREATE INDEX IF NOT EXISTS idx_deviation_alerts_v2_updated ON public.deviation_alerts_v2 (updated_at);

-- =============================================================================
-- 6. Create reservoir_events table
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.reservoir_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservoir_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('FILL', 'DILUTE', 'ADD_NUTRIENT', 'PH_UP', 'PH_DOWN', 'CHANGE')),
  delta_ec_25c double precision,
  delta_ph double precision,
  note text,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  server_revision bigint,
  server_updated_at_ms bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_reservoir_events_reservoir ON public.reservoir_events (reservoir_id);
CREATE INDEX IF NOT EXISTS idx_reservoir_events_user ON public.reservoir_events (user_id);
CREATE INDEX IF NOT EXISTS idx_reservoir_events_created ON public.reservoir_events (created_at);
CREATE INDEX IF NOT EXISTS idx_reservoir_events_updated ON public.reservoir_events (updated_at);

-- Add foreign key from reservoir_events to reservoirs
ALTER TABLE public.reservoir_events
  ADD CONSTRAINT fk_reservoir_events_reservoir
  FOREIGN KEY (reservoir_id)
  REFERENCES public.reservoirs_v2(id)
  ON DELETE CASCADE;

-- =============================================================================
-- 7. Create diagnostic_results_v2 table
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.diagnostic_results_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id uuid NOT NULL,
  reservoir_id uuid,
  water_profile_id uuid,
  issue_type text NOT NULL,
  issue_severity text NOT NULL CHECK (issue_severity IN ('low', 'medium', 'high')),
  nutrient_code text,
  confidence double precision NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  confidence_source text NOT NULL CHECK (confidence_source IN ('rules', 'ai', 'hybrid')),
  rules_confidence double precision CHECK (rules_confidence >= 0 AND rules_confidence <= 1),
  ai_confidence double precision CHECK (ai_confidence >= 0 AND ai_confidence <= 1),
  confidence_threshold double precision CHECK (confidence_threshold >= 0 AND confidence_threshold <= 1),
  rules_based boolean NOT NULL DEFAULT true,
  ai_override boolean NOT NULL DEFAULT false,
  needs_second_opinion boolean NOT NULL DEFAULT false,
  symptoms_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  rationale_json jsonb DEFAULT '{}'::jsonb,
  recommendations_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommendation_codes_json jsonb DEFAULT '[]'::jsonb,
  disclaimer_keys_json jsonb DEFAULT '[]'::jsonb,
  input_reading_ids_json jsonb DEFAULT '[]'::jsonb,
  ai_hypothesis_id text,
  ai_metadata_json jsonb DEFAULT '{}'::jsonb,
  feedback_helpful_count integer DEFAULT 0,
  feedback_not_helpful_count integer DEFAULT 0,
  confidence_flags_json jsonb DEFAULT '[]'::jsonb,
  resolution_notes text,
  resolved_at timestamptz,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  server_revision bigint,
  server_updated_at_ms bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_diagnostic_results_v2_plant ON public.diagnostic_results_v2 (plant_id);
CREATE INDEX IF NOT EXISTS idx_diagnostic_results_v2_reservoir ON public.diagnostic_results_v2 (reservoir_id);
CREATE INDEX IF NOT EXISTS idx_diagnostic_results_v2_user ON public.diagnostic_results_v2 (user_id);
CREATE INDEX IF NOT EXISTS idx_diagnostic_results_v2_issue ON public.diagnostic_results_v2 (issue_type);
CREATE INDEX IF NOT EXISTS idx_diagnostic_results_v2_created ON public.diagnostic_results_v2 (created_at);
CREATE INDEX IF NOT EXISTS idx_diagnostic_results_v2_updated ON public.diagnostic_results_v2 (updated_at);

-- Add foreign keys
ALTER TABLE public.diagnostic_results_v2
  ADD CONSTRAINT fk_diagnostic_results_reservoir
  FOREIGN KEY (reservoir_id)
  REFERENCES public.reservoirs_v2(id)
  ON DELETE SET NULL;

ALTER TABLE public.diagnostic_results_v2
  ADD CONSTRAINT fk_diagnostic_results_water_profile
  FOREIGN KEY (water_profile_id)
  REFERENCES public.source_water_profiles_v2(id)
  ON DELETE SET NULL;

-- =============================================================================
-- 8. Add updated_at triggers for all tables
-- =============================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Triggers for each table
DROP TRIGGER IF EXISTS set_updated_at_feeding_templates ON public.feeding_templates;
CREATE TRIGGER set_updated_at_feeding_templates
BEFORE UPDATE ON public.feeding_templates
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_reservoirs_v2 ON public.reservoirs_v2;
CREATE TRIGGER set_updated_at_reservoirs_v2
BEFORE UPDATE ON public.reservoirs_v2
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_source_water_profiles_v2 ON public.source_water_profiles_v2;
CREATE TRIGGER set_updated_at_source_water_profiles_v2
BEFORE UPDATE ON public.source_water_profiles_v2
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_calibrations ON public.calibrations;
CREATE TRIGGER set_updated_at_calibrations
BEFORE UPDATE ON public.calibrations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_deviation_alerts_v2 ON public.deviation_alerts_v2;
CREATE TRIGGER set_updated_at_deviation_alerts_v2
BEFORE UPDATE ON public.deviation_alerts_v2
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_reservoir_events ON public.reservoir_events;
CREATE TRIGGER set_updated_at_reservoir_events
BEFORE UPDATE ON public.reservoir_events
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_diagnostic_results_v2 ON public.diagnostic_results_v2;
CREATE TRIGGER set_updated_at_diagnostic_results_v2
BEFORE UPDATE ON public.diagnostic_results_v2
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 9. Enable RLS and create policies
-- =============================================================================

-- Enable RLS
ALTER TABLE public.feeding_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservoirs_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_water_profiles_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calibrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deviation_alerts_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservoir_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnostic_results_v2 ENABLE ROW LEVEL SECURITY;

-- feeding_templates policies
CREATE POLICY "Users can view own feeding templates" ON public.feeding_templates
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own feeding templates" ON public.feeding_templates
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own feeding templates" ON public.feeding_templates
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own feeding templates" ON public.feeding_templates
  FOR DELETE USING (auth.uid() = user_id);

-- reservoirs_v2 policies
CREATE POLICY "Users can view own reservoirs" ON public.reservoirs_v2
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reservoirs" ON public.reservoirs_v2
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reservoirs" ON public.reservoirs_v2
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own reservoirs" ON public.reservoirs_v2
  FOR DELETE USING (auth.uid() = user_id);

-- source_water_profiles_v2 policies
CREATE POLICY "Users can view own water profiles" ON public.source_water_profiles_v2
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own water profiles" ON public.source_water_profiles_v2
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own water profiles" ON public.source_water_profiles_v2
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own water profiles" ON public.source_water_profiles_v2
  FOR DELETE USING (auth.uid() = user_id);

-- calibrations policies
CREATE POLICY "Users can view own calibrations" ON public.calibrations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own calibrations" ON public.calibrations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own calibrations" ON public.calibrations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own calibrations" ON public.calibrations
  FOR DELETE USING (auth.uid() = user_id);

-- deviation_alerts_v2 policies
CREATE POLICY "Users can view own alerts" ON public.deviation_alerts_v2
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own alerts" ON public.deviation_alerts_v2
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own alerts" ON public.deviation_alerts_v2
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own alerts" ON public.deviation_alerts_v2
  FOR DELETE USING (auth.uid() = user_id);

-- reservoir_events policies
CREATE POLICY "Users can view own reservoir events" ON public.reservoir_events
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reservoir events" ON public.reservoir_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reservoir events" ON public.reservoir_events
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own reservoir events" ON public.reservoir_events
  FOR DELETE USING (auth.uid() = user_id);

-- diagnostic_results_v2 policies
CREATE POLICY "Users can view own diagnostic results" ON public.diagnostic_results_v2
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own diagnostic results" ON public.diagnostic_results_v2
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own diagnostic results" ON public.diagnostic_results_v2
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own diagnostic results" ON public.diagnostic_results_v2
  FOR DELETE USING (auth.uid() = user_id);

COMMIT;
