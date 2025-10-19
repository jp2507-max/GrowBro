-- Migration: Add idempotency_key to moderation_audit table for atomic moderation operations
-- This allows preventing duplicate moderation actions and enables server-side atomic updates.

BEGIN;

ALTER TABLE moderation_audit
ADD COLUMN idempotency_key text UNIQUE;

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_moderation_audit_idempotency_key
  ON moderation_audit (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

COMMIT;