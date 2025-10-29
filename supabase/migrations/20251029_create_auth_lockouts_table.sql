-- Create auth_lockouts table for brute-force protection
-- Tracks failed login attempts and account lockout status

CREATE TABLE IF NOT EXISTS auth_lockouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create unique index on email
CREATE UNIQUE INDEX idx_auth_lockouts_email ON auth_lockouts(email);

-- Add comments for documentation
COMMENT ON TABLE auth_lockouts IS 'Tracks failed login attempts and account lockout status for brute-force protection';
COMMENT ON COLUMN auth_lockouts.failed_attempts IS 'Number of consecutive failed login attempts';
COMMENT ON COLUMN auth_lockouts.locked_until IS 'Timestamp until which account is locked (NULL = not locked)';

-- RPC function to check and increment lockout
-- Returns: { is_locked: boolean, locked_until: timestamp, attempts_remaining: number }
CREATE OR REPLACE FUNCTION check_and_increment_lockout(p_email TEXT)
RETURNS JSONB AS $$
DECLARE
  v_lockout RECORD;
  v_max_attempts CONSTANT INTEGER := 5;
  v_lockout_window CONSTANT INTERVAL := '15 minutes';
  v_lockout_duration INTERVAL;
  v_locked_until TIMESTAMPTZ;
BEGIN
  -- Get or create lockout record
  INSERT INTO auth_lockouts (email, failed_attempts, created_at, updated_at)
  VALUES (p_email, 0, NOW(), NOW())
  ON CONFLICT (email) 
  DO UPDATE SET updated_at = NOW()
  RETURNING * INTO v_lockout;

  -- Check if account is currently locked
  IF v_lockout.locked_until IS NOT NULL AND v_lockout.locked_until > NOW() THEN
    RETURN jsonb_build_object(
      'is_locked', true,
      'locked_until', v_lockout.locked_until,
      'attempts_remaining', 0
    );
  END IF;

  -- Reset counter if lockout window has passed
  IF v_lockout.updated_at < NOW() - v_lockout_window THEN
    UPDATE auth_lockouts
    SET failed_attempts = 1,
        locked_until = NULL,
        updated_at = NOW()
    WHERE email = p_email;
    
    RETURN jsonb_build_object(
      'is_locked', false,
      'locked_until', NULL,
      'attempts_remaining', v_max_attempts - 1
    );
  END IF;

  -- Increment failed attempts
  UPDATE auth_lockouts
  SET failed_attempts = failed_attempts + 1,
      updated_at = NOW()
  WHERE email = p_email
  RETURNING * INTO v_lockout;

  -- Check if we need to lock the account
  IF v_lockout.failed_attempts >= v_max_attempts THEN
    -- Progressive lockout: 15 min, 30 min, 1 hour, 2 hours, etc.
    v_lockout_duration := '15 minutes'::INTERVAL * POWER(2, v_lockout.failed_attempts - v_max_attempts);
    
    -- Cap at 24 hours
    IF v_lockout_duration > '24 hours'::INTERVAL THEN
      v_lockout_duration := '24 hours'::INTERVAL;
    END IF;
    
    v_locked_until := NOW() + v_lockout_duration;
    
    UPDATE auth_lockouts
    SET locked_until = v_locked_until,
        updated_at = NOW()
    WHERE email = p_email;
    
    RETURN jsonb_build_object(
      'is_locked', true,
      'locked_until', v_locked_until,
      'attempts_remaining', 0
    );
  END IF;

  -- Not locked yet
  RETURN jsonb_build_object(
    'is_locked', false,
    'locked_until', NULL,
    'attempts_remaining', v_max_attempts - v_lockout.failed_attempts
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC function to reset lockout counter
-- Called after successful authentication
CREATE OR REPLACE FUNCTION reset_lockout_counter(p_email TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE auth_lockouts
  SET failed_attempts = 0,
      locked_until = NULL,
      updated_at = NOW()
  WHERE email = p_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments for RPC functions
COMMENT ON FUNCTION check_and_increment_lockout(TEXT) IS 'Checks lockout status and increments failed attempt counter. Returns lockout state.';
COMMENT ON FUNCTION reset_lockout_counter(TEXT) IS 'Resets failed attempt counter after successful authentication.';
