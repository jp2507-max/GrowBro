-- Migration: Create idempotency_keys table
-- Description: Request deduplication for idempotent operations
-- Requirements: 9.1, 9.2, 9.4, 10.1, 10.4

CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  request_path TEXT NOT NULL,
  request_method TEXT NOT NULL,
  request_payload JSONB,
  response_status INTEGER,
  response_body JSONB,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  UNIQUE(user_id, idempotency_key)
);

-- Index for efficient cleanup of expired keys
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires_at 
  ON public.idempotency_keys (expires_at) 
  WHERE expires_at <= now();

-- Index for fast lookup during request processing
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_user_key 
  ON public.idempotency_keys (user_id, idempotency_key);

-- Enable Row Level Security
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

-- Add comments for documentation
COMMENT ON TABLE public.idempotency_keys IS 'Request deduplication table for idempotent operations (24h TTL)';
COMMENT ON COLUMN public.idempotency_keys.idempotency_key IS 'Client-provided UUIDv4 for request deduplication';
COMMENT ON COLUMN public.idempotency_keys.expires_at IS 'Expiration timestamp - keys are deleted after 24 hours';
COMMENT ON COLUMN public.idempotency_keys.request_payload IS 'SHA-256 hash of request payload for verification';
COMMENT ON COLUMN public.idempotency_keys.response_body IS 'Cached response for duplicate requests';
