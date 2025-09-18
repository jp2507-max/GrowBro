```sql
-- Add metadata columns to existing sync_idempotency ledger to support operation-level
-- idempotency for RPCs (linking to business resources and storing result payloads).

ALTER TABLE IF EXISTS public.sync_idempotency
  ADD COLUMN IF NOT EXISTS operation_type text,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS resource_ids jsonb,
  ADD COLUMN IF NOT EXISTS before_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS after_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS performed_at timestamptz DEFAULT now();

-- Add a covering index to help lookups by user, operation and idem key
CREATE INDEX IF NOT EXISTS idx_sync_idempotency_user_op_key
  ON public.sync_idempotency (user_id, operation_type, idempotency_key);

-- Keep existing RLS policies intact; these columns don't change the access model.

-- Update trigger to ensure updated_at continues to be maintained
-- (trigger already exists in earlier migrations; no changes required here)

```
