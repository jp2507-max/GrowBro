-- Privacy Data Processing Events Schema
-- Implements secure tracking of data processing activities with RLS, proper indexing, and automated cleanup

-- Prerequisites
CREATE EXTENSION IF NOT EXISTS pgcrypto;        -- for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pg_cron;         -- for scheduled cleanup (Supabase supports this)

-- Enum aligned with ProcessingPurpose from privacy-consent.ts
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t WHERE t.typname = 'processing_purpose_enum') THEN
    CREATE TYPE processing_purpose_enum AS ENUM (
      'analytics', 'crashReporting', 'personalizedData', 'sessionReplay', 'diagnosis', 'aiInference', 'aiTraining'
    );
  END IF;
END $$;

-- Data processing tracking (use dedicated schema for governance)
CREATE SCHEMA IF NOT EXISTS privacy;

CREATE TABLE IF NOT EXISTS privacy.data_processing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  processing_purpose processing_purpose_enum NOT NULL,
  data_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  retention_until TIMESTAMPTZ NOT NULL,
  consent_applicable BOOLEAN NOT NULL DEFAULT TRUE,  -- false for essential purposes like crash reporting
  consent_given BOOLEAN,                             -- null when not applicable
  consent_timestamp TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_dpe_user ON privacy.data_processing_events (user_id);
CREATE INDEX IF NOT EXISTS idx_dpe_retention ON privacy.data_processing_events (retention_until);
CREATE INDEX IF NOT EXISTS idx_dpe_purpose ON privacy.data_processing_events (processing_purpose);
CREATE INDEX IF NOT EXISTS idx_dpe_created_at ON privacy.data_processing_events (created_at);

-- Row Level Security
ALTER TABLE privacy.data_processing_events ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see and manage their own data processing events
CREATE POLICY "user_can_manage_own_events"
  ON privacy.data_processing_events
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Automatic cleanup function (security definer for elevated privileges if needed)
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

-- Schedule daily cleanup at 02:00 UTC (avoiding peak hours)
-- First try to unschedule any existing job with the same name
SELECT cron.unschedule('privacy_cleanup_dpe') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'privacy_cleanup_dpe'
);

-- Then schedule the new job
SELECT cron.schedule(
  'privacy_cleanup_dpe',
  '0 2 * * *',
  $$SELECT privacy.cleanup_expired_data();$$
);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA privacy TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON privacy.data_processing_events TO authenticated;
REVOKE EXECUTE ON FUNCTION privacy.cleanup_expired_data() FROM authenticated;
GRANT EXECUTE ON FUNCTION privacy.cleanup_expired_data() TO service_role;

-- Add helpful comments
COMMENT ON TABLE privacy.data_processing_events IS 'Tracks data processing activities with consent and retention management';
COMMENT ON COLUMN privacy.data_processing_events.consent_applicable IS 'False for essential purposes that don''t require consent (e.g., crash reporting)';
COMMENT ON COLUMN privacy.data_processing_events.consent_given IS 'User consent status - null when consent is not applicable';
