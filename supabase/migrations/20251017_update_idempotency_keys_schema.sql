-- Migration: Update idempotency_keys table to match code expectations
-- Description: Add missing columns and update unique constraint for idempotency service
-- Requirements: 10.1, 10.2, 10.3, 7.6, 7.8
-- Dependencies: Requires idempotency_keys table from 20251017_create_idempotency_keys_table.sql

-- Add missing columns that the code expects
ALTER TABLE public.idempotency_keys
ADD COLUMN IF NOT EXISTS endpoint TEXT,
ADD COLUMN IF NOT EXISTS payload_hash TEXT,
ADD COLUMN IF NOT EXISTS status TEXT,
ADD COLUMN IF NOT EXISTS response_payload JSONB,
ADD COLUMN IF NOT EXISTS client_tx_id TEXT,
ADD COLUMN IF NOT EXISTS error_details JSONB;

-- Backfill endpoint column with empty string for existing rows and make it NOT NULL
UPDATE public.idempotency_keys SET endpoint = '' WHERE endpoint IS NULL;
ALTER TABLE public.idempotency_keys ALTER COLUMN endpoint SET NOT NULL;

-- Drop the old unique constraint
DROP INDEX IF EXISTS public.idx_idempotency_keys_user_key;
ALTER TABLE public.idempotency_keys DROP CONSTRAINT IF EXISTS idempotency_keys_user_id_idempotency_key_key;

-- Create new unique constraint on (idempotency_key, user_id, endpoint) as expected by code
ALTER TABLE public.idempotency_keys
ADD CONSTRAINT idempotency_keys_idempotency_key_user_id_endpoint_key
UNIQUE (idempotency_key, user_id, endpoint);

-- Create index for the new unique constraint
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_key_user_endpoint
ON public.idempotency_keys (idempotency_key, user_id, endpoint);

-- Update comments for new columns
COMMENT ON COLUMN public.idempotency_keys.endpoint IS 'API endpoint for the idempotent operation';
COMMENT ON COLUMN public.idempotency_keys.payload_hash IS 'SHA-256 hash of the request payload';
COMMENT ON COLUMN public.idempotency_keys.status IS 'Status of the operation: processing, completed, failed';
COMMENT ON COLUMN public.idempotency_keys.response_payload IS 'Cached response payload for completed operations';
COMMENT ON COLUMN public.idempotency_keys.client_tx_id IS 'Client transaction ID for tracking';
COMMENT ON COLUMN public.idempotency_keys.error_details IS 'Error details for failed operations';