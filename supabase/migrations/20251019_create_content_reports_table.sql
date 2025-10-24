-- Migration: Create content_reports table for DSA Art. 16 compliance
-- Implements two-track reporting (illegal vs policy violation) with duplicate detection
--
-- Requirements: 1.5, 1.6, 1.8, 6.1

-- ============================================================================
-- Content Reports Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.content_reports (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Content identification
  content_id TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('post', 'comment', 'image', 'profile', 'other')),
  content_locator TEXT NOT NULL, -- Permalink/deep link
  content_hash TEXT NOT NULL, -- SHA-256 hash for immutability

  -- Reporter
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reporter_contact JSONB NOT NULL, -- { name?, email?, pseudonym? }
  trusted_flagger BOOLEAN DEFAULT FALSE,

  -- Report classification (DSA Art. 16 two-track)
  report_type TEXT NOT NULL CHECK (report_type IN ('illegal', 'policy_violation')),
  jurisdiction TEXT, -- ISO 3166-1 alpha-2 code (required for illegal)
  legal_reference TEXT, -- e.g., 'DE StGB §130'

  -- DSA Art. 16 mandatory fields
  explanation TEXT NOT NULL CHECK (char_length(explanation) >= 50),
  good_faith_declaration BOOLEAN NOT NULL CHECK (good_faith_declaration = TRUE),
  evidence_urls TEXT[], -- Array of evidence URLs

  -- Processing
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'resolved', 'duplicate')),
  priority INTEGER NOT NULL DEFAULT 25 CHECK (priority >= 0 AND priority <= 100),
  sla_deadline TIMESTAMPTZ NOT NULL,

  -- Associated snapshot
  content_snapshot_id UUID, -- FK to content_snapshots (created in follow-up migration)

  -- Duplicate handling
  duplicate_of_report_id UUID REFERENCES public.content_reports(id) ON DELETE SET NULL,

  -- Metadata
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- For RLS
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- ============================================================================
-- Indexes
-- ============================================================================

-- Index for duplicate detection (content_hash, reporter_id, report_type)
CREATE INDEX IF NOT EXISTS idx_content_reports_duplicate_key
ON public.content_reports (content_hash, reporter_id, report_type, created_at DESC)
WHERE deleted_at IS NULL;

-- Index for SLA monitoring (priority, sla_deadline)
CREATE INDEX IF NOT EXISTS idx_content_reports_sla
ON public.content_reports (priority DESC, sla_deadline ASC)
WHERE deleted_at IS NULL AND status IN ('pending', 'in_review');

-- Index for trusted flagger fast lane
CREATE INDEX IF NOT EXISTS idx_content_reports_trusted_flagger
ON public.content_reports (trusted_flagger, priority DESC, created_at DESC)
WHERE deleted_at IS NULL AND trusted_flagger = TRUE;

-- Index for report type filtering
CREATE INDEX IF NOT EXISTS idx_content_reports_type_status
ON public.content_reports (report_type, status, created_at DESC)
WHERE deleted_at IS NULL;

-- Index for content grouping (multiple reports on same content)
CREATE INDEX IF NOT EXISTS idx_content_reports_content_hash
ON public.content_reports (content_hash, created_at DESC)
WHERE deleted_at IS NULL;

-- Index for user reports lookup
CREATE INDEX IF NOT EXISTS idx_content_reports_reporter
ON public.content_reports (reporter_id, created_at DESC)
WHERE deleted_at IS NULL;

-- ============================================================================
-- Constraints
-- ============================================================================

-- Ensure illegal reports have jurisdiction and legal reference
ALTER TABLE public.content_reports ADD CONSTRAINT check_illegal_report_fields
  CHECK (
    report_type != 'illegal' OR (
      jurisdiction IS NOT NULL AND
      legal_reference IS NOT NULL
    )
  );

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

-- Users can view their own reports
CREATE POLICY content_reports_select_own
  ON public.content_reports
  FOR SELECT
  USING (reporter_id = auth.uid() OR user_id = auth.uid());

-- Users can insert their own reports
CREATE POLICY content_reports_insert_own
  ON public.content_reports
  FOR INSERT
  WITH CHECK (reporter_id = auth.uid() AND user_id = auth.uid());

-- Moderators can view all reports (requires moderator role check)
-- This policy will be expanded when moderator roles are implemented
CREATE POLICY content_reports_select_moderators
  ON public.content_reports
  FOR SELECT
  USING (
    -- TODO: Replace with actual moderator role check
    -- EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'moderator')
    FALSE -- Disabled until moderator roles implemented
  );

-- ============================================================================
-- Triggers
-- ============================================================================

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_content_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_content_reports_updated_at
  BEFORE UPDATE ON public.content_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_content_reports_updated_at();

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE public.content_reports IS 'DSA Art. 16 compliant content reports with two-track intake (illegal vs policy violation)';
COMMENT ON COLUMN public.content_reports.content_hash IS 'SHA-256 hash of content at report time for immutability verification';
COMMENT ON COLUMN public.content_reports.trusted_flagger IS 'DSA Art. 22 trusted flagger priority lane';
COMMENT ON COLUMN public.content_reports.report_type IS 'Two-track system: illegal (requires jurisdiction) or policy_violation';
COMMENT ON COLUMN public.content_reports.explanation IS 'Sufficiently substantiated explanation (DSA Art. 16 requirement, min 50 chars)';
COMMENT ON COLUMN public.content_reports.good_faith_declaration IS 'DSA Art. 16 mandatory good faith declaration (must be TRUE)';
COMMENT ON COLUMN public.content_reports.sla_deadline IS 'SLA deadline for moderation action (immediate for CSAM/self-harm, 24h for illegal, 72h for policy)';
COMMENT ON COLUMN public.content_reports.duplicate_of_report_id IS 'Reference to original report if this is a duplicate';
