-- Migration: Create moderation action execution tables and RPC
-- Description: Tables for executing moderation actions with idempotency and atomic transactions
-- Requirements: DSA compliance for action execution and notification

-- ============================================================================
-- Action Executions (Audit trail for executed actions)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.action_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id UUID NOT NULL REFERENCES public.moderation_decisions(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN (
    'no_action',
    'quarantine',
    'geo_block',
    'rate_limit',
    'shadow_ban',
    'suspend_user',
    'remove'
  )),
  content_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason_code TEXT NOT NULL,
  duration_days INTEGER,
  expires_at TIMESTAMPTZ,
  territorial_scope TEXT[],
  executed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  idempotency_key TEXT,
  UNIQUE(decision_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_action_executions_decision_id ON public.action_executions (decision_id);
CREATE INDEX IF NOT EXISTS idx_action_executions_user_id ON public.action_executions (user_id);
CREATE INDEX IF NOT EXISTS idx_action_executions_idempotency_key ON public.action_executions (idempotency_key);

-- ============================================================================
-- Content Geo Blocks (Territorial restrictions)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.content_geo_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id TEXT NOT NULL,
  territory_code TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(content_id, territory_code, reason_code)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_content_geo_blocks_content_id ON public.content_geo_blocks (content_id);
CREATE INDEX IF NOT EXISTS idx_content_geo_blocks_territory ON public.content_geo_blocks (territory_code);

-- ============================================================================
-- User Rate Limits (Posting restrictions)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason_code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  posts_per_hour INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, reason_code, expires_at)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_rate_limits_user_id ON public.user_rate_limits (user_id);
CREATE INDEX IF NOT EXISTS idx_user_rate_limits_expires_at ON public.user_rate_limits (expires_at);

-- ============================================================================
-- User Shadow Bans (Invisible posts)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_shadow_bans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason_code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, reason_code, expires_at)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_shadow_bans_user_id ON public.user_shadow_bans (user_id);
CREATE INDEX IF NOT EXISTS idx_user_shadow_bans_expires_at ON public.user_shadow_bans (expires_at);

-- ============================================================================
-- User Profiles (Extends auth.users with app-specific data)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  suspended BOOLEAN NOT NULL DEFAULT false,
  suspension_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_suspended ON public.users (suspended) WHERE suspended = true;
CREATE INDEX IF NOT EXISTS idx_users_suspension_expires_at ON public.users (suspension_expires_at) WHERE suspension_expires_at IS NOT NULL;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_users_updated_at();

-- ============================================================================
-- User Suspensions (Account restrictions)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_suspensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason_code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  suspended_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, reason_code, expires_at)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_suspensions_user_id ON public.user_suspensions (user_id);
CREATE INDEX IF NOT EXISTS idx_user_suspensions_expires_at ON public.user_suspensions (expires_at);

