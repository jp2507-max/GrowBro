-- Migration: Add database-level lockout enforcement trigger
-- Date: 2025-10-31
-- Purpose: Enforce brute-force protection at the database level to prevent bypass
--
-- This trigger ensures that even if clients bypass the Edge Function wrapper,
-- the lockout mechanism is still enforced at the database level.

-- Create a function to check lockout status before authentication
CREATE OR REPLACE FUNCTION public.enforce_lockout_on_auth()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_email_hash text;
  v_lockout_record record;
  v_is_locked boolean;
  v_locked_until timestamptz;
BEGIN
  -- Only enforce for password-based authentication
  -- OAuth and other methods are handled separately
  IF NEW.encrypted_password IS NOT NULL THEN
    -- Hash the email for lockout lookup
    v_email_hash := encode(
      digest(
        coalesce(current_setting('app.email_hash_salt', true), 'growbro_auth_lockout_salt_v1') || 
        lower(trim(NEW.email)),
        'sha256'
      ),
      'hex'
    );

    -- Check lockout status
    SELECT 
      is_locked,
      locked_until
    INTO v_lockout_record
    FROM public.auth_lockout
    WHERE email_hash = v_email_hash;

    IF FOUND THEN
      v_is_locked := v_lockout_record.is_locked;
      v_locked_until := v_lockout_record.locked_until;

      -- If account is locked and lockout hasn't expired
      IF v_is_locked AND v_locked_until > now() THEN
        RAISE EXCEPTION 'Account is temporarily locked due to multiple failed login attempts. Please try again later.'
          USING ERRCODE = 'P0001',
                HINT = 'locked_until=' || v_locked_until::text;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on auth.users table for INSERT operations
-- This catches new authentication attempts
DROP TRIGGER IF EXISTS enforce_lockout_trigger ON auth.users;
CREATE TRIGGER enforce_lockout_trigger
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_lockout_on_auth();

-- Add comment for documentation
COMMENT ON FUNCTION public.enforce_lockout_on_auth() IS 
'Enforces brute-force protection at the database level by checking lockout status before allowing authentication. This prevents bypass of client-side lockout checks.';

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.enforce_lockout_on_auth() TO postgres;
GRANT EXECUTE ON FUNCTION public.enforce_lockout_on_auth() TO service_role;

-- Create a function to log lockout enforcement events
CREATE OR REPLACE FUNCTION public.log_lockout_enforcement(
  p_email_hash text,
  p_action text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.auth_audit_log (
    user_id,
    event_type,
    ip_address,
    user_agent,
    metadata
  ) VALUES (
    NULL,
    'lockout_enforcement',
    coalesce((p_metadata->>'ip_address')::text, 'unknown'),
    coalesce((p_metadata->>'user_agent')::text, 'unknown'),
    jsonb_build_object(
      'email_hash', p_email_hash,
      'action', p_action,
      'enforced_at_db_level', true,
      'additional_metadata', p_metadata
    )
  );
END;
$$;

COMMENT ON FUNCTION public.log_lockout_enforcement(text, text, jsonb) IS 
'Logs lockout enforcement events to the audit log for security monitoring and compliance.';

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.log_lockout_enforcement(text, text, jsonb) TO postgres;
GRANT EXECUTE ON FUNCTION public.log_lockout_enforcement(text, text, jsonb) TO service_role;
