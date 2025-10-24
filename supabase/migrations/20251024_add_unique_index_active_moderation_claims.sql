-- Migration: Add unique index for active moderation claims to prevent race conditions
-- Description: Prevents multiple active claims for the same report by enforcing uniqueness at the database level
-- This fixes the race condition in the claimReport method where check-then-insert could allow double claims
-- Requirements: 2.2 (Atomic claim operation)

-- Create a function to check if a claim is active (not expired)
CREATE OR REPLACE FUNCTION is_claim_active(expires_at TIMESTAMPTZ)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN expires_at > CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create unique index only for ACTIVE claims (where expires_at > CURRENT_TIMESTAMP)
-- This allows expired claims to be cleaned up while preventing concurrent active claims
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_moderation_claim
  ON public.moderation_claims (report_id)
  WHERE is_claim_active(expires_at);

-- Add comment for documentation
COMMENT ON INDEX public.uniq_active_moderation_claim IS 'Prevents race conditions by ensuring only one active claim per report at any time';
