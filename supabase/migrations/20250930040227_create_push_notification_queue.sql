-- Migration: Create push_notification_queue table for per-device delivery tracking
-- This table tracks push notification delivery status per device for Expo Push Service integration
-- Enables precise retry logic, error analysis, and per-device analytics

CREATE TABLE IF NOT EXISTS public.push_notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  message_id TEXT NOT NULL,
  type TEXT NOT NULL,
  device_token TEXT,
  platform TEXT CHECK (platform IN ('ios', 'android', 'web')),
  provider_message_name TEXT,
  payload_summary JSONB,
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'error')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Foreign key constraint to users table
  CONSTRAINT fk_push_notification_queue_user_id
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_push_notification_queue_user_id 
  ON public.push_notification_queue(user_id);

CREATE INDEX IF NOT EXISTS idx_push_notification_queue_status 
  ON public.push_notification_queue(status);

CREATE INDEX IF NOT EXISTS idx_push_notification_queue_type 
  ON public.push_notification_queue(type);

CREATE INDEX IF NOT EXISTS idx_push_notification_queue_created_at 
  ON public.push_notification_queue(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_push_notification_queue_provider_message 
  ON public.push_notification_queue(provider_message_name) 
  WHERE provider_message_name IS NOT NULL;

-- Enable RLS
ALTER TABLE public.push_notification_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_notification_queue FORCE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can read own push notification queue entries"
  ON public.push_notification_queue FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all push notification queue entries"
  ON public.push_notification_queue FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Grant permissions
GRANT SELECT ON public.push_notification_queue TO authenticated;
GRANT ALL ON public.push_notification_queue TO service_role;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_push_notification_queue_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS trigger_push_notification_queue_updated_at ON public.push_notification_queue;
CREATE TRIGGER trigger_push_notification_queue_updated_at
  BEFORE UPDATE ON public.push_notification_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.update_push_notification_queue_updated_at();

COMMENT ON TABLE public.push_notification_queue IS 'Tracks push notification delivery status per device. One row per device/send attempt enables precise retry logic, error analysis, and per-device analytics. provider_message_name stores Expo ticket ID for receipt polling.';
