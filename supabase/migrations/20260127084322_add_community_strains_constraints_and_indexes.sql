-- Add partial unique constraint on slug for approved strains
-- and index on created_by to optimize owner queries

-- Prevent duplicate approved slugs at the data level
CREATE UNIQUE INDEX IF NOT EXISTS community_strains_approved_slug_unique_idx
  ON public.community_strains (slug)
  WHERE status = 'approved';

-- Optimize owner queries
CREATE INDEX IF NOT EXISTS community_strains_created_by_idx
  ON public.community_strains (created_by);