-- Promote approved community strains into the canonical strain_cache table.
-- This keeps user submissions moderated (pending) but ensures approved strains live in the same table
-- as the backfilled dataset.

-- 1) Trigger function: when a community strain becomes approved, insert it into strain_cache
CREATE OR REPLACE FUNCTION public.promote_community_strain_to_strain_cache()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
BEGIN
  -- Only act when status transitions to approved
  IF TG_OP = 'UPDATE'
     AND (OLD.status IS DISTINCT FROM NEW.status)
     AND NEW.status = 'approved' THEN

    -- If strain already exists in cache (canonical), do not overwrite.
    IF EXISTS (
      SELECT 1
      FROM public.strain_cache sc
      WHERE sc.slug = NEW.slug
    ) THEN
      RETURN NEW;
    END IF;

    INSERT INTO public.strain_cache (
      id,
      slug,
      name,
      race,
      data,
      created_at,
      updated_at
    ) VALUES (
      NEW.id,
      NEW.slug,
      NEW.name,
      NEW.race,
      NEW.data,
      NEW.created_at,  -- preserve original submission timestamp
      now()
    )
    ON CONFLICT (id) DO NOTHING;  -- defensive: handle unlikely id collision
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_promote_community_strain_to_strain_cache ON public.community_strains;

CREATE TRIGGER trg_promote_community_strain_to_strain_cache
AFTER UPDATE OF status ON public.community_strains
FOR EACH ROW
WHEN (NEW.status = 'approved' AND OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.promote_community_strain_to_strain_cache();

-- 2) Update the public view to avoid duplicates once approved strains are promoted.
DROP VIEW IF EXISTS public.strains_public;

CREATE VIEW public.strains_public AS
  SELECT id, slug, name, race, data
  FROM public.strain_cache
  UNION ALL
  SELECT cs.id, cs.slug, cs.name, cs.race, cs.data
  FROM public.community_strains cs
  WHERE cs.status = 'approved'
    AND NOT EXISTS (
      SELECT 1
      FROM public.strain_cache sc
      WHERE sc.slug = cs.slug
    );

GRANT SELECT ON public.strains_public TO anon, authenticated;
