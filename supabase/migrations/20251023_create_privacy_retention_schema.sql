-- Privacy and Data Retention Schema
-- Implements GDPR compliance for moderation system

-- Legal holds table
CREATE TABLE IF NOT EXISTS legal_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type TEXT NOT NULL CHECK (target_type IN ('user', 'content', 'report', 'decision', 'appeal')),
  target_id UUID NOT NULL,
  reason TEXT NOT NULL,
  legal_basis TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  review_date TIMESTAMPTZ NOT NULL,
  released_at TIMESTAMPTZ,
  metadata JSONB,
  CONSTRAINT legal_holds_target_unique UNIQUE (target_type, target_id, released_at)
);

CREATE INDEX idx_legal_holds_target ON legal_holds(target_type, target_id);
CREATE INDEX idx_legal_holds_active ON legal_holds(target_type, target_id) WHERE released_at IS NULL;
CREATE INDEX idx_legal_holds_review_date ON legal_holds(review_date) WHERE released_at IS NULL;

COMMENT ON TABLE legal_holds IS 'Legal holds preventing data deletion for active investigations or legal proceedings';

-- Data deletion records table
CREATE TABLE IF NOT EXISTS data_deletion_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type TEXT NOT NULL CHECK (target_type IN ('user', 'content', 'report', 'decision', 'appeal', 'audit')),
  target_id UUID NOT NULL,
  deletion_type TEXT NOT NULL CHECK (deletion_type IN ('logical', 'physical')),
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_by TEXT NOT NULL, -- UUID or 'system'
  reason TEXT NOT NULL,
  retention_policy TEXT NOT NULL,
  tombstone_until TIMESTAMPTZ,
  metadata JSONB
);

CREATE INDEX idx_data_deletion_records_target ON data_deletion_records(target_type, target_id);
CREATE INDEX idx_data_deletion_records_deleted_at ON data_deletion_records(deleted_at);
CREATE INDEX idx_data_deletion_records_tombstone ON data_deletion_records(tombstone_until) WHERE tombstone_until IS NOT NULL;

COMMENT ON TABLE data_deletion_records IS 'Audit trail of all data deletions (logical and physical)';

-- Privacy notices table
CREATE TABLE IF NOT EXISTS privacy_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL,
  effective_date TIMESTAMPTZ NOT NULL,
  content TEXT NOT NULL,
  language TEXT NOT NULL CHECK (LENGTH(language) = 2), -- ISO 639-1
  data_categories TEXT[] NOT NULL,
  legal_bases TEXT[] NOT NULL,
  retention_periods JSONB NOT NULL,
  third_party_processors TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT privacy_notices_version_language_unique UNIQUE (version, language)
);

CREATE INDEX idx_privacy_notices_language ON privacy_notices(language);
CREATE INDEX idx_privacy_notices_effective_date ON privacy_notices(effective_date DESC);

COMMENT ON TABLE privacy_notices IS 'Privacy policy versions for GDPR transparency';

-- Privacy notice deliveries table
CREATE TABLE IF NOT EXISTS privacy_notice_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notice_id UUID NOT NULL REFERENCES privacy_notices(id),
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  language TEXT NOT NULL,
  acknowledged_at TIMESTAMPTZ,
  CONSTRAINT privacy_notice_deliveries_user_notice_unique UNIQUE (user_id, notice_id)
);

CREATE INDEX idx_privacy_notice_deliveries_user ON privacy_notice_deliveries(user_id);
CREATE INDEX idx_privacy_notice_deliveries_notice ON privacy_notice_deliveries(notice_id);

COMMENT ON TABLE privacy_notice_deliveries IS 'Record of privacy notice deliveries to users';

-- Consent records table
CREATE TABLE IF NOT EXISTS consent_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL,
  legal_basis TEXT NOT NULL CHECK (legal_basis IN ('consent', 'contract', 'legal_obligation', 'vital_interests', 'public_task', 'legitimate_interests')),
  consent_given BOOLEAN NOT NULL,
  consent_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  withdrawn_date TIMESTAMPTZ,
  version TEXT NOT NULL, -- Privacy policy version
  metadata JSONB
);

CREATE INDEX idx_consent_records_user ON consent_records(user_id);
CREATE INDEX idx_consent_records_purpose ON consent_records(user_id, purpose);
CREATE INDEX idx_consent_records_active ON consent_records(user_id, purpose, consent_given) WHERE withdrawn_date IS NULL;

COMMENT ON TABLE consent_records IS 'User consent records for GDPR compliance';

-- Data subject requests table
CREATE TABLE IF NOT EXISTS data_subject_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL CHECK (request_type IN ('access', 'rectification', 'erasure', 'restriction', 'portability', 'objection', 'automated_decision')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'rejected')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  export_url TEXT,
  verification_token TEXT NOT NULL,
  metadata JSONB
);

CREATE INDEX idx_data_subject_requests_user ON data_subject_requests(user_id);
CREATE INDEX idx_data_subject_requests_status ON data_subject_requests(status);
CREATE INDEX idx_data_subject_requests_requested_at ON data_subject_requests(requested_at DESC);

COMMENT ON TABLE data_subject_requests IS 'GDPR data subject access requests (Art. 15-22)';

-- Add deleted_at and tombstone_until columns to existing tables
-- These columns support two-stage deletion (logical -> physical)

-- Users table
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS tombstone_until TIMESTAMPTZ;

