-- Migration: Security Email Log
-- Description: Creates table for tracking security notification emails with debouncing
-- Purpose: Track sent security emails to enforce 10-minute debounce window
-- Requirements: 11.7, 11.10

-- Security email log table for debouncing
CREATE TABLE security_email_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_type TEXT NOT NULL CHECK (email_type IN ('password_change', 'session_revoke', 'all_sessions_revoke')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT security_email_log_user_type_sent_unique UNIQUE(user_id, email_type, sent_at)
);

-- Add indexes for efficient debounce queries
CREATE INDEX idx_security_email_log_user_id ON security_email_log(user_id);
CREATE INDEX idx_security_email_log_sent_at ON security_email_log(sent_at);
CREATE INDEX idx_security_email_log_user_type_sent ON security_email_log(user_id, email_type, sent_at DESC);

-- Enable RLS
ALTER TABLE security_email_log ENABLE ROW LEVEL SECURITY;

-- RLS policies (only service role can access)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'security_email_log' AND policyname = 'Service role can manage security email log') THEN
    CREATE POLICY "Service role can manage security email log"
      ON security_email_log
      USING (auth.jwt()->>'role' = 'service_role');
  END IF;
END $$;

-- Function to clean up old log entries (older than 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_security_email_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM security_email_log
  WHERE sent_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comment for documentation
COMMENT ON TABLE security_email_log IS 'Tracks sent security notification emails for debouncing (10-minute window)';
COMMENT ON COLUMN security_email_log.email_type IS 'Type of security email: password_change, session_revoke, or all_sessions_revoke';
COMMENT ON COLUMN security_email_log.sent_at IS 'Timestamp when the email was sent';
