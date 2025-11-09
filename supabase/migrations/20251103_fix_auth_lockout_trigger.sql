-- Fix enforce_lockout_on_auth trigger to reference the correct auth_lockouts table

BEGIN;

DROP TRIGGER IF EXISTS enforce_lockout_trigger ON auth.users;

CREATE OR REPLACE FUNCTION public.enforce_lockout_on_auth()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_email_hash text;
  v_locked_until timestamptz;
BEGIN
  IF NEW.encrypted_password IS NOT NULL THEN
    v_email_hash := encode(
      digest(
        coalesce(current_setting('app.email_hash_salt', true), 'growbro_auth_lockout_salt_v1')
        || lower(trim(NEW.email)),
        'sha256'
      ),
      'hex'
    );

    SELECT locked_until
    INTO v_locked_until
    FROM public.auth_lockouts
    WHERE email_hash = v_email_hash;

    IF FOUND AND v_locked_until IS NOT NULL AND v_locked_until > now() THEN
      RAISE EXCEPTION 'Account is temporarily locked due to multiple failed login attempts. Please try again later.'
        USING ERRCODE = 'P0001',
              HINT = 'locked_until=' || v_locked_until::text;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_lockout_trigger
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_lockout_on_auth();

COMMENT ON FUNCTION public.enforce_lockout_on_auth() IS
'Enforces brute-force protection at the database level using auth_lockouts to block password attempts while locked.';

COMMIT;