-- Posts table (if exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'posts') THEN
    ALTER TABLE posts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
    ALTER TABLE posts ADD COLUMN IF NOT EXISTS tombstone_until TIMESTAMPTZ;
  END IF;
END $$;

-- Comments table (if exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'comments') THEN
    ALTER TABLE comments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
    ALTER TABLE comments ADD COLUMN IF NOT EXISTS tombstone_until TIMESTAMPTZ;
  END IF;
END $$;

-- Content reports table (if exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'content_reports') THEN
    ALTER TABLE content_reports ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
    ALTER TABLE content_reports ADD COLUMN IF NOT EXISTS tombstone_until TIMESTAMPTZ;
  END IF;
END $$;

-- Moderation decisions table (if exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'moderation_decisions') THEN
    ALTER TABLE moderation_decisions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
    ALTER TABLE moderation_decisions ADD COLUMN IF NOT EXISTS tombstone_until TIMESTAMPTZ;
  END IF;
END $$;

-- Appeals table (if exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'appeals') THEN
    ALTER TABLE appeals ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
    ALTER TABLE appeals ADD COLUMN IF NOT EXISTS tombstone_until TIMESTAMPTZ;
  END IF;
END $$;

-- Create indexes for deleted records
CREATE INDEX IF NOT EXISTS idx_users_deleted ON auth.users(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_tombstone ON auth.users(tombstone_until) WHERE tombstone_until IS NOT NULL;

-- Row Level Security (RLS) policies

-- Legal holds: Only moderators and admins can manage
ALTER TABLE legal_holds ENABLE ROW LEVEL SECURITY;

CREATE POLICY legal_holds_moderator_read ON legal_holds
  FOR SELECT
  USING (auth.jwt()->>'mod_role' IN ('admin', 'moderator'));

CREATE POLICY legal_holds_admin_write ON legal_holds
  FOR ALL
  USING (auth.jwt()->>'mod_role' = 'admin');

-- Data deletion records: Read-only for moderators, system writes
ALTER TABLE data_deletion_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY data_deletion_records_moderator_read ON data_deletion_records
  FOR SELECT
  USING (auth.jwt()->>'mod_role' IN ('admin', 'moderator'));

-- Privacy notices: Public read, admin write
ALTER TABLE privacy_notices ENABLE ROW LEVEL SECURITY;

CREATE POLICY privacy_notices_public_read ON privacy_notices
  FOR SELECT
  USING (true);

CREATE POLICY privacy_notices_admin_write ON privacy_notices
  FOR ALL
  USING (auth.jwt()->>'mod_role' = 'admin');

-- Privacy notice deliveries: Users can read their own
ALTER TABLE privacy_notice_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY privacy_notice_deliveries_user_read ON privacy_notice_deliveries
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY privacy_notice_deliveries_system_write ON privacy_notice_deliveries
  FOR INSERT
  WITH CHECK (true);

-- Consent records: Users can read their own
ALTER TABLE consent_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY consent_records_user_read ON consent_records
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY consent_records_user_write ON consent_records
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY consent_records_user_update ON consent_records
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Data subject requests: Users can read their own
ALTER TABLE data_subject_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY data_subject_requests_user_read ON data_subject_requests
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY data_subject_requests_user_create ON data_subject_requests
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY data_subject_requests_moderator_manage ON data_subject_requests
  FOR ALL
  USING (auth.jwt()->>'mod_role' IN ('admin', 'moderator'));

-- Helper functions

-- Function to check if a record is under legal hold
CREATE OR REPLACE FUNCTION is_under_legal_hold(
  p_target_type TEXT,
  p_target_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM legal_holds
    WHERE target_type = p_target_type
      AND target_id = p_target_id
      AND released_at IS NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get retention expiry date
CREATE OR REPLACE FUNCTION get_retention_expiry_date(
  p_data_category TEXT,
  p_created_at TIMESTAMPTZ
) RETURNS TIMESTAMPTZ AS $$
DECLARE
  v_retention_days INTEGER;
BEGIN
  -- Default retention periods by category
  v_retention_days := CASE p_data_category
    WHEN 'identity' THEN 1825 -- 5 years
    WHEN 'contact' THEN 1825 -- 5 years
    WHEN 'content' THEN 1825 -- 5 years
    WHEN 'behavioral' THEN 365 -- 1 year
    WHEN 'technical' THEN 90 -- 90 days
    WHEN 'moderation' THEN 1825 -- 5 years
    WHEN 'audit' THEN 2555 -- 7 years
    ELSE 365 -- Default 1 year
  END;

  RETURN p_created_at + (v_retention_days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to cleanup expired tombstoned records
CREATE OR REPLACE FUNCTION cleanup_expired_tombstones()
RETURNS TABLE(table_name TEXT, deleted_count INTEGER) AS $$
DECLARE
  v_table TEXT;
  v_deleted INTEGER;
BEGIN
  -- List of tables with tombstone support
  FOR v_table IN 
    SELECT t.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t ON c.table_name = t.table_name
    WHERE c.column_name = 'tombstone_until'
      AND t.table_schema = 'public'
  LOOP
    EXECUTE format('
      DELETE FROM %I
      WHERE tombstone_until IS NOT NULL
        AND tombstone_until < NOW()
    ', v_table);
    
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    
    table_name := v_table;
    deleted_count := v_deleted;
    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cleanup_expired_tombstones() IS 'Cleanup physically deleted records past tombstone period';

-- Grant permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
