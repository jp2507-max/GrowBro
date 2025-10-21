-- Enable Row Level Security on audit_events and statements_of_reasons tables
-- DSA Compliance: Art. 17 (SoR protection), Art. 24(6) (audit trail integrity)

BEGIN;

-- ============================================================================
-- Enable RLS on audit_events table
-- ============================================================================

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

-- Policy: Only audit/moderator/system roles can read audit events
-- This prevents unauthorized access to audit trails while allowing
-- legitimate access for compliance monitoring and system administration
CREATE POLICY audit_events_select_audit_roles
ON public.audit_events
FOR SELECT
TO authenticated
USING (
  -- Check for audit role (implement role checking based on your auth system)
  -- This is a placeholder - implement based on your JWT claims or user roles
  auth.jwt() ->> 'role' IN ('audit', 'moderator', 'system', 'admin')
  OR
  -- Allow service role for system operations
  auth.role() = 'service_role'
);

-- Policy: Only system role can insert audit events
-- Audit events should only be created by the system, not manually
CREATE POLICY audit_events_insert_system_only
ON public.audit_events
FOR INSERT
TO authenticated
WITH CHECK (
  auth.role() = 'service_role'
  OR
  auth.jwt() ->> 'role' = 'system'
);

-- Policy: Audit events are immutable - no updates or deletes allowed
-- This is enforced by triggers, but RLS provides additional protection
CREATE POLICY audit_events_no_updates
ON public.audit_events
FOR UPDATE
TO authenticated
USING (false);

CREATE POLICY audit_events_no_deletes
ON public.audit_events
FOR DELETE
TO authenticated
USING (false);

-- ============================================================================
-- Enable RLS on statements_of_reasons table
-- ============================================================================

ALTER TABLE public.statements_of_reasons ENABLE ROW LEVEL SECURITY;

-- Policy: Moderators can read SoRs for cases they handle
CREATE POLICY statements_of_reasons_select_moderators
ON public.statements_of_reasons
FOR SELECT
TO authenticated
USING (
  auth.jwt() ->> 'role' IN ('moderator', 'system', 'admin', 'audit')
  OR
  auth.role() = 'service_role'
  OR
  -- Users can view SoRs for their own reports (if decision references their content)
  -- This requires joining with moderation_decisions and content_reports
  EXISTS (
    SELECT 1 FROM public.moderation_decisions md
    JOIN public.content_reports cr ON cr.id = md.report_id
    WHERE md.id = statements_of_reasons.decision_id
    AND cr.reporter_id = auth.uid()
  )
);

-- Policy: Only moderators and system can create SoRs
CREATE POLICY statements_of_reasons_insert_moderators
ON public.statements_of_reasons
FOR INSERT
TO authenticated
WITH CHECK (
  auth.jwt() ->> 'role' IN ('moderator', 'system', 'admin')
  OR
  auth.role() = 'service_role'
);

-- Policy: Only moderators can update SoRs (for corrections before submission)
CREATE POLICY statements_of_reasons_update_moderators
ON public.statements_of_reasons
FOR UPDATE
TO authenticated
USING (
  auth.jwt() ->> 'role' IN ('moderator', 'system', 'admin')
  OR
  auth.role() = 'service_role'
)
WITH CHECK (
  auth.jwt() ->> 'role' IN ('moderator', 'system', 'admin')
  OR
  auth.role() = 'service_role'
);

-- Policy: No deletes on SoRs - they must be retained for DSA compliance
-- If a SoR needs to be "removed", mark it as deleted but keep the record
CREATE POLICY statements_of_reasons_no_deletes
ON public.statements_of_reasons
FOR DELETE
TO authenticated
USING (false);

-- ============================================================================
-- Force RLS to ensure policies are always applied
-- ============================================================================

ALTER TABLE public.audit_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.statements_of_reasons FORCE ROW LEVEL SECURITY;

COMMIT;
