-- Create monitoring and observability tables
-- Requirements: 5.5, 6.6, 10.5

-- ============================================================================
-- Monitoring Alerts Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS monitoring_alerts (
  id TEXT PRIMARY KEY,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  category TEXT NOT NULL CHECK (category IN ('performance', 'error', 'compliance', 'capacity', 'audit_integrity')),
  message TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  threshold NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for alert queries
CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_category_severity 
  ON monitoring_alerts(category, severity);
CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_metric_name 
  ON monitoring_alerts(metric_name);
CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_created_at 
  ON monitoring_alerts(created_at DESC);

-- ============================================================================
-- Alert Rules Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  condition TEXT NOT NULL CHECK (condition IN ('greater_than', 'less_than', 'equals')),
  threshold NUMERIC NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  notification_channels JSONB NOT NULL DEFAULT '[]'::jsonb,
  cooldown_minutes INTEGER NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for enabled rules
CREATE INDEX IF NOT EXISTS idx_alert_rules_metric_enabled 
  ON alert_rules(metric_name, enabled);

-- ============================================================================
-- Alert Notifications Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS alert_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id TEXT NOT NULL REFERENCES monitoring_alerts(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'slack', 'pagerduty', 'webhook')),
  recipient TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed')) DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for notification queries
CREATE INDEX IF NOT EXISTS idx_alert_notifications_alert_id 
  ON alert_notifications(alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_notifications_status 
  ON alert_notifications(status);

-- ============================================================================
-- Alert Escalations Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS alert_escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id TEXT NOT NULL REFERENCES monitoring_alerts(id) ON DELETE CASCADE,
  escalation_level INTEGER NOT NULL,
  escalated_to TEXT NOT NULL,
  escalated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by TEXT,
  UNIQUE(alert_id, escalation_level)
);

-- Indexes for escalation queries
CREATE INDEX IF NOT EXISTS idx_alert_escalations_alert_id 
  ON alert_escalations(alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_escalations_acknowledged 
  ON alert_escalations(acknowledged, escalated_at);

-- ============================================================================
-- Performance Metrics Table (Time-series data)
-- ============================================================================

CREATE TABLE IF NOT EXISTS performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type TEXT NOT NULL CHECK (metric_type IN ('report_submission', 'moderation_decision', 'appeal_processing')),
  p50_ms NUMERIC NOT NULL,
  p95_ms NUMERIC NOT NULL,
  p99_ms NUMERIC NOT NULL,
  throughput_per_minute NUMERIC NOT NULL,
  measured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for time-series queries
CREATE INDEX IF NOT EXISTS idx_performance_metrics_measured_at 
  ON performance_metrics(measured_at DESC);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_type_measured 
  ON performance_metrics(metric_type, measured_at DESC);

-- ============================================================================
-- Capacity Metrics Table (Time-series data)
-- ============================================================================

CREATE TABLE IF NOT EXISTS capacity_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pending_reports INTEGER NOT NULL,
  pending_appeals INTEGER NOT NULL,
  pending_sor_exports INTEGER NOT NULL,
  queue_growth_rate NUMERIC NOT NULL,
  moderator_utilization NUMERIC NOT NULL,
  estimated_capacity_hours NUMERIC NOT NULL,
  measured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for time-series queries
CREATE INDEX IF NOT EXISTS idx_capacity_metrics_measured_at 
  ON capacity_metrics(measured_at DESC);

-- ============================================================================
-- Audit Partition Checksums Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_partition_checksums (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partition_name TEXT NOT NULL UNIQUE,
  checksum TEXT NOT NULL,
  event_count INTEGER NOT NULL,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for partition queries
CREATE INDEX IF NOT EXISTS idx_audit_partition_checksums_partition 
  ON audit_partition_checksums(partition_name);
CREATE INDEX IF NOT EXISTS idx_audit_partition_checksums_verified 
  ON audit_partition_checksums(verified_at DESC);

-- ============================================================================
-- Moderation Sessions Table (for capacity tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS moderation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  moderator_id UUID NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  reports_processed INTEGER NOT NULL DEFAULT 0,
  decisions_made INTEGER NOT NULL DEFAULT 0
);

-- Indexes for session queries
CREATE INDEX IF NOT EXISTS idx_moderation_sessions_moderator 
  ON moderation_sessions(moderator_id);
CREATE INDEX IF NOT EXISTS idx_moderation_sessions_active 
  ON moderation_sessions(last_activity DESC) WHERE ended_at IS NULL;

-- ============================================================================
-- Updated At Triggers
-- ============================================================================

CREATE OR REPLACE FUNCTION update_alert_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_alert_rules_updated_at
  BEFORE UPDATE ON alert_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_alert_rules_updated_at();

-- ============================================================================
-- RLS Policies
-- ============================================================================

-- Enable RLS on all monitoring tables
ALTER TABLE monitoring_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE capacity_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_partition_checksums ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_sessions ENABLE ROW LEVEL SECURITY;

-- Policies for moderators and admins
CREATE POLICY "Moderators can view monitoring alerts"
  ON monitoring_alerts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (users.roles @> '["moderator"]'::jsonb OR users.roles @> '["admin"]'::jsonb)
    )
  );

