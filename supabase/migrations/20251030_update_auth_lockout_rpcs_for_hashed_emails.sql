-- Update auth lockout RPC functions to accept hashed emails directly
-- This prevents plaintext emails from being logged in RPC call parameters

-- Drop existing functions first (required to change parameter names)
DROP FUNCTION IF EXISTS check_and_increment_lockout(TEXT);
DROP FUNCTION IF EXISTS reset_lockout_counter(TEXT);

-- Recreate check_and_increment_lockout function to accept p_email_hash instead of p_email
-- This function implements progressive account lockout protection using hashed emails
-- Returns JSONB with lockout status, remaining attempts, and lockout expiration
CREATE OR REPLACE FUNCTION check_and_increment_lockout(p_email_hash TEXT)
RETURNS JSONB AS $$
DECLARE
  -- Current lockout record from database
  v_lockout RECORD;
  -- Maximum allowed failed attempts before lockout (constant)
  v_max_attempts CONSTANT INTEGER := 5;
  -- Time window during which failed attempts are counted (15 minutes)
  v_lockout_window CONSTANT INTERVAL := '15 minutes';
  -- Calculated lockout duration for progressive lockout
  v_lockout_duration INTERVAL;
  -- Timestamp when the account will be unlocked
  v_locked_until TIMESTAMPTZ;
BEGIN
  -- Input validation: prevent null/empty email hashes to avoid database errors
  -- This also prevents potential bypass attempts with malformed input
  IF p_email_hash IS NULL OR trim(p_email_hash) = '' THEN
    RAISE EXCEPTION 'Email hash parameter cannot be null or empty';
  END IF;

  -- Attempt to get existing lockout record, or create new one if it doesn't exist
  -- Uses UPSERT pattern to handle both new and existing records atomically
  -- This prevents race conditions when multiple concurrent login attempts occur
  INSERT INTO auth_lockouts (email_hash, failed_attempts, created_at, updated_at)
  VALUES (p_email_hash, 0, NOW(), NOW())
  ON CONFLICT (email_hash)
  DO UPDATE SET updated_at = NOW()
  RETURNING * INTO v_lockout;

  -- Check if account is currently in a locked state
  -- If locked_until is set and in the future, deny access immediately
  IF v_lockout.locked_until IS NOT NULL AND v_lockout.locked_until > NOW() THEN
    RETURN jsonb_build_object(
      'is_locked', true,
      'locked_until', v_lockout.locked_until,
      'attempts_remaining', 0
    );
  END IF;

  -- Reset failed attempt counter if the lockout window has expired
  -- This allows users to try again after a reasonable time period
  -- Resets counter to 1 (not 0) because this call represents the current failed attempt
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

  -- Increment the failed attempt counter for this email hash
  -- This tracks consecutive failed login attempts within the window
  UPDATE auth_lockouts
  SET failed_attempts = failed_attempts + 1,
      updated_at = NOW()
  WHERE email_hash = p_email_hash
  RETURNING * INTO v_lockout;

  -- Check if the account should now be locked due to exceeding max attempts
  -- Implements progressive lockout: each violation doubles the lockout duration
  IF v_lockout.failed_attempts >= v_max_attempts THEN
    -- Progressive lockout formula: 15min * 2^(attempts - max_attempts)
    -- After 5 attempts: 15min, 6 attempts: 30min, 7 attempts: 1hr, 8 attempts: 2hr, etc.
    v_lockout_duration := '15 minutes'::INTERVAL * POWER(2, v_lockout.failed_attempts - v_max_attempts);

    -- Cap maximum lockout duration at 24 hours to prevent indefinite lockouts
    -- This provides a reasonable upper bound while maintaining security
    IF v_lockout_duration > '24 hours'::INTERVAL THEN
      v_lockout_duration := '24 hours'::INTERVAL;
    END IF;

    -- Calculate the exact unlock timestamp
    v_locked_until := NOW() + v_lockout_duration;

    -- Update the database to reflect the lockout state
    UPDATE auth_lockouts
    SET locked_until = v_locked_until,
        updated_at = NOW()
    WHERE email_hash = p_email_hash;

    -- Return lockout information to the client
    RETURN jsonb_build_object(
      'is_locked', true,
      'locked_until', v_locked_until,
      'attempts_remaining', 0
    );
  END IF;

  -- Account is not locked, return remaining attempts available
  -- This helps clients show progress indicators or warnings to users
  RETURN jsonb_build_object(
    'is_locked', false,
    'locked_until', NULL,
    'attempts_remaining', v_max_attempts - v_lockout.failed_attempts
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_catalog;

-- Update reset_lockout_counter function to accept p_email_hash instead of p_email
-- This function resets the lockout counter after successful authentication
-- Called when a user successfully logs in to clear any previous failed attempts
CREATE OR REPLACE FUNCTION reset_lockout_counter(p_email_hash TEXT)
RETURNS VOID AS $$
BEGIN
  -- Input validation: ensure email hash is provided and not empty
  -- This prevents accidental resets or malformed requests
  IF p_email_hash IS NULL OR trim(p_email_hash) = '' THEN
    RAISE EXCEPTION 'Email hash parameter cannot be null or empty';
  END IF;

  -- Reset all lockout-related fields for the given email hash
  -- Sets failed_attempts to 0, clears any lockout expiration, and updates timestamp
  -- This allows the user to attempt login again without restrictions
  UPDATE auth_lockouts
  SET failed_attempts = 0,
      locked_until = NULL,
      updated_at = NOW()
  WHERE email_hash = p_email_hash;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_catalog;

-- Update comments to reflect the change
COMMENT ON FUNCTION check_and_increment_lockout(TEXT) IS 'Checks lockout status and increments failed attempt counter using hashed email. Returns lockout state.';
COMMENT ON FUNCTION reset_lockout_counter(TEXT) IS 'Resets failed attempt counter after successful authentication using hashed email.';
