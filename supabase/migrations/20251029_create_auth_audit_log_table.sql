-- Create auth_audit_log table for authentication event logging
-- Service-role only access for security and compliance (GDPR Art. 30 ROPA)

CREATE TABLE IF NOT EXISTS auth_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'sign_in',
    'sign_up',
    'sign_out',
    'password_reset',
    'email_verified',
    'lockout',
    'session_revoked',
    'lockout_expired',
    'mfa_enabled',
    'mfa_disabled'
  )),
  ip_address INET,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_auth_audit_log_user_id ON auth_audit_log(user_id);
CREATE INDEX idx_auth_audit_log_event_type ON auth_audit_log(event_type);
CREATE INDEX idx_auth_audit_log_created_at ON auth_audit_log(created_at DESC);

-- Add comments for documentation
COMMENT ON TABLE auth_audit_log IS 'Audit log for authentication events. Service-role only access for security and compliance.';
COMMENT ON COLUMN auth_audit_log.user_id IS 'User ID (NULL if user deleted or anonymous event)';
COMMENT ON COLUMN auth_audit_log.event_type IS 'Type of authentication event';
COMMENT ON COLUMN auth_audit_log.ip_address IS 'Source IP address (may be truncated for privacy)';
COMMENT ON COLUMN auth_audit_log.user_agent IS 'User agent string from request headers';
COMMENT ON COLUMN auth_audit_log.metadata IS 'Additional event context (device info, error codes, etc.)';

-- Enable Row Level Security
ALTER TABLE auth_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Service role only (no direct mobile app access)
CREATE POLICY "Only service role can access audit logs"
  ON auth_audit_log
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Helper function to log auth events (callable by Edge Functions with service role)
CREATE OR REPLACE FUNCTION log_auth_event(
  p_user_id UUID,
  p_event_type TEXT,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO auth_audit_log (
    user_id,
    event_type,
    ip_address,
    user_agent,
    metadata,
    created_at
  )
  VALUES (
    p_user_id,
    p_event_type,
    p_ip_address,
    p_user_agent,
    p_metadata,
    NOW()
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION log_auth_event IS 'Helper function to log authentication events. Only callable by service role.';
