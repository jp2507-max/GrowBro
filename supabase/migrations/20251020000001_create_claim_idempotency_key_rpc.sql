-- Migration: Create claim_idempotency_key RPC for atomic idempotency key claiming
-- This SECURITY DEFINER function performs atomic check-and-insert for idempotency keys
-- to prevent race conditions that could lead to duplicate processing.

BEGIN;

CREATE OR REPLACE FUNCTION public.claim_idempotency_key(
  p_user_id uuid,
  p_idempotency_key text,
  p_endpoint text,
  p_client_tx_id text,
  p_payload_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_existing_key idempotency_keys%ROWTYPE;
  v_result jsonb;
BEGIN
  -- Validate inputs
  IF p_user_id IS NULL OR p_idempotency_key IS NULL OR p_endpoint IS NULL THEN
    RAISE EXCEPTION 'Missing required parameters: user_id, idempotency_key, endpoint';
  END IF;

  -- Check if key already exists (atomically within this transaction)
  SELECT * INTO v_existing_key
  FROM public.idempotency_keys
  WHERE user_id = p_user_id
    AND idempotency_key = p_idempotency_key
    AND endpoint = p_endpoint;

  IF FOUND THEN
    -- Key already exists - return existing status
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Key already exists',
      'status', v_existing_key.status,
      'existing_key', jsonb_build_object(
        'id', v_existing_key.id,
        'status', v_existing_key.status,
        'created_at', v_existing_key.created_at
      )
    );
  END IF;

  -- Key doesn't exist - insert it atomically
  INSERT INTO public.idempotency_keys (
    user_id,
    idempotency_key,
    endpoint,
    client_tx_id,
    payload_hash,
    status,
    created_at,
    expires_at
  ) VALUES (
    p_user_id,
    p_idempotency_key,
    p_endpoint,
    p_client_tx_id,
    p_payload_hash,
    'processing',
    now(),
    now() + INTERVAL '24 hours'
  );

  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Key claimed successfully'
  );

EXCEPTION
  WHEN unique_violation THEN
    -- Handle concurrent inserts (shouldn't happen due to the check above, but just in case)
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Concurrent claim detected'
    );
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.claim_idempotency_key(uuid, text, text, text, text) TO authenticated;

COMMIT;
