-- Update auth_lockouts table for improved salt security
-- Modifies hash_email function to use configurable salt from database setting

-- Function to hash email addresses for privacy
CREATE OR REPLACE FUNCTION hash_email(p_email TEXT)
RETURNS TEXT AS $$
DECLARE
  v_salt TEXT;
BEGIN
  -- Get salt from database setting (required)
  v_salt := current_setting('app.email_hash_salt', true);

  -- Validate that salt is not null or empty
  IF v_salt IS NULL OR v_salt = '' THEN
    RAISE EXCEPTION 'app.email_hash_salt database setting is required but not configured';
  END IF;

  -- Use SHA-256 hash of salted lowercase trimmed email
  RETURN encode(digest(v_salt || lower(trim(p_email)), 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER
SET search_path = public, pg_catalog;

COMMENT ON FUNCTION hash_email(TEXT) IS 'Hashes email addresses using SHA-256 for privacy protection against enumeration attacks';
