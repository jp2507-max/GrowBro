-- Security fix: Add explicit search_path to SECURITY DEFINER function
-- Prevents path poisoning attacks by pinning search_path to trusted schemas

CREATE OR REPLACE FUNCTION privacy.cleanup_expired_data()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = privacy, pg_catalog
AS $$
BEGIN
  DELETE FROM privacy.data_processing_events
  WHERE retention_until < NOW();
END;
$$;