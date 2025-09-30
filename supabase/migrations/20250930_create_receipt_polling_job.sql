-- Migration: Create pg_cron job for polling Expo push receipts
-- This job runs every 5 minutes to fetch delivery status from Expo Push Service

-- Ensure pg_cron extension is enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage on cron schema to postgres role
GRANT USAGE ON SCHEMA cron TO postgres;

-- Drop existing job if it exists (for idempotent migrations)
SELECT cron.unschedule('poll-expo-push-receipts')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'poll-expo-push-receipts'
);

-- Create function to call the Edge Function via HTTP
CREATE OR REPLACE FUNCTION poll_expo_push_receipts()
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
    RAISE WARNING 'app.edge_function_secret is not configured; skipping receipt polling';
    RETURN;
  END IF;

  -- Get Supabase URL from environment
  supabase_url := current_setting('app.supabase_url', true);
  IF supabase_url IS NULL THEN
    RAISE WARNING 'app.supabase_url is not configured; skipping receipt polling';
    RETURN;
  END IF;

  -- Call Edge Function via HTTP POST
  SELECT * INTO http_response
  FROM net.http_post(
    url := supabase_url || '/functions/v1/poll-push-receipts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Function-Secret', ef_secret
    ),
    body := '{}'::jsonb
  );

  -- Log the response for monitoring
  IF http_response.status_code >= 400 THEN
    RAISE WARNING 'Receipt polling failed with HTTP %: %', 
      http_response.status_code, 
      http_response.content::text;
  ELSE
    RAISE LOG 'Receipt polling completed: %', http_response.content::text;
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    -- Don't fail silently - log the error but don't crash the job
    RAISE WARNING 'Error polling receipts: % %', SQLERRM, SQLSTATE;
END;
$$;

-- Schedule the job to run every 5 minutes
-- Note: This requires the net extension for HTTP requests
-- Run: CREATE EXTENSION IF NOT EXISTS pg_net; before enabling this job
SELECT cron.schedule(
  'poll-expo-push-receipts',
  '*/5 * * * *', -- Every 5 minutes
  $$SELECT poll_expo_push_receipts()$$
);

-- Add comment documenting the job
COMMENT ON FUNCTION poll_expo_push_receipts() IS 
'Polls Expo Push API for delivery receipts every 5 minutes. Updates notification_queue status from sent -> delivered/failed and deactivates tokens on DeviceNotRegistered errors.';

-- Note: To enable this job, you must:
-- 1. Enable pg_cron: CREATE EXTENSION IF NOT EXISTS pg_cron;
-- 2. Enable pg_net: CREATE EXTENSION IF NOT EXISTS pg_net;
-- 3. Set app.edge_function_secret and app.supabase_url in postgresql.conf or via ALTER DATABASE
--
-- Example:
-- ALTER DATABASE postgres SET app.edge_function_secret = 'your-secret-here';
-- ALTER DATABASE postgres SET app.supabase_url = 'https://your-project.supabase.co';
