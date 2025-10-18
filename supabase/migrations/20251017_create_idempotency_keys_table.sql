-- Migration: Create idempotency_keys table
-- Description: Request deduplication for idempotent operations
-- Requirements: 9.1, 9.2, 9.4, 10.1, 10.4

-- ensure extension for gen_random_uuid
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  client_tx_id TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing','completed','failed')),
  response_payload JSONB,
  error_details JSONB,
  response_status INTEGER,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  UNIQUE (user_id, idempotency_key, endpoint)
);

-- Index for efficient cleanup of expired keys
-- Speeds up: DELETE ... WHERE status IN (...) AND expires_at < NOW()
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_status_expires_at
  ON public.idempotency_keys (status, expires_at);

-- Index for fast lookup during request processing
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_user_key_ep
  ON public.idempotency_keys (user_id, idempotency_key, endpoint);

-- Enable Row Level Security
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

-- RLS Policies for owner-scoped access
CREATE POLICY "Users can view their own idempotency keys" ON public.idempotency_keys
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own idempotency keys" ON public.idempotency_keys
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own idempotency keys" ON public.idempotency_keys
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Add comments for documentation
COMMENT ON TABLE public.idempotency_keys IS 'Request deduplication table for idempotent operations (24h TTL)';
COMMENT ON COLUMN public.idempotency_keys.idempotency_key IS 'Client-provided UUIDv4 for request deduplication';
COMMENT ON COLUMN public.idempotency_keys.endpoint IS 'Logical endpoint name/path for scoping keys';
COMMENT ON COLUMN public.idempotency_keys.client_tx_id IS 'Client-generated transaction id for tracing';
COMMENT ON COLUMN public.idempotency_keys.payload_hash IS 'Hex SHA-256 of deterministically serialized payload';
COMMENT ON COLUMN public.idempotency_keys.status IS 'processing|completed|failed';
COMMENT ON COLUMN public.idempotency_keys.response_payload IS 'Cached response for duplicate requests';
COMMENT ON COLUMN public.idempotency_keys.error_details IS 'Structured error details when status=failed';
COMMENT ON COLUMN public.idempotency_keys.expires_at IS 'Expiration timestamp (e.g., 24h for completed, 7d for failed)';
