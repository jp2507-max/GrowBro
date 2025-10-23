-- Migration: Create SLA Alerts and Incidents tables
-- Requirements: 5.2, 5.3, 5.7
-- Description: Tables for tracking SLA threshold alerts and breach incidents

-- ============================================================================
-- SLA Alerts Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS sla_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Reference to the report
  report_id UUID NOT NULL REFERENCES content_reports(id) ON DELETE CASCADE,
  
  -- Alert details
  alert_level TEXT NOT NULL CHECK (alert_level IN ('75', '90', 'breach')),
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Notification
  supervisor_ids TEXT[] NOT NULL DEFAULT '{}',
  acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
  acknowledged_by TEXT,
  acknowledged_at TIMESTAMPTZ,
  
  -- Notification channels
  notification_channels JSONB DEFAULT '[]'::jsonb,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_sla_alerts_report_id ON sla_alerts(report_id);
CREATE INDEX IF NOT EXISTS idx_sla_alerts_acknowledged ON sla_alerts(acknowledged) WHERE acknowledged = FALSE;
CREATE INDEX IF NOT EXISTS idx_sla_alerts_alert_level ON sla_alerts(alert_level);
CREATE INDEX IF NOT EXISTS idx_sla_alerts_triggered_at ON sla_alerts(triggered_at DESC);

-- Prevent duplicate alerts for same report at same level
CREATE UNIQUE INDEX IF NOT EXISTS idx_sla_alerts_unique_report_level 
  ON sla_alerts(report_id, alert_level);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_sla_alerts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_sla_alerts_updated_at
  BEFORE UPDATE ON sla_alerts
  FOR EACH ROW
  EXECUTE FUNCTION update_sla_alerts_updated_at();

-- ============================================================================
-- SLA Incidents Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS sla_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Reference to the report
  report_id UUID NOT NULL REFERENCES content_reports(id) ON DELETE CASCADE,
  
  -- Incident classification
  incident_type TEXT NOT NULL CHECK (incident_type IN ('sla_breach', 'system_degradation', 'manual_escalation')),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL CHECK (status IN ('open', 'investigating', 'resolved', 'closed')),
  
  -- Breach details
  breach_duration_hours NUMERIC(10, 2) NOT NULL,
  
  -- Escalation
  escalated_to TEXT[] NOT NULL DEFAULT '{}',
  
  -- Resolution
  root_cause TEXT,
  corrective_actions TEXT[] DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_sla_incidents_report_id ON sla_incidents(report_id);
CREATE INDEX IF NOT EXISTS idx_sla_incidents_status ON sla_incidents(status);
CREATE INDEX IF NOT EXISTS idx_sla_incidents_severity ON sla_incidents(severity);
CREATE INDEX IF NOT EXISTS idx_sla_incidents_created_at ON sla_incidents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sla_incidents_incident_type ON sla_incidents(incident_type);

-- Index for open incidents dashboard queries
CREATE INDEX IF NOT EXISTS idx_sla_incidents_open 
  ON sla_incidents(status, severity, created_at DESC) 
  WHERE status IN ('open', 'investigating');

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_sla_incidents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_sla_incidents_updated_at
  BEFORE UPDATE ON sla_incidents
  FOR EACH ROW
  EXECUTE FUNCTION update_sla_incidents_updated_at();

-- ============================================================================
-- Notifications Table (if not exists)
-- ============================================================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}'::jsonb,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

-- Indexes for notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, read) WHERE read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE sla_alerts IS 'SLA threshold alerts for supervisors (75%, 90%, breach)';
COMMENT ON TABLE sla_incidents IS 'SLA breach incidents requiring management escalation and root cause analysis';
COMMENT ON TABLE notifications IS 'In-app notifications for users and moderators';

COMMENT ON COLUMN sla_alerts.alert_level IS 'Alert threshold: 75 (75% time used), 90 (90% time used), or breach (deadline passed)';
COMMENT ON COLUMN sla_alerts.notification_channels IS 'JSON array of notification delivery results';
COMMENT ON COLUMN sla_incidents.breach_duration_hours IS 'Hours past the SLA deadline';
COMMENT ON COLUMN sla_incidents.root_cause IS 'Root cause analysis per DSA compliance requirements';
COMMENT ON COLUMN sla_incidents.corrective_actions IS 'List of corrective actions taken or planned';
