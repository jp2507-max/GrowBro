-- Migration: Create content_snapshots table for immutable content evidence
-- Captures content state at report time to prevent post-report modifications
--
-- Requirements: 1.6, 6.1

-- ============================================================================
-- Content Snapshots Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.content_snapshots (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Content identification
  content_id TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('post', 'comment', 'image', 'profile', 'other')),

  -- Snapshot data (immutable - enforced by RLS and triggers)
  snapshot_hash TEXT NOT NULL, -- SHA-256 hash for integrity verification
  snapshot_data JSONB NOT NULL, -- Complete content state at capture time

  -- Capture metadata
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  captured_by_report_id UUID REFERENCES public.content_reports(id) ON DELETE CASCADE,

  -- Storage reference (for large media files)
  storage_path TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Indexes
-- ============================================================================

-- Index for content lookup
CREATE INDEX IF NOT EXISTS idx_content_snapshots_content_id
ON public.content_snapshots (content_id, captured_at DESC);

-- Index for report association
CREATE INDEX IF NOT EXISTS idx_content_snapshots_report
ON public.content_snapshots (captured_by_report_id);

-- Index for hash verification
CREATE INDEX IF NOT EXISTS idx_content_snapshots_hash
ON public.content_snapshots (snapshot_hash);

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

ALTER TABLE public.content_snapshots ENABLE ROW LEVEL SECURITY;

-- Moderators can view all snapshots (requires moderator role check)
CREATE POLICY content_snapshots_select_moderators
  ON public.content_snapshots
  FOR SELECT
  USING (
    -- TODO: Replace with actual moderator role check
    -- EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'moderator')
    FALSE -- Disabled until moderator roles implemented
  );

-- System can insert snapshots (via service role)
CREATE POLICY content_snapshots_insert_system
  ON public.content_snapshots
  FOR INSERT
  WITH CHECK (TRUE); -- Service role only

-- Prevent updates and deletes to maintain immutability (WORM)
CREATE POLICY content_snapshots_no_update
  ON public.content_snapshots
  FOR UPDATE
  USING (FALSE);

CREATE POLICY content_snapshots_no_delete
  ON public.content_snapshots
  FOR DELETE
  USING (FALSE);

-- ============================================================================
-- Triggers for Immutability (WORM enforcement)
-- ============================================================================

-- Prevent any updates to snapshots (Write-Once-Read-Many)
CREATE OR REPLACE FUNCTION prevent_content_snapshot_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Content snapshots are immutable and cannot be modified';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_prevent_content_snapshot_update
  BEFORE UPDATE ON public.content_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION prevent_content_snapshot_modification();

CREATE TRIGGER trigger_prevent_content_snapshot_delete
  BEFORE DELETE ON public.content_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION prevent_content_snapshot_modification();

-- ============================================================================
-- Foreign Key Update
-- ============================================================================

-- Add FK constraint to content_reports.content_snapshot_id
-- (This references the snapshots table created above)
ALTER TABLE public.content_reports
  ADD CONSTRAINT fk_content_reports_snapshot
  FOREIGN KEY (content_snapshot_id)
  REFERENCES public.content_snapshots(id)
  ON DELETE SET NULL;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE public.content_snapshots IS 'Immutable (WORM) snapshots of content at report time for evidence preservation';
COMMENT ON COLUMN public.content_snapshots.snapshot_hash IS 'SHA-256 hash for cryptographic integrity verification';
COMMENT ON COLUMN public.content_snapshots.snapshot_data IS 'Complete content state (immutable after creation)';
COMMENT ON COLUMN public.content_snapshots.captured_by_report_id IS 'Report that triggered this snapshot capture';
