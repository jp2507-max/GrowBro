-- Migration: Create moderation core schema for DSA Notice-and-Action system
-- Implements: Content Reports, Moderation Decisions, Statements of Reasons, Appeals,
-- Trusted Flaggers, Repeat Offender Tracking, Content Snapshots, SoR Export Queue
--
-- DSA Compliance: Art. 16 (Notice-and-Action), Art. 17 (SoR), Art. 20 (Appeals),
-- Art. 22 (Trusted Flaggers), Art. 23 (Misuse), Art. 24(5) (Transparency DB)
--
-- Requirements: 1.5, 2.7, 6.1, 14.2

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- Content Reports (DSA Art. 16)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.content_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Content identification
  content_id TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('post', 'comment', 'image', 'profile', 'other')),
  content_locator TEXT NOT NULL, -- Permalink/deep link at report time
  content_hash TEXT NOT NULL, -- SHA-256 hash of content at report time
  
  -- Reporter information
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reporter_contact JSONB NOT NULL, -- {name, email} with privacy handling
  trusted_flagger BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Report classification (DSA Art. 16 two-track system)
  report_type TEXT NOT NULL CHECK (report_type IN ('illegal', 'policy_violation')),
  jurisdiction TEXT, -- Required for 'illegal' reports (e.g., 'DE', 'EU')
  legal_reference TEXT, -- e.g., 'DE StGB §130', 'EU DSA Art. X'
  
  -- DSA Art. 16 mandatory fields
  explanation TEXT NOT NULL, -- Sufficiently substantiated explanation
  good_faith_declaration BOOLEAN NOT NULL,
  evidence_urls TEXT[], -- Supporting evidence
  
  -- Processing metadata
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'resolved', 'duplicate')),
  priority INTEGER NOT NULL DEFAULT 50, -- 0-100, higher = more urgent
  sla_deadline TIMESTAMPTZ NOT NULL,
  
  -- Associated content snapshot
  content_snapshot_id UUID,
  
  -- Duplicate prevention
  duplicate_of_report_id UUID REFERENCES public.content_reports(id) ON DELETE SET NULL,
  
  -- Metadata
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_content_reports_status_priority_created 
  ON public.content_reports (status, priority DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_content_reports_content_hash_reporter 
  ON public.content_reports (content_hash, reporter_id);

CREATE INDEX IF NOT EXISTS idx_content_reports_sla_deadline 
  ON public.content_reports (sla_deadline) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_content_reports_trusted_flagger 
  ON public.content_reports (trusted_flagger, created_at DESC) WHERE trusted_flagger = TRUE;

-- Trigger for updated_at
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
-- Moderation Decisions
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.moderation_decisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Report reference
  report_id UUID NOT NULL REFERENCES public.content_reports(id) ON DELETE CASCADE,
  
  -- Decision maker
  moderator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supervisor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- For decisions requiring approval
  
  -- Action taken
  action TEXT NOT NULL CHECK (action IN (
    'no_action',
    'quarantine',
    'geo_block',
    'remove',
    'suspend_user',
    'rate_limit',
    'shadow_ban'
  )),
  
  -- Policy violations
  policy_violations TEXT[] NOT NULL, -- Policy catalog entry IDs
  reasoning TEXT NOT NULL,
  evidence TEXT[], -- Evidence links/IDs
  
  -- Statement of Reasons (DSA Art. 17)
  statement_of_reasons_id UUID, -- References statements_of_reasons table
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'executed', 'reversed')),
  requires_supervisor_approval BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Execution tracking
  executed_at TIMESTAMPTZ,
  reversed_at TIMESTAMPTZ,
  reversal_reason TEXT,
  
  -- Metadata
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_moderation_decisions_report_id 
  ON public.moderation_decisions (report_id);

