-- Create sync_idempotency table and RLS policies
-- NOTE: Do not wrap in a transaction if also creating indexes concurrently elsewhere.

CREATE TABLE IF NOT EXISTS public.sync_idempotency (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL,
  idempotency_key text NOT NULL,
  response_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS sync_idempotency_user_key_idx
  ON public.sync_idempotency (user_id, idempotency_key);

ALTER TABLE public.sync_idempotency ENABLE ROW LEVEL SECURITY;

-- Replace <app_db_role> with your trusted application DB role if used
DO $$
BEGIN
  -- SELECT
  EXECUTE 'DROP POLICY IF EXISTS sync_idempotency_select_policy ON public.sync_idempotency';
  EXECUTE $$
    CREATE POLICY sync_idempotency_select_policy
    ON public.sync_idempotency
    FOR SELECT
    USING (
      (auth.uid() IS NOT NULL AND auth.uid()::uuid = user_id)
      OR current_setting(''jwt.claims.role'', true) = ''service_role''
    );
  $$;

  -- INSERT
  EXECUTE 'DROP POLICY IF EXISTS sync_idempotency_insert_policy ON public.sync_idempotency';
  EXECUTE $$
    CREATE POLICY sync_idempotency_insert_policy
    ON public.sync_idempotency
    FOR INSERT
    WITH CHECK (
      (auth.uid() IS NOT NULL AND auth.uid()::uuid = user_id)
      OR current_setting(''jwt.claims.role'', true) = ''service_role''
    );
  $$;

  -- UPDATE
  EXECUTE 'DROP POLICY IF EXISTS sync_idempotency_update_policy ON public.sync_idempotency';
  EXECUTE $$
    CREATE POLICY sync_idempotency_update_policy
    ON public.sync_idempotency
    FOR UPDATE
    USING (
      (auth.uid() IS NOT NULL AND auth.uid()::uuid = user_id)
      OR current_setting(''jwt.claims.role'', true) = ''service_role''
    )
    WITH CHECK (
      (auth.uid() IS NOT NULL AND auth.uid()::uuid = user_id)
      OR current_setting(''jwt.claims.role'', true) = ''service_role''
    );
  $$;

  -- DELETE
  EXECUTE 'DROP POLICY IF EXISTS sync_idempotency_delete_policy ON public.sync_idempotency';
  EXECUTE $$
    CREATE POLICY sync_idempotency_delete_policy
    ON public.sync_idempotency
    FOR DELETE
    USING (
      (auth.uid() IS NOT NULL AND auth.uid()::uuid = user_id)
      OR current_setting(''jwt.claims.role'', true) = ''service_role''
    );
  $$;
END$$;


