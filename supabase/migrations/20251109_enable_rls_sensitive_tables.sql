-- Harden sensitive moderation/account tables by enforcing RLS and strict grants
-- Addresses: security hardening tracker gaps (moderation tables & auth lockouts)

BEGIN;

-- Helper function used across policies to detect moderation staff
CREATE OR REPLACE FUNCTION public.has_moderation_role()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN
    auth.jwt() ->> 'role' IN ('admin', 'moderator', 'supervisor')
    OR (auth.jwt() -> 'app_metadata' -> 'roles')::jsonb ?| ARRAY['admin', 'moderator', 'supervisor']
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'moderator', 'supervisor')
    );
END;
$$;

-- ============================================================================
-- public.users
-- ============================================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.users FROM anon, authenticated;
GRANT SELECT ON public.users TO authenticated;

CREATE POLICY users_self_select ON public.users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY users_moderation_select ON public.users
  FOR SELECT
  TO authenticated
  USING (public.has_moderation_role());

CREATE POLICY users_moderation_update ON public.users
  FOR UPDATE
  TO authenticated
  USING (public.has_moderation_role())
  WITH CHECK (public.has_moderation_role());

CREATE POLICY users_service_role_all ON public.users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- public.user_roles
-- ============================================================================
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.user_roles FROM anon, authenticated;
GRANT SELECT ON public.user_roles TO authenticated;

CREATE POLICY user_roles_self_select ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY user_roles_service_role_all ON public.user_roles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- public.user_rate_limits
-- ============================================================================
ALTER TABLE public.user_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_rate_limits FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.user_rate_limits FROM anon, authenticated;

CREATE POLICY user_rate_limits_service_role_all ON public.user_rate_limits
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- public.user_shadow_bans
-- ============================================================================
ALTER TABLE public.user_shadow_bans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_shadow_bans FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.user_shadow_bans FROM anon, authenticated;
GRANT SELECT ON public.user_shadow_bans TO authenticated;

CREATE POLICY user_shadow_bans_self_select ON public.user_shadow_bans
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY user_shadow_bans_moderation_select ON public.user_shadow_bans
  FOR SELECT
  TO authenticated
  USING (public.has_moderation_role());

CREATE POLICY user_shadow_bans_service_role_all ON public.user_shadow_bans
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- public.user_suspensions
-- ============================================================================
ALTER TABLE public.user_suspensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_suspensions FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.user_suspensions FROM anon, authenticated;
GRANT SELECT ON public.user_suspensions TO authenticated;

CREATE POLICY user_suspensions_self_select ON public.user_suspensions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY user_suspensions_moderation_select ON public.user_suspensions
  FOR SELECT
  TO authenticated
  USING (public.has_moderation_role());

CREATE POLICY user_suspensions_service_role_all ON public.user_suspensions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- public.moderation_notifications
-- ============================================================================
ALTER TABLE public.moderation_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_notifications FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.moderation_notifications FROM anon, authenticated;
GRANT SELECT ON public.moderation_notifications TO authenticated;

CREATE POLICY moderation_notifications_self_select ON public.moderation_notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY moderation_notifications_moderation_select ON public.moderation_notifications
  FOR SELECT
  TO authenticated
  USING (public.has_moderation_role());

CREATE POLICY moderation_notifications_service_role_all ON public.moderation_notifications
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- public.notifications (management alerts)
-- ============================================================================
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.notifications FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;

CREATE POLICY notifications_moderation_select ON public.notifications
  FOR SELECT
  TO authenticated
  USING (public.has_moderation_role());

CREATE POLICY notifications_moderation_insert ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_moderation_role());

CREATE POLICY notifications_moderation_update ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (public.has_moderation_role())
  WITH CHECK (public.has_moderation_role());

CREATE POLICY notifications_service_role_all ON public.notifications
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- public.action_executions
-- ============================================================================
ALTER TABLE public.action_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_executions FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.action_executions FROM anon, authenticated;

CREATE POLICY action_executions_service_role_all ON public.action_executions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- public.auth_lockouts
-- ============================================================================
ALTER TABLE public.auth_lockouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_lockouts FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.auth_lockouts FROM anon, authenticated;

CREATE POLICY auth_lockouts_service_role_all ON public.auth_lockouts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- public.sla_alerts
-- ============================================================================
ALTER TABLE public.sla_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sla_alerts FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.sla_alerts FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.sla_alerts TO authenticated;

CREATE POLICY sla_alerts_moderation_select ON public.sla_alerts
  FOR SELECT
  TO authenticated
  USING (public.has_moderation_role());

CREATE POLICY sla_alerts_moderation_insert ON public.sla_alerts
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_moderation_role());

CREATE POLICY sla_alerts_moderation_update ON public.sla_alerts
  FOR UPDATE
  TO authenticated
  USING (public.has_moderation_role())
  WITH CHECK (public.has_moderation_role());

CREATE POLICY sla_alerts_service_role_all ON public.sla_alerts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- public.sla_incidents
-- ============================================================================
ALTER TABLE public.sla_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sla_incidents FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.sla_incidents FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.sla_incidents TO authenticated;

CREATE POLICY sla_incidents_moderation_select ON public.sla_incidents
  FOR SELECT
  TO authenticated
  USING (public.has_moderation_role());

CREATE POLICY sla_incidents_moderation_insert ON public.sla_incidents
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_moderation_role());

CREATE POLICY sla_incidents_moderation_update ON public.sla_incidents
  FOR UPDATE
  TO authenticated
  USING (public.has_moderation_role())
  WITH CHECK (public.has_moderation_role());

CREATE POLICY sla_incidents_service_role_all ON public.sla_incidents
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMIT;
