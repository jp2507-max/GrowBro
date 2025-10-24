-- Migration: Create ODS Escalations table for DSA Art. 21 dispute tracking
-- Implements: Escalation tracking with 90-day target monitoring and outcome management
--
-- DSA Compliance: Art. 21 (Out-of-court dispute settlement)
--
-- Requirements: 4.8, 13.1

-- ============================================================================
-- ODS Escalations (DSA Art. 21 Case Tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ods_escalations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Appeal reference
  appeal_id UUID NOT NULL REFERENCES public.appeals(id) ON DELETE CASCADE,
  
  -- ODS body selection
  ods_body_id UUID NOT NULL REFERENCES public.ods_bodies(id) ON DELETE RESTRICT,
  
  -- Case tracking
  case_number TEXT, -- ODS body's internal case number (assigned by ODS)
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN (
    'submitted',
    'in_progress',
    'resolved',
    'expired',
    'withdrawn'
  )),
  
  -- Timeline (DSA Art. 21 recommends 90-day target)
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  target_resolution_date TIMESTAMPTZ NOT NULL, -- 90 days from submission
  actual_resolution_date TIMESTAMPTZ,
  
  -- Outcome
  outcome TEXT CHECK (outcome IN ('upheld', 'rejected', 'partial', 'no_decision')),
  outcome_reasoning TEXT,
  ods_decision_document TEXT, -- URL or reference to ODS decision document
  
  -- Platform response to ODS decision
  platform_action_required BOOLEAN DEFAULT FALSE,
  platform_action_completed BOOLEAN DEFAULT FALSE,
  platform_action_date TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Indexes for efficient querying and SLA monitoring
CREATE INDEX IF NOT EXISTS idx_ods_escalations_appeal_id 
  ON public.ods_escalations (appeal_id);

CREATE INDEX IF NOT EXISTS idx_ods_escalations_ods_body_id 
  ON public.ods_escalations (ods_body_id, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_ods_escalations_status 
  ON public.ods_escalations (status, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_ods_escalations_target_resolution 
  ON public.ods_escalations (target_resolution_date) 
  WHERE status IN ('submitted', 'in_progress');

CREATE INDEX IF NOT EXISTS idx_ods_escalations_pending_platform_action 
  ON public.ods_escalations (platform_action_required, platform_action_completed, submitted_at DESC) 
  WHERE platform_action_required = TRUE AND platform_action_completed = FALSE;

CREATE INDEX IF NOT EXISTS idx_ods_escalations_case_number 
  ON public.ods_escalations (case_number) 
  WHERE case_number IS NOT NULL;

-- Ensure one escalation per appeal (business rule)
CREATE UNIQUE INDEX IF NOT EXISTS idx_ods_escalations_unique_appeal 
  ON public.ods_escalations (appeal_id) 
  WHERE deleted_at IS NULL;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_ods_escalations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_ods_escalations_updated_at
  BEFORE UPDATE ON public.ods_escalations
  FOR EACH ROW
  EXECUTE FUNCTION update_ods_escalations_updated_at();

-- ============================================================================
-- Validation constraints
-- ============================================================================

-- Ensure actual_resolution_date is not set before submission
ALTER TABLE public.ods_escalations
  ADD CONSTRAINT check_resolution_after_submission
  CHECK (actual_resolution_date IS NULL OR actual_resolution_date >= submitted_at);

-- Ensure platform_action_date is only set when action is completed
ALTER TABLE public.ods_escalations
  ADD CONSTRAINT check_platform_action_consistency
  CHECK (
    (platform_action_completed = FALSE AND platform_action_date IS NULL) OR
    (platform_action_completed = TRUE)
  );

-- Ensure outcome reasoning is provided when outcome is set
ALTER TABLE public.ods_escalations
  ADD CONSTRAINT check_outcome_reasoning
  CHECK (
    outcome IS NULL OR 
    (outcome IS NOT NULL AND outcome_reasoning IS NOT NULL)
  );

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE public.ods_escalations IS 'DSA Art. 21 out-of-court dispute settlement escalations with 90-day target monitoring and outcome tracking';
COMMENT ON COLUMN public.ods_escalations.appeal_id IS 'Reference to the internal appeal that was escalated to ODS';
COMMENT ON COLUMN public.ods_escalations.ods_body_id IS 'Certified ODS body handling this dispute';
COMMENT ON COLUMN public.ods_escalations.case_number IS 'ODS body internal case tracking number (assigned after submission)';
COMMENT ON COLUMN public.ods_escalations.target_resolution_date IS 'DSA Art. 21 recommends 90 days from submission';
COMMENT ON COLUMN public.ods_escalations.outcome IS 'ODS decision: upheld (user favored), rejected (platform favored), partial (compromise), no_decision (inconclusive)';
COMMENT ON COLUMN public.ods_escalations.platform_action_required IS 'Whether platform must take action based on ODS decision (e.g., reverse original decision)';
COMMENT ON COLUMN public.ods_escalations.platform_action_completed IS 'Whether required platform action has been executed';
