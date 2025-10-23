-- Migration: Create SoR submission trail view for legal transparency
-- Implements: "SoR submission trail" view for legal (payload hash, timestamp, EC DB id)
--
-- DSA Compliance: Art. 24(5) (Transparency DB submission tracking)
--
-- Requirements: 6.1

-- ============================================================================
-- SoR Submission Trail View
-- ============================================================================

CREATE OR REPLACE VIEW public.sor_submission_trail_view AS
SELECT
  md.id AS decision_id,
  sor.id AS statement_id,
  sor.transparency_db_id,
  sor.transparency_db_submitted_at AS submitted_at,
  -- Hash of the SoR payload for integrity verification
  encode(digest(
    (sor.decision_ground || '|' || 
     COALESCE(sor.legal_reference, '') || '|' || 
     sor.content_type || '|' || 
     sor.facts_and_circumstances
    )::bytea,
    'sha256'
  ), 'hex') AS payload_hash,
  -- Export queue status
  soq.status,
  soq.attempts,
  soq.last_attempt,
  soq.error_message,
  -- Related report information
  cr.id AS report_id,
  cr.content_type,
  cr.report_type,
  cr.jurisdiction,
  -- Timestamps
  md.created_at AS decision_created_at,
  sor.created_at AS sor_created_at,
  soq.created_at AS queue_created_at
FROM
  public.moderation_decisions md
  INNER JOIN public.statements_of_reasons sor ON sor.decision_id = md.id
  LEFT JOIN public.sor_export_queue soq ON soq.statement_id = sor.id
  INNER JOIN public.content_reports cr ON cr.id = md.report_id
ORDER BY
  md.created_at DESC;

-- Grant access to authenticated users (RLS will further restrict)
GRANT SELECT ON public.sor_submission_trail_view TO authenticated;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON VIEW public.sor_submission_trail_view IS 
'DSA Art. 24(5) SoR submission trail for legal transparency - includes payload hash, timestamp, EC DB id, and export status';
