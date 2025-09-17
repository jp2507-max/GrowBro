-- Enforce same-owner ownership for harvests.plant_id/user_id and inventory.harvest_id/user_id and inventory.plant_id/user_id
-- Idempotent creation of PL/pgSQL functions and triggers

-- Function: public.check_harvest_owner()
CREATE OR REPLACE FUNCTION public.check_harvest_owner()
RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  plant_owner uuid;
BEGIN
  -- Only check when plant_id or user_id is being changed (NEW may be for INSERT or UPDATE)
  IF (TG_OP = 'INSERT') OR (TG_OP = 'UPDATE' AND (NEW.plant_id IS DISTINCT FROM OLD.plant_id OR NEW.user_id IS DISTINCT FROM OLD.user_id)) THEN
    SELECT user_id INTO plant_owner FROM public.plants WHERE id = NEW.plant_id;
    IF NOT FOUND OR plant_owner IS NULL OR plant_owner <> NEW.user_id THEN
      RAISE EXCEPTION 'harvests must reference a plant owned by the same user (plant_id=% / plant_owner=% / new_user=%)', NEW.plant_id, plant_owner, NEW.user_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger on harvests
DO $$
BEGIN
  -- remove old trigger if exists
  EXECUTE 'DROP TRIGGER IF EXISTS trg_check_harvest_owner ON public.harvests;';
  -- create trigger
  EXECUTE 'CREATE TRIGGER trg_check_harvest_owner BEFORE INSERT OR UPDATE ON public.harvests FOR EACH ROW EXECUTE FUNCTION public.check_harvest_owner();';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Skipping creation of trg_check_harvest_owner: %', SQLERRM;
END$$;

-- Function: public.check_inventory_owner()
CREATE OR REPLACE FUNCTION public.check_inventory_owner()
RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  harvest_owner uuid;
  plant_owner uuid;
BEGIN
  -- Only check when harvest_id, plant_id or user_id is being changed
  IF (TG_OP = 'INSERT') OR (TG_OP = 'UPDATE' AND (NEW.harvest_id IS DISTINCT FROM OLD.harvest_id OR NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.plant_id IS DISTINCT FROM OLD.plant_id)) THEN
    -- verify harvest exists and is owned by same user
    SELECT user_id INTO harvest_owner FROM public.harvests WHERE id = NEW.harvest_id;
    IF NOT FOUND OR harvest_owner IS NULL OR harvest_owner <> NEW.user_id THEN
      RAISE EXCEPTION 'inventory must reference a harvest owned by the same user (harvest_id=% / harvest_owner=% / new_user=%)', NEW.harvest_id, harvest_owner, NEW.user_id;
    END IF;

    -- If inventory references a plant_id, also ensure plant is owned by same user
    IF NEW.plant_id IS NOT NULL THEN
      SELECT user_id INTO plant_owner FROM public.plants WHERE id = NEW.plant_id;
      IF NOT FOUND OR plant_owner IS NULL OR plant_owner <> NEW.user_id THEN
        RAISE EXCEPTION 'inventory must reference a plant owned by the same user (plant_id=% / plant_owner=% / new_user=%)', NEW.plant_id, plant_owner, NEW.user_id;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger on inventory
DO $$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS trg_check_inventory_owner ON public.inventory;';
  EXECUTE 'CREATE TRIGGER trg_check_inventory_owner BEFORE INSERT OR UPDATE ON public.inventory FOR EACH ROW EXECUTE FUNCTION public.check_inventory_owner();';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Skipping creation of trg_check_inventory_owner: %', SQLERRM;
END$$;
