-- Migration: Create pg_cron job for processing notification requests
-- This job runs every 1 minute to process queued notification requests

-- Ensure pg_cron extension is enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage on cron schema to postgres role
GRANT USAGE ON SCHEMA cron TO postgres;

-- Drop existing job if it exists (for idempotent migrations)
SELECT cron.unschedule('process-notification-requests')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'process-notification-requests'
);

-- Create function to call the Edge Function via HTTP
CREATE OR REPLACE FUNCTION process_notification_requests()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  ef_secret text;
  supabase_url text;
  http_response record;
BEGIN
  -- Read the configured edge function secret
  ef_secret := current_setting('app.edge_function_secret', true);
  IF ef_secret IS NULL THEN
    RAISE WARNING 'app.edge_function_secret is not configured; skipping notification request processing';
    RETURN;
  END IF;

  -- Get Supabase URL from environment
  supabase_url := current_setting('app.supabase_url', true);
  IF supabase_url IS NULL THEN
    RAISE WARNING 'app.supabase_url is not configured; skipping notification request processing';
    RETURN;
  END IF;

  -- Call Edge Function via HTTP POST
  SELECT * INTO http_response
  FROM net.http_post(
    url := supabase_url || '/functions/v1/process-notification-requests',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Function-Secret', ef_secret
    ),
    body := '{}'::jsonb
  );

  -- Log the response for monitoring
  IF http_response.status_code >= 400 THEN
    RAISE WARNING 'Notification request processing failed with HTTP %: %', 
      http_response.status_code, 
      http_response.content::text;
  ELSE
    RAISE LOG 'Notification request processing completed: %', http_response.content::text;
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    -- Don't fail silently - log the error but don't crash the job
    RAISE WARNING 'Error processing notification requests: % %', SQLERRM, SQLSTATE;
END;
$$;

-- Schedule the job to run every 1 minute
-- Note: This requires the net extension for HTTP requests
-- Run: CREATE EXTENSION IF NOT EXISTS pg_net; before enabling this job
SELECT cron.schedule(
  'process-notification-requests',
  '* * * * *', -- Every 1 minute
  $$SELECT process_notification_requests()$$
);

-- Add comment documenting the job
COMMENT ON FUNCTION process_notification_requests() IS 
'Processes queued notification requests every 1 minute. Calls send-push-notification Edge Function with retry logic for each unprocessed request.';

-- Note: To enable this job, you must:
-- 1. Enable pg_cron: CREATE EXTENSION IF NOT EXISTS pg_cron;
-- 2. Enable pg_net: CREATE EXTENSION IF NOT EXISTS pg_net;
-- 3. Set app.edge_function_secret and app.supabase_url in postgresql.conf or via ALTER DATABASE
--
-- Example:
-- ALTER DATABASE postgres SET app.edge_function_secret = 'your-secret-here';
-- ALTER DATABASE postgres SET app.supabase_url = 'https://your-project.supabase.co';
