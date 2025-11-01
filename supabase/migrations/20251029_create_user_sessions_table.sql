-- Create user_sessions table for device and session tracking
-- Tracks active sessions across devices with session_key (SHA-256 hash of refresh token)

CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_key TEXT NOT NULL,
  device_name TEXT,
  os TEXT,
  app_version TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

-- Create indexes for performance
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE UNIQUE INDEX idx_user_sessions_session_key ON user_sessions(session_key);

-- Add comments for documentation
COMMENT ON TABLE user_sessions IS 'Tracks active user sessions across devices with device metadata';
COMMENT ON COLUMN user_sessions.session_key IS 'SHA-256 hash of refresh token for stable session identification';
COMMENT ON COLUMN user_sessions.ip_address IS 'Truncated IP address (last octet masked for privacy)';
COMMENT ON COLUMN user_sessions.revoked_at IS 'Timestamp when session was revoked (NULL = active)';

-- Enable Row Level Security
ALTER TABLE user_sessions FORCE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own sessions
CREATE POLICY "Users can view their own sessions"
  ON user_sessions FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Users can revoke their own sessions
CREATE POLICY "Users can revoke their own sessions"
  ON user_sessions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Service role can insert sessions (via Edge Functions)
CREATE POLICY "Service role can insert sessions"
  ON user_sessions FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- RLS Policy: Service role can update sessions (via Edge Functions)
CREATE POLICY "Service role can update all sessions"
  ON user_sessions FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
