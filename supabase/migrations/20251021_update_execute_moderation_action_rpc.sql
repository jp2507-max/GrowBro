-- Update execute_moderation_action RPC to remove idempotency_key and fetch parameters from decision
-- Relies on UNIQUE constraint on action_executions.decision_id for idempotency

CREATE OR REPLACE FUNCTION execute_moderation_action(
  p_decision_id UUID,
  p_executed_by UUID
) RETURNS JSONB AS $$
DECLARE
  v_execution_id UUID;
  v_existing_execution JSONB;
  v_notification_id UUID;
  v_decision RECORD;
  v_report RECORD;
  v_statement RECORD;
BEGIN
  -- Fetch decision details
  SELECT * INTO v_decision
  FROM moderation_decisions md
  WHERE md.id = p_decision_id;

  IF v_decision IS NULL THEN
    RAISE EXCEPTION 'Decision not found: %', p_decision_id;
  END IF;

  -- Fetch report details
  SELECT * INTO v_report
  FROM content_reports cr
  WHERE cr.id = v_decision.report_id;

  IF v_report IS NULL THEN
    RAISE EXCEPTION 'Report not found for decision: %', p_decision_id;
  END IF;

  -- Fetch statement of reasons if exists
  SELECT * INTO v_statement
  FROM statements_of_reasons sor
  WHERE sor.decision_id = p_decision_id;

  -- Check for existing execution by decision_id
  SELECT jsonb_build_object(
    'id', ae.id,
    'decision_id', ae.decision_id,
    'executed_at', ae.executed_at
  ) INTO v_existing_execution
  FROM action_executions ae
  WHERE ae.decision_id = p_decision_id;

  IF v_existing_execution IS NOT NULL THEN
    -- Return existing execution
    RETURN v_existing_execution;
  END IF;

  -- Execute the action based on type
  CASE v_decision.action
    WHEN 'no_action' THEN
      -- Mark report as resolved
      UPDATE content_reports
      SET status = 'resolved', updated_at = NOW()
      WHERE id = v_decision.report_id;

    WHEN 'quarantine' THEN
      -- Reduce content visibility
      UPDATE posts
      SET quarantined = true, visibility = 'limited', updated_at = NOW()
      WHERE id = v_report.content_id;

    WHEN 'geo_block' THEN
      -- Insert geo-block records
      INSERT INTO content_geo_blocks (content_id, territory_code, reason_code)
      SELECT v_report.content_id, unnest(v_statement.territorial_scope), v_decision.policy_violations[1];

    WHEN 'rate_limit' THEN
      -- Throttle user posting
      INSERT INTO user_rate_limits (user_id, reason_code, expires_at, posts_per_hour)
      VALUES (v_decision.user_id, v_decision.policy_violations[1], NOW() + INTERVAL '30 days', 1);

    WHEN 'shadow_ban' THEN
      -- Make user posts invisible
      INSERT INTO user_shadow_bans (user_id, reason_code, expires_at)
      VALUES (v_decision.user_id, v_decision.policy_violations[1], NOW() + INTERVAL '30 days');

    WHEN 'suspend_user' THEN
      -- Temporary account suspension
      INSERT INTO user_suspensions (user_id, reason_code, expires_at)
      VALUES (v_decision.user_id, v_decision.policy_violations[1], NOW() + INTERVAL '30 days');

      -- Update user account status to suspended
      UPDATE users SET suspended = true, suspension_expires_at = NOW() + INTERVAL '30 days', updated_at = NOW()
      WHERE id = v_decision.user_id;

    WHEN 'remove' THEN
      -- Permanent deletion
      UPDATE posts
      SET deleted_at = NOW(), deleted_by = p_executed_by, deletion_reason = v_decision.policy_violations[1]
      WHERE id = v_report.content_id;

    ELSE
      RAISE EXCEPTION 'Unknown action type: %', v_decision.action;
  END CASE;

  -- Record execution
  INSERT INTO action_executions (
    decision_id, action, content_id, user_id, reason_code,
    duration_days, expires_at, territorial_scope, executed_by
  ) VALUES (
    p_decision_id, v_decision.action, v_report.content_id, v_decision.user_id, v_decision.policy_violations[1],
    NULL, 
    CASE WHEN v_decision.action IN ('rate_limit', 'shadow_ban', 'suspend_user') THEN NOW() + INTERVAL '30 days' ELSE NULL END,
    v_statement.territorial_scope, p_executed_by
  ) RETURNING id INTO v_execution_id;

  -- Update decision status
  UPDATE moderation_decisions
  SET status = 'executed', executed_at = NOW()
  WHERE id = p_decision_id;

  -- Queue notification
  INSERT INTO moderation_notifications (user_id, decision_id, action, scheduled_for)
  VALUES (v_decision.user_id, p_decision_id, v_decision.action, NOW() + INTERVAL '1 minute')
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
    WHERE ae.decision_id = p_decision_id;

    IF v_existing_execution IS NOT NULL THEN
      RETURN v_existing_execution;
    END IF;

    -- Re-raise if not an idempotency conflict
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update comment
COMMENT ON FUNCTION execute_moderation_action(UUID, UUID) IS 'Atomic execution of moderation actions with idempotency via UNIQUE constraint on decision_id';