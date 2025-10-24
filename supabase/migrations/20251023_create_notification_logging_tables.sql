-- Create notification delivery log table for audit trail
-- Tracks all moderation-related notifications sent to users
-- Requirement 3.5: Log SoR delivery within 15 minutes

CREATE TABLE IF NOT EXISTS notification_delivery_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  notification_type TEXT NOT NULL CHECK (notification_type IN (
    'decision_made',
    'sor_delivered',
    'appeal_deadline',
    'appeal_deadline_reminder',
    'sla_breach',
    'sla_warning'
  )),
  decision_id UUID,
  statement_id UUID,
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL CHECK (status IN ('delivered', 'failed', 'pending')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create moderator alert log table
-- Tracks SLA breach alerts and escalations sent to moderators
-- Requirement 5.2: SLA breach alerts

CREATE TABLE IF NOT EXISTS moderator_alert_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  moderator_id UUID NOT NULL,
  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'sla_breach',
    'sla_warning',
    'escalation_required'
  )),
  report_id UUID NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  sla_percentage INTEGER,
  deadline_date TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_notification_delivery_log_user_id 
  ON notification_delivery_log(user_id);

CREATE INDEX IF NOT EXISTS idx_notification_delivery_log_decision_id 
  ON notification_delivery_log(decision_id);

CREATE INDEX IF NOT EXISTS idx_notification_delivery_log_delivered_at 
  ON notification_delivery_log(delivered_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_delivery_log_status 
  ON notification_delivery_log(status);

CREATE INDEX IF NOT EXISTS idx_moderator_alert_log_moderator_id 
  ON moderator_alert_log(moderator_id);

CREATE INDEX IF NOT EXISTS idx_moderator_alert_log_report_id 
  ON moderator_alert_log(report_id);

CREATE INDEX IF NOT EXISTS idx_moderator_alert_log_created_at 
  ON moderator_alert_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_moderator_alert_log_acknowledged 
  ON moderator_alert_log(acknowledged_at) 
  WHERE acknowledged_at IS NULL;

-- Updated at trigger for notification_delivery_log
CREATE OR REPLACE FUNCTION update_notification_delivery_log_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_notification_delivery_log_updated_at
  BEFORE UPDATE ON notification_delivery_log
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_delivery_log_updated_at();

-- RLS policies for notification_delivery_log
ALTER TABLE notification_delivery_log ENABLE ROW LEVEL SECURITY;

-- Users can view their own notification logs
CREATE POLICY notification_delivery_log_select_own
  ON notification_delivery_log
  FOR SELECT
  USING (auth.uid() = user_id);

-- Moderators can view all notification logs
CREATE POLICY notification_delivery_log_select_moderator
  ON notification_delivery_log
  FOR SELECT
  USING (
    auth.jwt()->>'mod_role' IN ('admin', 'moderator')
  );

-- System can insert notification logs
CREATE POLICY notification_delivery_log_insert_system
  ON notification_delivery_log
  FOR INSERT
  WITH CHECK (true);

-- RLS policies for moderator_alert_log
ALTER TABLE moderator_alert_log ENABLE ROW LEVEL SECURITY;

-- Moderators can view their own alerts
CREATE POLICY moderator_alert_log_select_own
  ON moderator_alert_log
  FOR SELECT
  USING (auth.uid() = moderator_id);

-- Admins can view all alerts
CREATE POLICY moderator_alert_log_select_admin
  ON moderator_alert_log
  FOR SELECT
  USING (
    auth.jwt()->>'mod_role' = 'admin'
  );

-- System can insert alerts
CREATE POLICY moderator_alert_log_insert_system
  ON moderator_alert_log
  FOR INSERT
  WITH CHECK (true);

-- Moderators can acknowledge their own alerts
CREATE POLICY moderator_alert_log_update_own
  ON moderator_alert_log
  FOR UPDATE
  USING (auth.uid() = moderator_id)
  WITH CHECK (auth.uid() = moderator_id);

-- Helper function to check SoR delivery compliance (15-minute requirement)
CREATE OR REPLACE FUNCTION check_sor_delivery_compliance(
  p_decision_id UUID
)
RETURNS TABLE (
  decision_id UUID,
  decision_created_at TIMESTAMPTZ,
  sor_delivered_at TIMESTAMPTZ,
  delivery_time_minutes INTEGER,
  is_compliant BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id AS decision_id,
    d.created_at AS decision_created_at,
    ndl.delivered_at AS sor_delivered_at,
    EXTRACT(EPOCH FROM (ndl.delivered_at - d.created_at)) / 60 AS delivery_time_minutes,
    (EXTRACT(EPOCH FROM (ndl.delivered_at - d.created_at)) / 60) <= 15 AS is_compliant
  FROM moderation_decisions d
  LEFT JOIN notification_delivery_log ndl ON ndl.decision_id = d.id
    AND ndl.notification_type = 'sor_delivered'
    AND ndl.status = 'delivered'
  WHERE d.id = p_decision_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get unacknowledged moderator alerts
CREATE OR REPLACE FUNCTION get_unacknowledged_alerts(
  p_moderator_id UUID
)
RETURNS TABLE (
  id UUID,
  alert_type TEXT,
  report_id UUID,
  priority TEXT,
  sla_percentage INTEGER,
  created_at TIMESTAMPTZ,
  age_minutes INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    mal.id,
    mal.alert_type,
    mal.report_id,
    mal.priority,
    mal.sla_percentage,
    mal.created_at,
    EXTRACT(EPOCH FROM (NOW() - mal.created_at)) / 60 AS age_minutes
  FROM moderator_alert_log mal
  WHERE mal.moderator_id = p_moderator_id
    AND mal.acknowledged_at IS NULL
  ORDER BY
    CASE mal.priority
      WHEN 'critical' THEN 1
      WHEN 'high' THEN 2
      WHEN 'medium' THEN 3
      WHEN 'low' THEN 4
    END,
    mal.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments for documentation
COMMENT ON TABLE notification_delivery_log IS 'Audit log for all moderation-related notifications sent to users. Tracks SoR delivery compliance (15-minute requirement).';
COMMENT ON TABLE moderator_alert_log IS 'Log of SLA breach alerts and escalations sent to moderators. Tracks acknowledgment status.';
COMMENT ON FUNCTION check_sor_delivery_compliance IS 'Checks if Statement of Reasons was delivered within 15 minutes of decision (DSA Art. 17 requirement).';
COMMENT ON FUNCTION get_unacknowledged_alerts IS 'Returns unacknowledged alerts for a moderator, ordered by priority and age.';
