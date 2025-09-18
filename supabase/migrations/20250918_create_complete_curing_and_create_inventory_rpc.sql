```sql
-- RPC: complete_curing_and_create_inventory
-- Performs idempotent completion of CURING -> INVENTORY transition.
-- Uses public.sync_idempotency ledger to ensure insert-or-return-existing semantics.

CREATE OR REPLACE FUNCTION public.complete_curing_and_create_inventory(
  p_harvest_id uuid,
  p_final_weight_g integer,
  p_notes text,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  inserted_id bigint;
  existing_payload jsonb;
  new_inventory_id uuid;
  server_ms bigint := floor(extract(epoch FROM transaction_timestamp()) * 1000);
  result jsonb;
  current_user uuid := COALESCE(auth.uid()::uuid, NULL);
BEGIN
  -- Attempt to claim idempotency key for this (user, endpoint, key).
  INSERT INTO public.sync_idempotency (user_id, idempotency_key, operation_type, status, performed_at)
  VALUES (COALESCE(auth.uid()::uuid, '00000000-0000-0000-0000-000000000000'::uuid), p_idempotency_key, 'complete_curing_and_create_inventory', 'pending', now())
  ON CONFLICT (user_id, idempotency_key) DO NOTHING
  RETURNING id INTO inserted_id;

  IF inserted_id IS NULL THEN
    -- Key already exists; return stored response if available
    SELECT response_payload INTO existing_payload FROM public.sync_idempotency
    WHERE user_id = COALESCE(auth.uid()::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
      AND idempotency_key = p_idempotency_key;

    IF existing_payload IS NOT NULL THEN
      RETURN existing_payload;
    ELSE
      -- If no response yet, return a 409-like payload to indicate pending
      RAISE EXCEPTION 'Operation already in progress for this idempotency key' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- Proceed with transactional operation: update harvest, create inventory
  BEGIN
    -- Verify harvest exists and is owned by user (RLS also enforces this)
    -- Update harvest stage to INVENTORY and set stage_completed_at
    UPDATE public.harvests SET
      stage = 'inventory',
      stage_completed_at = now(),
      dry_weight_g = COALESCE(p_final_weight_g, dry_weight_g),
      notes = COALESCE(notes || '\n', '') || COALESCE(p_notes, ''),
      updated_at = now()
    WHERE id = p_harvest_id
    RETURNING id, plant_id, user_id INTO STRICT p_harvest_id, new_inventory_id, current_user;

    -- Create inventory row linked to harvest
    INSERT INTO public.inventory (plant_id, harvest_id, user_id, final_weight_g, harvest_date, total_duration_days)
    SELECT h.plant_id, h.id, h.user_id, p_final_weight_g, now()::date,
           GREATEST(0, floor(EXTRACT(epoch FROM now() - h.stage_started_at) / 86400))::int
    FROM public.harvests h
    WHERE h.id = p_harvest_id
    RETURNING id INTO new_inventory_id;

    -- Build result payload
    result := jsonb_build_object(
      'harvest_id', p_harvest_id,
      'inventory_id', new_inventory_id,
      'server_timestamp_ms', server_ms
    );

    -- Update idempotency ledger with success and response payload
    UPDATE public.sync_idempotency SET
      status = 'success',
      response_payload = result,
      resource_ids = jsonb_build_object('harvest_id', p_harvest_id, 'inventory_id', new_inventory_id),
      after_snapshot = (SELECT to_jsonb(h) FROM public.harvests h WHERE h.id = p_harvest_id),
      updated_at = now()
    WHERE id = inserted_id;

    RETURN result;

  EXCEPTION WHEN unique_violation THEN
    -- This can happen if inventory unique constraint on harvest_id prevents insert (another worker raced)
    -- Fetch existing inventory id and return stored response if present
    SELECT id INTO new_inventory_id FROM public.inventory WHERE harvest_id = p_harvest_id LIMIT 1;
    result := jsonb_build_object('harvest_id', p_harvest_id, 'inventory_id', new_inventory_id, 'server_timestamp_ms', server_ms);

    UPDATE public.sync_idempotency SET
      status = 'success',
      response_payload = result,
      resource_ids = jsonb_build_object('harvest_id', p_harvest_id, 'inventory_id', new_inventory_id),
      updated_at = now()
    WHERE id = inserted_id;

    RETURN result;
  WHEN OTHERS THEN
    -- Record failure in idempotency ledger and re-raise
    UPDATE public.sync_idempotency SET
      status = 'failed',
      error_message = SQLERRM,
      updated_at = now()
    WHERE id = inserted_id;
    RAISE;
  END;

END;
$$;

-- Grant execute to service role (optional, adapt role name if used)
-- GRANT EXECUTE ON FUNCTION public.complete_curing_and_create_inventory(uuid, integer, text, text) TO authenticated;

```
