-- Migration: Add per-device tracking columns to notification_queue table
-- This enables precise delivery tracking, retry logic, and per-device analytics
-- for Expo Push Service integration.

-- First, check if notification_queue table exists (should have been created earlier)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'notification_queue') THEN
    -- Create the notification_queue table if it doesn't exist
    CREATE TABLE notification_queue (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      message_id TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'opened')),
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      
      -- Foreign key constraint to users table
      CONSTRAINT fk_notification_queue_user_id
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
    );
    
    -- Enable RLS
    ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;
    ALTER TABLE notification_queue FORCE ROW LEVEL SECURITY;
    
    -- Allow users to read only their own notification queue entries
    CREATE POLICY "Users can read own notification queue entries"
      ON notification_queue FOR SELECT
      USING (auth.uid() = user_id);
    
    -- Allow service role to manage all notification queue entries
    CREATE POLICY "Service role can manage all notification queue entries"
      ON notification_queue FOR ALL
      USING (auth.jwt() ->> 'role' = 'service_role')
      WITH CHECK (auth.jwt() ->> 'role' = 'service_role');
  END IF;
END
$$;

-- Add new columns for per-device tracking (skip if already exist)
DO $$
BEGIN
  -- Add device_token column for privacy-safe token reference
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'notification_queue' 
    AND column_name = 'device_token'
  ) THEN
    ALTER TABLE notification_queue ADD COLUMN device_token TEXT;
  END IF;

  -- Add platform column to track iOS vs Android
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'notification_queue' 
    AND column_name = 'platform'
  ) THEN
    ALTER TABLE notification_queue ADD COLUMN platform TEXT CHECK (platform IN ('ios', 'android'));
  END IF;

  -- Add provider_message_name for Expo ticket ID storage
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'notification_queue' 
    AND column_name = 'provider_message_name'
  ) THEN
    ALTER TABLE notification_queue ADD COLUMN provider_message_name TEXT;
  END IF;

  -- Add payload_summary for minimal non-PII metadata
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'notification_queue' 
    AND column_name = 'payload_summary'
  ) THEN
    ALTER TABLE notification_queue ADD COLUMN payload_summary JSONB DEFAULT '{}'::jsonb;
  END IF;

  -- Add error_message column for delivery failure tracking
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'notification_queue' 
    AND column_name = 'error_message'
  ) THEN
    ALTER TABLE notification_queue ADD COLUMN error_message TEXT;
  END IF;
END
$$;

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_notification_queue_user_status
  ON notification_queue (user_id, status);

CREATE INDEX IF NOT EXISTS idx_notification_queue_message_id
  ON notification_queue (message_id);

CREATE INDEX IF NOT EXISTS idx_notification_queue_provider_message_name
  ON notification_queue (provider_message_name)
  WHERE provider_message_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notification_queue_status_created
  ON notification_queue (status, created_at)
  WHERE status = 'sent';

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_notification_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS trigger_notification_queue_updated_at ON notification_queue;
CREATE TRIGGER trigger_notification_queue_updated_at
  BEFORE UPDATE ON notification_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_queue_updated_at();

-- Add comment documenting the per-device tracking strategy
COMMENT ON TABLE notification_queue IS 'Tracks push notification delivery status per device. One row per device/send attempt enables precise retry logic, error analysis, and per-device analytics. provider_message_name stores Expo ticket ID for receipt polling.';

COMMENT ON COLUMN notification_queue.device_token IS 'Expo push token (ExponentPushToken[...]) for privacy-safe reference. Used for token deactivation on DeviceNotRegistered errors.';

COMMENT ON COLUMN notification_queue.platform IS 'Device platform (ios/android) for platform-specific analytics and error handling.';

COMMENT ON COLUMN notification_queue.provider_message_name IS 'Expo Push Service ticket ID returned from send API. Used to poll for delivery receipts via /--/api/v2/push/getReceipts endpoint.';

COMMENT ON COLUMN notification_queue.payload_summary IS 'Minimal non-PII payload metadata (platform, keys, has_deeplink flag). Full payloads must NOT be stored here to comply with privacy policies.';

COMMENT ON COLUMN notification_queue.error_message IS 'Error message from Expo Push Service (e.g., DeviceNotRegistered, MessageTooBig). Used for debugging and automatic token cleanup.';
