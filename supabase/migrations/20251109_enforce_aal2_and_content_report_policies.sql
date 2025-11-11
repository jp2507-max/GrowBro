-- Harden sensitive flows with AAL2 enforcement and fix content report RLS
-- Requirements addressed:
--   - Authentication step-up (AAL2) for destructive/account actions
--   - Moderator visibility for DSA content reports without requiring self-reporting

BEGIN;

-- ============================================================================
-- Account deletion requests must originate from AAL2-authenticated sessions
-- ============================================================================

DROP POLICY IF EXISTS "Users can create deletion request if no pending request exists"
  ON public.account_deletion_requests;

CREATE POLICY "AAL2 users can create deletion requests"
  ON public.account_deletion_requests
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND COALESCE(auth.jwt() ->> 'aal', '0') = '2'
    AND NOT EXISTS (
      SELECT 1
      FROM public.account_deletion_requests adr
      WHERE adr.user_id = auth.uid()
        AND adr.status = 'pending'
    )
  );

DROP POLICY IF EXISTS "Users can cancel own deletion requests"
  ON public.account_deletion_requests;

CREATE POLICY "AAL2 users can cancel deletion requests"
  ON public.account_deletion_requests
  FOR UPDATE
  USING (
    auth.uid() = user_id
    AND COALESCE(auth.jwt() ->> 'aal', '0') = '2'
  )
  WITH CHECK (
    auth.uid() = user_id
    AND COALESCE(auth.jwt() ->> 'aal', '0') = '2'
    AND status = 'cancelled'
  );

COMMENT ON POLICY "AAL2 users can create deletion requests" ON public.account_deletion_requests
  IS 'Requires multi-factor (aal2) session before scheduling destructive account deletion';

COMMENT ON POLICY "AAL2 users can cancel deletion requests" ON public.account_deletion_requests
  IS 'Only aal2 sessions can cancel/delete pending account deletion workflows';

-- ============================================================================
-- Content report policies: allow reporting other users and enable moderator view
-- ============================================================================

DROP POLICY IF EXISTS content_reports_insert_own ON public.content_reports;
DROP POLICY IF EXISTS content_reports_select_moderators ON public.content_reports;

CREATE POLICY content_reports_insert_own
  ON public.content_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    reporter_id = auth.uid()
  );

CREATE POLICY content_reports_select_moderators
  ON public.content_reports
  FOR SELECT
  TO authenticated
  USING (
    auth.jwt() ->> 'role' IN ('admin', 'moderator', 'service_role')
    OR (auth.jwt() -> 'app_metadata' -> 'roles')::jsonb ? 'moderator'
    OR (auth.jwt() -> 'app_metadata' -> 'roles')::jsonb ? 'admin'
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'moderator', 'supervisor')
    )
  );

COMMENT ON POLICY content_reports_insert_own ON public.content_reports
  IS 'Reporters can file notices against any content; reported user stored separately.';

COMMENT ON POLICY content_reports_select_moderators ON public.content_reports
  IS 'Moderators/admins gain read access via JWT role or user_roles lookup to review DSA notices.';

COMMIT;

