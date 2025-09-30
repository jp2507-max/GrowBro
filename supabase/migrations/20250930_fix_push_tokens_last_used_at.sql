-- Fix upsert_push_token function to not overwrite last_used_at for other users
-- when deactivating tokens to prevent privacy leaks

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
  -- Note: We do NOT update last_used_at here to preserve the original user's timestamp
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
