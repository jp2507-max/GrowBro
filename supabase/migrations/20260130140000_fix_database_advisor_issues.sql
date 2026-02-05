-- Migration: Fix Database Advisor Issues
-- Date: 2026-01-30
-- Fixes:
--   SECURITY (ERROR): strains_public view SECURITY DEFINER
--   SECURITY (WARN): set_updated_at function mutable search_path
--   SECURITY (ERROR): app_config table RLS disabled
--   PERFORMANCE (INFO): Missing index on community_strains.reviewed_by FK
--   PERFORMANCE (WARN): RLS policies re-evaluating auth.uid() per row
--   PERFORMANCE (WARN): Multiple permissive policies on community_strains

-- ============================================================================
-- 1. FIX: strains_public view SECURITY DEFINER -> SECURITY INVOKER
-- ============================================================================
-- Drop and recreate view with SECURITY INVOKER (the safer default)
DROP VIEW IF EXISTS public.strains_public;

CREATE VIEW public.strains_public
WITH (security_invoker = true)
AS
SELECT 
    strain_cache.id,
    strain_cache.slug,
    strain_cache.name,
    strain_cache.race,
    strain_cache.data
FROM public.strain_cache
UNION ALL
SELECT 
    community_strains.id,
    community_strains.slug,
    community_strains.name,
    community_strains.race,
    community_strains.data
FROM public.community_strains
WHERE community_strains.status = 'approved'::text;

COMMENT ON VIEW public.strains_public IS 'Public strains view combining strain_cache and approved community_strains. Uses SECURITY INVOKER.';

-- ============================================================================
-- 2. FIX: set_updated_at function mutable search_path
-- ============================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- ============================================================================
-- 3. FIX: Enable RLS on app_config table
-- ============================================================================
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read app_config (it's configuration data)
DROP POLICY IF EXISTS "app_config_select_authenticated" ON public.app_config;
CREATE POLICY "app_config_select_authenticated" ON public.app_config
    FOR SELECT
    TO authenticated
    USING (true);

-- Allow service role to manage app_config
DROP POLICY IF EXISTS "app_config_all_service_role" ON public.app_config;
CREATE POLICY "app_config_all_service_role" ON public.app_config
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- 4. FIX: Add missing index for community_strains.reviewed_by FK
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_community_strains_reviewed_by
    ON public.community_strains (reviewed_by);

-- ============================================================================
-- 5. FIX: RLS policies re-evaluating auth.uid() per row
--    Wrap auth.uid() in (SELECT ...) for better performance
-- ============================================================================

-- 5a. Fix plant_stage_history policies
DROP POLICY IF EXISTS "plant_stage_history_select_own" ON public.plant_stage_history;
CREATE POLICY "plant_stage_history_select_own" ON public.plant_stage_history
    FOR SELECT
    TO authenticated
    USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "plant_stage_history_insert_own" ON public.plant_stage_history;
CREATE POLICY "plant_stage_history_insert_own" ON public.plant_stage_history
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "plant_stage_history_update_own" ON public.plant_stage_history;
CREATE POLICY "plant_stage_history_update_own" ON public.plant_stage_history
    FOR UPDATE
    TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "plant_stage_history_delete_own" ON public.plant_stage_history;
CREATE POLICY "plant_stage_history_delete_own" ON public.plant_stage_history
    FOR DELETE
    TO authenticated
    USING (user_id = (SELECT auth.uid()));

-- 5b. Fix plant_events policies
DROP POLICY IF EXISTS "plant_events_select_own" ON public.plant_events;
CREATE POLICY "plant_events_select_own" ON public.plant_events
    FOR SELECT
    TO authenticated
    USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "plant_events_insert_own" ON public.plant_events;
CREATE POLICY "plant_events_insert_own" ON public.plant_events
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "plant_events_update_own" ON public.plant_events;
CREATE POLICY "plant_events_update_own" ON public.plant_events
    FOR UPDATE
    TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "plant_events_delete_own" ON public.plant_events;
CREATE POLICY "plant_events_delete_own" ON public.plant_events
    FOR DELETE
    TO authenticated
    USING (user_id = (SELECT auth.uid()));

-- 5c. Fix community_strains policies (owner policies use auth.uid())
DROP POLICY IF EXISTS "community_strains_owner_read" ON public.community_strains;
CREATE POLICY "community_strains_owner_read" ON public.community_strains
    FOR SELECT
    TO authenticated
    USING (created_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS "community_strains_owner_insert" ON public.community_strains;
CREATE POLICY "community_strains_owner_insert" ON public.community_strains
    FOR INSERT
    TO authenticated
    WITH CHECK ((created_by = (SELECT auth.uid())) AND (status = 'pending'::text));

-- ============================================================================
-- 6. FIX: Multiple permissive SELECT policies on community_strains
--    Combine owner_read and public_read_approved into a single policy
-- ============================================================================
-- Drop the overlapping policies first
DROP POLICY IF EXISTS "community_strains_owner_read" ON public.community_strains;
DROP POLICY IF EXISTS "community_strains_public_read_approved" ON public.community_strains;

-- Create a single combined policy for SELECT
-- Users can read: their own strains OR any approved strains
CREATE POLICY "community_strains_select" ON public.community_strains
    FOR SELECT
    TO authenticated
    USING (
        (created_by = (SELECT auth.uid()))
        OR
        (status = 'approved'::text)
    );