CREATE INDEX IF NOT EXISTS idx_moderation_decisions_status 
  ON public.moderation_decisions (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_moderation_decisions_moderator 
  ON public.moderation_decisions (moderator_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_moderation_decisions_supervisor_pending 
  ON public.moderation_decisions (supervisor_id, created_at DESC) 
  WHERE requires_supervisor_approval = TRUE AND status = 'pending';

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_moderation_decisions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_moderation_decisions_updated_at
  BEFORE UPDATE ON public.moderation_decisions
  FOR EACH ROW
  EXECUTE FUNCTION update_moderation_decisions_updated_at();

-- ============================================================================
-- Statements of Reasons (DSA Art. 17)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.statements_of_reasons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Decision reference
  decision_id UUID NOT NULL UNIQUE REFERENCES public.moderation_decisions(id) ON DELETE CASCADE,
  
  -- DSA Art. 17 required fields
  decision_ground TEXT NOT NULL CHECK (decision_ground IN ('illegal', 'terms')),
  legal_reference TEXT, -- Required if decision_ground = 'illegal'
  content_type TEXT NOT NULL,
  facts_and_circumstances TEXT NOT NULL,
  
  -- Automation disclosure (DSA Art. 17(3)(c))
  automated_detection BOOLEAN NOT NULL,
  automated_decision BOOLEAN NOT NULL,
  
  -- Territorial scope (if geo-restriction applied)
  territorial_scope TEXT[], -- e.g., ['DE', 'AT']
  
  -- Redress options (DSA Art. 17)
  redress TEXT[] NOT NULL DEFAULT ARRAY['internal_appeal', 'ods', 'court'],
  
  -- Commission Transparency Database (Art. 24(5))
  transparency_db_id TEXT, -- ID returned by EC Transparency Database
  transparency_db_submitted_at TIMESTAMPTZ,
  
  -- Metadata
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_statements_of_reasons_decision_id 
  ON public.statements_of_reasons (decision_id);

CREATE INDEX IF NOT EXISTS idx_statements_of_reasons_transparency_db 
  ON public.statements_of_reasons (transparency_db_submitted_at DESC NULLS FIRST);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_statements_of_reasons_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_statements_of_reasons_updated_at
  BEFORE UPDATE ON public.statements_of_reasons
  FOR EACH ROW
  EXECUTE FUNCTION update_statements_of_reasons_updated_at();

-- ============================================================================
-- SoR Export Queue (DSA Art. 24(5) Transparency Database)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.sor_export_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Statement reference (idempotency by statement_id)
  statement_id UUID NOT NULL UNIQUE REFERENCES public.statements_of_reasons(id) ON DELETE CASCADE,
  
  -- Idempotency key for external API calls
  idempotency_key TEXT NOT NULL UNIQUE,
  
  -- Queue status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'retry', 'submitted', 'failed', 'dlq')),
  
  -- Retry tracking
  attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt TIMESTAMPTZ,
  
  -- Response tracking
  transparency_db_response TEXT, -- Raw API response
  error_message TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient retry/visibility queries
CREATE INDEX IF NOT EXISTS idx_sor_export_queue_status_attempts 
  ON public.sor_export_queue (status, attempts, last_attempt);

CREATE INDEX IF NOT EXISTS idx_sor_export_queue_idempotency_key 
  ON public.sor_export_queue (idempotency_key);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_sor_export_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_sor_export_queue_updated_at
  BEFORE UPDATE ON public.sor_export_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_sor_export_queue_updated_at();

-- ============================================================================
-- Appeals (DSA Art. 20 Internal Complaint-Handling)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.appeals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Original decision reference
  original_decision_id UUID NOT NULL REFERENCES public.moderation_decisions(id) ON DELETE CASCADE,
  
  -- Appellant
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Appeal details
  appeal_type TEXT NOT NULL CHECK (appeal_type IN ('content_removal', 'account_action', 'geo_restriction')),
  counter_arguments TEXT NOT NULL,
  supporting_evidence TEXT[], -- Evidence URLs/IDs
  
  -- Review assignment
  reviewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Appeal decision
  decision TEXT CHECK (decision IN ('upheld', 'rejected', 'partial')),
  decision_reasoning TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'resolved', 'escalated_to_ods')),
  
  -- Deadlines (DSA Art. 20: ≥7 days minimum)
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deadline TIMESTAMPTZ NOT NULL, -- At least 7 days from submission
  resolved_at TIMESTAMPTZ,
  
  -- ODS escalation (DSA Art. 21)
  ods_escalation_id UUID, -- References external ODS case tracking
  ods_body_name TEXT,
  ods_submitted_at TIMESTAMPTZ,
  ods_resolved_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_appeals_original_decision 
  ON public.appeals (original_decision_id);

CREATE INDEX IF NOT EXISTS idx_appeals_status_deadline 
  ON public.appeals (status, deadline) WHERE status IN ('pending', 'in_review');

CREATE INDEX IF NOT EXISTS idx_appeals_reviewer 
  ON public.appeals (reviewer_id, created_at DESC) WHERE reviewer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_appeals_user_id 
  ON public.appeals (user_id, created_at DESC);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_appeals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_appeals_updated_at
  BEFORE UPDATE ON public.appeals
  FOR EACH ROW
  EXECUTE FUNCTION update_appeals_updated_at();

