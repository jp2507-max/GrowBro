-- Migration: Create moderation_claims table for atomic report claiming
-- Description: Table to track moderator claims on content reports with expiration
-- Requirements: 2.2 (Atomic claim operation)

CREATE TABLE IF NOT EXISTS public.moderation_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.content_reports(id) ON DELETE CASCADE,
  moderator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_moderation_claims_report_id
  ON public.moderation_claims (report_id);

CREATE INDEX IF NOT EXISTS idx_moderation_claims_moderator_id
  ON public.moderation_claims (moderator_id);

CREATE INDEX IF NOT EXISTS idx_moderation_claims_expires_at
  ON public.moderation_claims (expires_at);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_moderation_claims_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_moderation_claims_updated_at
  BEFORE UPDATE ON public.moderation_claims
  FOR EACH ROW
  EXECUTE FUNCTION update_moderation_claims_updated_at();

-- Add comments for documentation
COMMENT ON TABLE public.moderation_claims IS 'Tracks moderator claims on content reports with automatic expiration';
COMMENT ON COLUMN public.moderation_claims.report_id IS 'Reference to the claimed content report';
COMMENT ON COLUMN public.moderation_claims.moderator_id IS 'ID of the moderator who claimed the report';
COMMENT ON COLUMN public.moderation_claims.claimed_at IS 'Timestamp when the claim was made';
COMMENT ON COLUMN public.moderation_claims.expires_at IS 'Timestamp when the claim expires and can be reclaimed';
