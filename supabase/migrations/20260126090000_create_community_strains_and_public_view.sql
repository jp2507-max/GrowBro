-- Community strains: user-submitted strains with moderation
-- Adds a unified view to query strain_cache + approved community strains.

CREATE SCHEMA IF NOT EXISTS extensions;

-- Needed for gen_random_uuid() default
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Needed for trigram search indexes (matches existing strain_cache search)
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.community_strains (
  id text PRIMARY KEY DEFAULT (extensions.gen_random_uuid())::text,
  slug text NOT NULL,
  name text NOT NULL,
  race text NOT NULL,
  data jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES auth.users (id),
  reviewed_at timestamptz,
  review_notes text
);

ALTER TABLE public.community_strains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_strains FORCE ROW LEVEL SECURITY;

-- Grants (RLS still applies)
GRANT SELECT ON public.community_strains TO anon, authenticated;
GRANT INSERT ON public.community_strains TO authenticated;

-- Policies
DROP POLICY IF EXISTS "community_strains_public_read_approved" ON public.community_strains;
DROP POLICY IF EXISTS "community_strains_owner_read" ON public.community_strains;
DROP POLICY IF EXISTS "community_strains_owner_insert" ON public.community_strains;
DROP POLICY IF EXISTS "community_strains_service_write" ON public.community_strains;

CREATE POLICY "community_strains_public_read_approved"
  ON public.community_strains FOR SELECT
  USING (status = 'approved');

CREATE POLICY "community_strains_owner_read"
  ON public.community_strains FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "community_strains_owner_insert"
  ON public.community_strains FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND status = 'pending'
  );

CREATE POLICY "community_strains_service_write"
  ON public.community_strains FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Indexes for search and moderation
CREATE INDEX IF NOT EXISTS community_strains_status_idx
  ON public.community_strains (status);

CREATE INDEX IF NOT EXISTS community_strains_slug_idx
  ON public.community_strains (slug);

CREATE INDEX IF NOT EXISTS community_strains_name_trgm_idx
  ON public.community_strains USING gin ((lower(name)) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS community_strains_slug_trgm_idx
  ON public.community_strains USING gin ((lower(slug)) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS community_strains_approved_slug_idx
  ON public.community_strains (slug)
  WHERE status = 'approved';

-- Unified public view for client reads
DROP VIEW IF EXISTS public.strains_public;

CREATE VIEW public.strains_public AS
  SELECT id, slug, name, race, data
  FROM public.strain_cache
  UNION ALL
  SELECT id, slug, name, race, data
  FROM public.community_strains
  WHERE status = 'approved';

GRANT SELECT ON public.strains_public TO anon, authenticated;