-- ============================================================================
-- Trusted Flaggers (DSA Art. 22)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.trusted_flaggers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Organization details
  organization_name TEXT NOT NULL,
  contact_info JSONB NOT NULL, -- {email, phone, address}
  specialization TEXT[] NOT NULL, -- e.g., ['terrorism', 'csam', 'hate_speech']
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'revoked')),
  
  -- Quality metrics (for Art. 22 periodic review)
  accuracy_rate DECIMAL(5,2), -- Percentage of reports that resulted in action
  average_handling_time_hours DECIMAL(10,2),
  total_reports INTEGER DEFAULT 0,
  upheld_decisions INTEGER DEFAULT 0,
  
  -- Certification
  certification_date TIMESTAMPTZ NOT NULL,
  review_date TIMESTAMPTZ NOT NULL, -- Next periodic review date
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_trusted_flaggers_status 
  ON public.trusted_flaggers (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_trusted_flaggers_review_date 
  ON public.trusted_flaggers (review_date) WHERE status = 'active';

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_trusted_flaggers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_trusted_flaggers_updated_at
  BEFORE UPDATE ON public.trusted_flaggers
  FOR EACH ROW
  EXECUTE FUNCTION update_trusted_flaggers_updated_at();

-- ============================================================================
-- Repeat Offender Records (DSA Art. 23 Measures Against Misuse)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.repeat_offender_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- User tracking
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Violation tracking
  violation_type TEXT NOT NULL,
  violation_count INTEGER NOT NULL DEFAULT 0,
  
  -- Escalation level (Art. 23 graduated enforcement)
  escalation_level TEXT NOT NULL DEFAULT 'warning' CHECK (escalation_level IN ('warning', 'temporary_suspension', 'permanent_ban')),
  
  -- History
  last_violation_date TIMESTAMPTZ,
  suspension_history JSONB DEFAULT '[]'::JSONB, -- Array of {start, end, reason}
  
  -- Manifestly unfounded reporter tracking (Art. 23)
  manifestly_unfounded_reports INTEGER DEFAULT 0,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'banned')),
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_repeat_offender_records_user_id 
  ON public.repeat_offender_records (user_id);

CREATE INDEX IF NOT EXISTS idx_repeat_offender_records_status 
  ON public.repeat_offender_records (status, last_violation_date DESC);

CREATE INDEX IF NOT EXISTS idx_repeat_offender_records_manifestly_unfounded 
  ON public.repeat_offender_records (manifestly_unfounded_reports DESC) 
  WHERE manifestly_unfounded_reports > 0;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_repeat_offender_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_repeat_offender_records_updated_at
  BEFORE UPDATE ON public.repeat_offender_records
  FOR EACH ROW
  EXECUTE FUNCTION update_repeat_offender_records_updated_at();

-- ============================================================================
-- Content Snapshots (Immutable Evidence)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.content_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Content identification
  content_id TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('post', 'comment', 'image', 'profile', 'other')),
  
  -- Snapshot data (immutable)
  snapshot_hash TEXT NOT NULL, -- SHA-256 hash of snapshot_data
  snapshot_data JSONB NOT NULL, -- Complete content state at capture time
  
  -- Capture metadata
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  captured_by_report_id UUID REFERENCES public.content_reports(id) ON DELETE SET NULL,
  
  -- Storage reference (if content includes media)
  storage_path TEXT, -- e.g., 'moderation-snapshots/abc123.json'
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_content_snapshots_content_id 
  ON public.content_snapshots (content_id, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_content_snapshots_hash 
  ON public.content_snapshots (snapshot_hash);

CREATE INDEX IF NOT EXISTS idx_content_snapshots_report_id 
  ON public.content_snapshots (captured_by_report_id) WHERE captured_by_report_id IS NOT NULL;

-- Add foreign key from content_reports to content_snapshots
ALTER TABLE public.content_reports 
  ADD CONSTRAINT fk_content_reports_snapshot 
  FOREIGN KEY (content_snapshot_id) REFERENCES public.content_snapshots(id) ON DELETE SET NULL;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE public.content_reports IS 'DSA Art. 16 Notice-and-Action intake with mandatory fields and two-track system (illegal vs policy violation)';
COMMENT ON TABLE public.moderation_decisions IS 'Moderation actions and decisions with policy violation tracking';
COMMENT ON TABLE public.statements_of_reasons IS 'DSA Art. 17 Statements of Reasons with Commission Transparency Database integration';
COMMENT ON TABLE public.sor_export_queue IS 'DSA Art. 24(5) queue for submitting redacted SoRs to EC Transparency Database with idempotency';
COMMENT ON TABLE public.appeals IS 'DSA Art. 20 Internal Complaint-Handling with ≥7 day windows and Art. 21 ODS escalation';
COMMENT ON TABLE public.trusted_flaggers IS 'DSA Art. 22 Trusted Flaggers with priority intake and quality analytics';
COMMENT ON TABLE public.repeat_offender_records IS 'DSA Art. 23 Measures Against Misuse with graduated enforcement';
COMMENT ON TABLE public.content_snapshots IS 'Immutable content snapshots captured at report time to prevent post-report modifications';
