-- Update auth lockout RPC functions to accept hashed emails directly
-- This prevents plaintext emails from being logged in RPC call parameters

-- Drop existing functions first (required to change parameter names)
DROP FUNCTION IF EXISTS check_and_increment_lockout(TEXT);
DROP FUNCTION IF EXISTS reset_lockout_counter(TEXT);

-- Recreate check_and_increment_lockout function to accept p_email_hash instead of p_email
CREATE OR REPLACE FUNCTION check_and_increment_lockout(p_email_hash TEXT)
RETURNS JSONB AS $$
DECLARE
  v_lockout RECORD;
  v_max_attempts CONSTANT INTEGER := 5;
  v_lockout_window CONSTANT INTERVAL := '15 minutes';
  v_lockout_duration INTERVAL;
  v_locked_until TIMESTAMPTZ;
BEGIN
  -- Validate input: email_hash must not be null or empty
  IF p_email_hash IS NULL OR trim(p_email_hash) = '' THEN
    RAISE EXCEPTION 'Email hash parameter cannot be null or empty';
  END IF;

  -- Get or create lockout record using provided hash
  INSERT INTO auth_lockouts (email_hash, failed_attempts, created_at, updated_at)
  VALUES (p_email_hash, 0, NOW(), NOW())
  ON CONFLICT (email_hash)
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
    WHERE email_hash = p_email_hash;

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
  WHERE email_hash = p_email_hash
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
    WHERE email_hash = p_email_hash;

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

-- Update reset_lockout_counter function to accept p_email_hash instead of p_email
CREATE OR REPLACE FUNCTION reset_lockout_counter(p_email_hash TEXT)
RETURNS VOID AS $$
BEGIN
  -- Validate input: email_hash must not be null or empty
  IF p_email_hash IS NULL OR trim(p_email_hash) = '' THEN
    RAISE EXCEPTION 'Email hash parameter cannot be null or empty';
  END IF;

  UPDATE auth_lockouts
  SET failed_attempts = 0,
      locked_until = NULL,
      updated_at = NOW()
  WHERE email_hash = p_email_hash;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update comments to reflect the change
COMMENT ON FUNCTION check_and_increment_lockout(TEXT) IS 'Checks lockout status and increments failed attempt counter using hashed email. Returns lockout state.';
COMMENT ON FUNCTION reset_lockout_counter(TEXT) IS 'Resets failed attempt counter after successful authentication using hashed email.';
