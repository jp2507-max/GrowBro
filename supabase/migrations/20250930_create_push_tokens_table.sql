-- Create push tokens table for managing device push notification tokens
CREATE TABLE push_tokens (
  user_id UUID NOT NULL,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  last_used_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Composite primary key for upsert operations
  PRIMARY KEY (user_id, token),

  -- Foreign key constraint to users table
  CONSTRAINT fk_push_tokens_user_id
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create index for efficient deactivation queries
CREATE INDEX idx_push_tokens_user_platform_active
  ON push_tokens (user_id, platform, is_active)
  WHERE is_active = true;

-- Create index for token-based deactivation (privacy protection)
CREATE INDEX idx_push_tokens_token_platform_active
  ON push_tokens (token, platform, is_active)
  WHERE is_active = true;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_push_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER trigger_push_tokens_updated_at
  BEFORE UPDATE ON push_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_push_tokens_updated_at();

-- Enable RLS
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

-- Force RLS to be always applied
ALTER TABLE push_tokens FORCE ROW LEVEL SECURITY;

-- Allow users to manage only their own tokens
CREATE POLICY "Users can manage own push tokens"
  ON push_tokens FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow service role to manage all tokens (for background processing)
CREATE POLICY "Service role can manage all push tokens"
  ON push_tokens FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Stored procedure for atomic token upsert with deactivation
-- This prevents race conditions when multiple registrations happen concurrently
CREATE OR REPLACE FUNCTION upsert_push_token(
  p_user_id UUID,
  p_token TEXT,
  p_platform TEXT,
  p_last_used_at TIMESTAMPTZ DEFAULT now()
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Execute all operations in a single transaction for atomicity

  -- First deactivate any existing active tokens for this token (regardless of user_id)
  -- to prevent privacy leaks when device re-registers for different users
  UPDATE push_tokens
  SET is_active = false, updated_at = now()
  WHERE token = p_token
    AND platform = p_platform
    AND is_active = true;

  -- Then deactivate any other active tokens for this user on this platform
  UPDATE push_tokens
  SET is_active = false, last_used_at = p_last_used_at, updated_at = now()
  WHERE user_id = p_user_id
    AND platform = p_platform
    AND token != p_token
    AND is_active = true;

  -- Finally upsert the new active token for this user
  INSERT INTO push_tokens (user_id, token, platform, last_used_at, is_active, created_at, updated_at)
  VALUES (p_user_id, p_token, p_platform, p_last_used_at, true, now(), now())
  ON CONFLICT (user_id, token)
  DO UPDATE SET
    platform = EXCLUDED.platform,
    last_used_at = EXCLUDED.last_used_at,
    is_active = true,
    updated_at = now();

END;
$$;
