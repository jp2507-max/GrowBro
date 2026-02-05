-- Security + maintenance for pg_net tables.

-- NOTE: The following optimizations were attempted but skipped due to permissions:
-- 1. Moving pg_net to 'extensions' schema (Extension does not support SET SCHEMA)
-- 2. Tuning autovacuum on net._http_response (Requires superuser/owner modification of extension tables)
-- 3. Tuning autovacuum on net.http_request_queue (Requires superuser/owner modification of extension tables)

DO $$
BEGIN
  -- Perform a one-time stats update to ensure good query planning.
  -- This is the only part allowed for non-superuser roles.
  
  IF to_regclass('net._http_response') IS NOT NULL THEN
    EXECUTE 'ANALYZE net._http_response;';
  END IF;

  IF to_regclass('net.http_request_queue') IS NOT NULL THEN
    EXECUTE 'ANALYZE net.http_request_queue;';
  END IF;
END
$$;