-- ============================================================================
-- Moderation Notifications (User notifications queue)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.moderation_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  decision_id UUID NOT NULL REFERENCES public.moderation_decisions(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  error_message TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_moderation_notifications_user_id ON public.moderation_notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_moderation_notifications_status_scheduled ON public.moderation_notifications (status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_moderation_notifications_decision_id ON public.moderation_notifications (decision_id);

-- ============================================================================
-- execute_moderation_action RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION execute_moderation_action(
  p_decision_id UUID,
  p_idempotency_key TEXT,
  p_action TEXT,
  p_content_id TEXT,
  p_user_id UUID,
  p_reason_code TEXT,
  p_duration_days INTEGER DEFAULT NULL,
  p_expires_at TIMESTAMPTZ DEFAULT NULL,
  p_territorial_scope TEXT[] DEFAULT NULL,
  p_executed_by UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_execution_id UUID;
  v_existing_execution JSONB;
  v_notification_id UUID;
BEGIN
  -- Check for existing execution by decision_id or idempotency_key
  SELECT jsonb_build_object(
    'id', ae.id,
    'decision_id', ae.decision_id,
    'executed_at', ae.executed_at
  ) INTO v_existing_execution
  FROM action_executions ae
  WHERE ae.decision_id = p_decision_id
     OR ae.idempotency_key = p_idempotency_key;

  IF v_existing_execution IS NOT NULL THEN
    -- Return existing execution
    RETURN v_existing_execution;
  END IF;

  -- Execute the action based on type
  CASE p_action
    WHEN 'no_action' THEN
      -- Mark report as resolved
      UPDATE content_reports
      SET status = 'resolved', updated_at = NOW()
      WHERE id = (SELECT report_id FROM moderation_decisions WHERE id = p_decision_id);

    WHEN 'quarantine' THEN
      -- Reduce content visibility
      UPDATE posts
      SET quarantined = true, visibility = 'limited', updated_at = NOW()
      WHERE id = p_content_id;

    WHEN 'geo_block' THEN
      -- Insert geo-block records
      INSERT INTO content_geo_blocks (content_id, territory_code, reason_code)
      SELECT p_content_id, unnest(p_territorial_scope), p_reason_code;

    WHEN 'rate_limit' THEN
      -- Throttle user posting
      INSERT INTO user_rate_limits (user_id, reason_code, expires_at, posts_per_hour)
      VALUES (p_user_id, p_reason_code, p_expires_at, 1);

    WHEN 'shadow_ban' THEN
      -- Make user posts invisible
      INSERT INTO user_shadow_bans (user_id, reason_code, expires_at)
      VALUES (p_user_id, p_reason_code, p_expires_at);

    WHEN 'suspend_user' THEN
      -- Temporary account suspension
      INSERT INTO user_suspensions (user_id, reason_code, expires_at)
      VALUES (p_user_id, p_reason_code, p_expires_at);

      -- Update user account status to suspended
      UPDATE users SET suspended = true, suspension_expires_at = p_expires_at, updated_at = NOW()
      WHERE id = p_user_id;

    WHEN 'remove' THEN
      -- Permanent deletion
      UPDATE posts
      SET deleted_at = NOW(), deleted_by = p_executed_by, deletion_reason = p_reason_code
      WHERE id = p_content_id;

    ELSE
      RAISE EXCEPTION 'Unknown action type: %', p_action;
  END CASE;

  -- Record execution
  INSERT INTO action_executions (
    decision_id, action, content_id, user_id, reason_code,
    duration_days, expires_at, territorial_scope, executed_by, idempotency_key
  ) VALUES (
    p_decision_id, p_action, p_content_id, p_user_id, p_reason_code,
    p_duration_days, p_expires_at, p_territorial_scope, p_executed_by, p_idempotency_key
  ) RETURNING id INTO v_execution_id;

  -- Update decision status
  UPDATE moderation_decisions
  SET status = 'executed', executed_at = NOW()
  WHERE id = p_decision_id;

  -- Queue notification
  INSERT INTO moderation_notifications (user_id, decision_id, action, scheduled_for)
  VALUES (p_user_id, p_decision_id, p_action, NOW() + INTERVAL '1 minute')
  RETURNING id INTO v_notification_id;

  -- Return execution details
  RETURN jsonb_build_object(
    'id', v_execution_id,
    'decision_id', p_decision_id,
    'executed_at', NOW()
  );

EXCEPTION
  WHEN unique_violation THEN
    -- Handle idempotency: return existing execution
    SELECT jsonb_build_object(
      'id', ae.id,
      'decision_id', ae.decision_id,
      'executed_at', ae.executed_at
    ) INTO v_existing_execution
    FROM action_executions ae
    WHERE ae.decision_id = p_decision_id
       OR ae.idempotency_key = p_idempotency_key;

    IF v_existing_execution IS NOT NULL THEN
      RETURN v_existing_execution;
    END IF;

    -- Re-raise if not an idempotency conflict
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE public.users IS 'User profiles extending auth.users with app-specific data';
COMMENT ON TABLE public.action_executions IS 'Audit trail for executed moderation actions with idempotency support';
COMMENT ON TABLE public.content_geo_blocks IS 'Territorial content restrictions by territory and reason';
COMMENT ON TABLE public.user_rate_limits IS 'User posting rate limits with expiration';
COMMENT ON TABLE public.user_shadow_bans IS 'User shadow bans making posts invisible to others';
COMMENT ON TABLE public.user_suspensions IS 'User account suspensions with expiration';
COMMENT ON TABLE public.moderation_notifications IS 'Queue for user notifications about moderation actions';
COMMENT ON FUNCTION execute_moderation_action(UUID, TEXT, TEXT, TEXT, UUID, TEXT, INTEGER, TIMESTAMPTZ, TEXT[], UUID) IS 'Atomic execution of moderation actions with idempotency and notification queuing';