CREATE POLICY "Admins can manage alert rules"
  ON alert_rules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.roles @> '["admin"]'::jsonb
    )
  );

CREATE POLICY "Moderators can view alert notifications"
  ON alert_notifications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (users.roles @> '["moderator"]'::jsonb OR users.roles @> '["admin"]'::jsonb)
    )
  );

CREATE POLICY "Moderators can acknowledge escalations"
  ON alert_escalations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (users.roles @> '["moderator"]'::jsonb OR users.roles @> '["admin"]'::jsonb)
    )
  );

CREATE POLICY "Moderators can view performance metrics"
  ON performance_metrics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (users.roles @> '["moderator"]'::jsonb OR users.roles @> '["admin"]'::jsonb)
    )
  );

CREATE POLICY "Moderators can view capacity metrics"
  ON capacity_metrics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (users.roles @> '["moderator"]'::jsonb OR users.roles @> '["admin"]'::jsonb)
    )
  );

CREATE POLICY "Admins can view audit checksums"
  ON audit_partition_checksums FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.roles @> '["admin"]'::jsonb
    )
  );

CREATE POLICY "Moderators can view their sessions"
  ON moderation_sessions FOR SELECT
  USING (
    moderator_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.roles @> '["admin"]'::jsonb
    )
  );

-- ============================================================================
-- Default Alert Rules
-- ============================================================================

-- Insert default alert rules for critical metrics
INSERT INTO alert_rules (name, metric_name, condition, threshold, severity, notification_channels, cooldown_minutes)
VALUES
  ('High Report Submission Latency', 'report_submission_p95', 'greater_than', 5000, 'warning', '["email", "slack"]'::jsonb, 30),
  ('Low SLA Compliance', 'sla_compliance_rate', 'less_than', 95, 'error', '["email", "slack"]'::jsonb, 60),
  ('High Critical Error Rate', 'critical_error_rate_percent', 'greater_than', 1, 'critical', '["email", "slack", "pagerduty"]'::jsonb, 15),
  ('DSA Submission Failures', 'dsa_submission_failures', 'greater_than', 10, 'critical', '["email", "slack"]'::jsonb, 30),
  ('Low Audit Integrity', 'integrity_score', 'less_than', 99, 'critical', '["email", "slack", "pagerduty"]'::jsonb, 15),
  ('Low Capacity', 'estimated_capacity_hours', 'less_than', 24, 'warning', '["email", "slack"]'::jsonb, 60),
  ('High Moderator Utilization', 'moderator_utilization', 'greater_than', 90, 'error', '["email", "slack"]'::jsonb, 30)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE monitoring_alerts IS 'Stores monitoring alerts generated by the system';
COMMENT ON TABLE alert_rules IS 'Defines rules for generating alerts based on metrics';
COMMENT ON TABLE alert_notifications IS 'Tracks alert notifications sent via various channels';
COMMENT ON TABLE alert_escalations IS 'Manages alert escalation workflow';
COMMENT ON TABLE performance_metrics IS 'Time-series performance metrics for monitoring';
COMMENT ON TABLE capacity_metrics IS 'Time-series capacity metrics for scaling decisions';
COMMENT ON TABLE audit_partition_checksums IS 'Checksums for audit log partitions to detect tampering';
COMMENT ON TABLE moderation_sessions IS 'Tracks active moderation sessions for capacity planning';
