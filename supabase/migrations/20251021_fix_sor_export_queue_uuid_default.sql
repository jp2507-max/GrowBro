-- Fix SoR export queue UUID default to use gen_random_uuid() as specified in DSA compliance spec
-- This ensures consistent UUID generation across the system

BEGIN;

-- Drop the existing default constraint and add the correct one
ALTER TABLE public.sor_export_queue
ALTER COLUMN id DROP DEFAULT,
ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Ensure the updated_at trigger is properly set up (it should already exist from the original migration)
-- This is just a safety check to recreate it if needed
CREATE OR REPLACE FUNCTION update_sor_export_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger if it doesn't exist
DROP TRIGGER IF EXISTS trigger_update_sor_export_queue_updated_at ON public.sor_export_queue;
CREATE TRIGGER trigger_update_sor_export_queue_updated_at
  BEFORE UPDATE ON public.sor_export_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_sor_export_queue_updated_at();

COMMIT;
