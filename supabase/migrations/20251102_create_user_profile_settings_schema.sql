-- Migration: User Profile & Settings Shell
-- Description: Creates tables for user profiles, notification preferences, legal acceptances,
--              account deletion requests, bug reports, feedback, and audit logs.
-- Requirements: 1.7, 2.1, 3.1, 4.1, 5.1, 6.1, 7.1, 8.1, 9.1, 10.1, 11.1, 12.6

-- ======================================================================================
-- TABLES
-- ======================================================================================

-- User profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL CHECK (char_length(display_name) >= 3 AND char_length(display_name) <= 30),
  bio TEXT CHECK (char_length(bio) <= 500),
  avatar_url TEXT,
  location TEXT CHECK (char_length(location) <= 100),
  show_profile_to_community BOOLEAN NOT NULL DEFAULT true,
  allow_direct_messages BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT profiles_user_id_unique UNIQUE(user_id)
);

-- Add index for efficient user lookups
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_profiles_updated_at();

-- Notification preferences table
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_reminders BOOLEAN NOT NULL DEFAULT true,
  task_reminder_timing TEXT NOT NULL DEFAULT 'hour_before' CHECK (task_reminder_timing IN ('hour_before', 'day_before', 'custom')),
  custom_reminder_minutes INTEGER CHECK (custom_reminder_minutes IS NULL OR (custom_reminder_minutes >= 1 AND custom_reminder_minutes <= 1440)),
  harvest_alerts BOOLEAN NOT NULL DEFAULT true,
  community_activity BOOLEAN NOT NULL DEFAULT true,
  system_updates BOOLEAN NOT NULL DEFAULT true,
  marketing BOOLEAN NOT NULL DEFAULT false,
  quiet_hours_enabled BOOLEAN NOT NULL DEFAULT false,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  device_id TEXT NOT NULL,
  CONSTRAINT notification_preferences_user_device_unique UNIQUE(user_id, device_id),
  CONSTRAINT notification_preferences_custom_timing_check CHECK (
    (task_reminder_timing != 'custom' AND custom_reminder_minutes IS NULL) OR
    (task_reminder_timing = 'custom' AND custom_reminder_minutes IS NOT NULL)
  ),
  CONSTRAINT notification_preferences_quiet_hours_check CHECK (
    (quiet_hours_enabled = false AND quiet_hours_start IS NULL AND quiet_hours_end IS NULL) OR
    (quiet_hours_enabled = true AND quiet_hours_start IS NOT NULL AND quiet_hours_end IS NOT NULL)
  )
);

-- Add indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON notification_preferences(user_id);
-- Ensure columns exist for older schemas: add missing columns if table pre-exists with fewer columns
ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS marketing BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS quiet_hours_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS quiet_hours_start TIME,
  ADD COLUMN IF NOT EXISTS quiet_hours_end TIME,
  ADD COLUMN IF NOT EXISTS last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS device_id TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'notification_preferences'::regclass AND attname = 'last_updated'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'idx_notification_preferences_last_updated'
  ) THEN
    EXECUTE 'CREATE INDEX idx_notification_preferences_last_updated ON notification_preferences(last_updated)';
  END IF;
END;
$$;

-- Add trigger to update last_updated timestamp
CREATE OR REPLACE FUNCTION update_notification_preferences_last_updated()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notification_preferences_last_updated
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_preferences_last_updated();

-- Legal acceptances table
CREATE TABLE IF NOT EXISTS legal_acceptances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('terms', 'privacy', 'cannabis')),
  version TEXT NOT NULL CHECK (version ~ '^\d+\.\d+\.\d+$'), -- Semantic versioning format
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  app_version TEXT NOT NULL,
  locale TEXT NOT NULL,
  ip_address INET, -- Only stored with explicit consent
  CONSTRAINT legal_acceptances_user_doc_version_unique UNIQUE(user_id, document_type, version)
);

-- Add indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_legal_acceptances_user_id ON legal_acceptances(user_id);
CREATE INDEX IF NOT EXISTS idx_legal_acceptances_document_type ON legal_acceptances(document_type);
CREATE INDEX IF NOT EXISTS idx_legal_acceptances_accepted_at ON legal_acceptances(accepted_at);

-- Account deletion requests table
CREATE TABLE IF NOT EXISTS account_deletion_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'cancelled', 'completed')) DEFAULT 'pending',
  reason TEXT,
  policy_version TEXT NOT NULL,
  completed_at TIMESTAMPTZ,
  CONSTRAINT account_deletion_requests_scheduled_for_check CHECK (scheduled_for > requested_at),
  CONSTRAINT account_deletion_requests_completed_at_check CHECK (
    (status = 'completed' AND completed_at IS NOT NULL) OR
    (status != 'completed' AND completed_at IS NULL)
  )
);

-- Add indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_account_deletion_requests_user_id ON account_deletion_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_account_deletion_requests_status ON account_deletion_requests(status);
CREATE INDEX IF NOT EXISTS idx_account_deletion_requests_scheduled_for ON account_deletion_requests(scheduled_for);

-- Add constraint to prevent duplicate pending requests per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_account_deletion_requests_pending_user 
  ON account_deletion_requests(user_id) 
  WHERE status = 'pending';

-- Bug reports table
CREATE TABLE IF NOT EXISTS bug_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL CHECK (char_length(title) >= 3 AND char_length(title) <= 200),
  description TEXT NOT NULL CHECK (char_length(description) >= 10 AND char_length(description) <= 5000),
  category TEXT NOT NULL CHECK (category IN ('crash', 'ui', 'sync', 'performance', 'other')),
  screenshot_url TEXT,
  diagnostics JSONB NOT NULL,
  sentry_event_id TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_bug_reports_user_id ON bug_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_bug_reports_status ON bug_reports(status);
CREATE INDEX IF NOT EXISTS idx_bug_reports_created_at ON bug_reports(created_at);
CREATE INDEX IF NOT EXISTS idx_bug_reports_category ON bug_reports(category);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_bug_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_bug_reports_updated_at
  BEFORE UPDATE ON bug_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_bug_reports_updated_at();

-- Feedback table
CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  category TEXT NOT NULL CHECK (category IN ('feature_request', 'improvement', 'compliment', 'other')),
  message TEXT NOT NULL CHECK (char_length(message) >= 10 AND char_length(message) <= 1000),
  email TEXT CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at);
CREATE INDEX IF NOT EXISTS idx_feedback_category ON feedback(category);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (char_length(event_type) > 0),
  payload JSONB,
  policy_version TEXT,
  app_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- ======================================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ======================================================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_acceptances ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_deletion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE bug_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Profiles RLS policies
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view public profiles"
  ON profiles FOR SELECT
  USING (show_profile_to_community = true);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own profile"
  ON profiles FOR DELETE
  USING (auth.uid() = user_id);

-- Notification preferences RLS policies
CREATE POLICY "Users can view their own notification preferences"
  ON notification_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notification preferences"
  ON notification_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notification preferences"
  ON notification_preferences FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notification preferences"
  ON notification_preferences FOR DELETE
  USING (auth.uid() = user_id);

-- Legal acceptances RLS policies
CREATE POLICY "Users can view their own legal acceptances"
  ON legal_acceptances FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own legal acceptances"
  ON legal_acceptances FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Note: Legal acceptances should not be updated or deleted for audit trail

-- Account deletion requests RLS policies
CREATE POLICY "Users can view their own deletion requests"
  ON account_deletion_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own deletion requests"
  ON account_deletion_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own deletion requests"
  ON account_deletion_requests FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Bug reports RLS policies
CREATE POLICY "Users can view their own bug reports"
  ON bug_reports FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own bug reports"
  ON bug_reports FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Note: Bug reports cannot be updated or deleted by users

-- Feedback RLS policies
CREATE POLICY "Users can view their own feedback"
  ON feedback FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own feedback"
  ON feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Note: Feedback cannot be updated or deleted by users

-- Audit logs RLS policies
CREATE POLICY "Users can view their own audit logs"
  ON audit_logs FOR SELECT
  USING (auth.uid() = user_id);

-- Note: Audit logs can only be inserted via backend functions

-- ======================================================================================
-- STORAGE BUCKET FOR AVATARS
-- ======================================================================================

-- Create avatars bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for avatars bucket
CREATE POLICY "Users can view their own avatars"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can upload their own avatars"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text AND
    -- Limit file size to 5MB
    OCTET_LENGTH(metadata->>'size') <= 5242880
  );

CREATE POLICY "Users can update their own avatars"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete their own avatars"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- ======================================================================================
-- HELPER FUNCTIONS
-- ======================================================================================

-- Function to get or create user profile
CREATE OR REPLACE FUNCTION get_or_create_profile(p_user_id UUID, p_display_name TEXT)
RETURNS profiles AS $$
DECLARE
  v_profile profiles;
BEGIN
  -- Try to get existing profile
  SELECT * INTO v_profile FROM profiles WHERE user_id = p_user_id;
  
  -- If not found, create one
  IF v_profile IS NULL THEN
    INSERT INTO profiles (user_id, display_name)
    VALUES (p_user_id, p_display_name)
    RETURNING * INTO v_profile;
  END IF;
  
  RETURN v_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check for pending deletion request
CREATE OR REPLACE FUNCTION has_pending_deletion_request(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM account_deletion_requests
    WHERE user_id = p_user_id AND status = 'pending'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cancel pending deletion request
CREATE OR REPLACE FUNCTION cancel_deletion_request(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_updated_rows INTEGER;
BEGIN
  UPDATE account_deletion_requests
  SET status = 'cancelled'
  WHERE user_id = p_user_id AND status = 'pending'
  RETURNING 1 INTO v_updated_rows;
  
  RETURN v_updated_rows > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ======================================================================================
-- COMMENTS FOR DOCUMENTATION
-- ======================================================================================

COMMENT ON TABLE profiles IS 'User profile information including display name, bio, avatar, and visibility settings';
COMMENT ON TABLE notification_preferences IS 'User notification preferences with per-device settings and multi-device sync support';
COMMENT ON TABLE legal_acceptances IS 'Audit trail of user acceptances of legal documents (terms, privacy policy, cannabis policy)';
COMMENT ON TABLE account_deletion_requests IS 'Requests for account deletion with 30-day grace period for GDPR compliance';
COMMENT ON TABLE bug_reports IS 'User-submitted bug reports with diagnostics and optional screenshot';
COMMENT ON TABLE feedback IS 'User feedback including feature requests, improvements, and compliments';
COMMENT ON TABLE audit_logs IS 'Audit trail for compliance-related events (consent changes, data exports, deletions)';

COMMENT ON COLUMN profiles.show_profile_to_community IS 'Whether profile is visible to other users in the community';
COMMENT ON COLUMN profiles.allow_direct_messages IS 'Whether user accepts direct messages from other users';
COMMENT ON COLUMN notification_preferences.marketing IS 'Marketing notifications - defaults to OFF and requires explicit opt-in';
COMMENT ON COLUMN notification_preferences.quiet_hours_enabled IS 'Whether to suppress non-critical notifications during quiet hours';
COMMENT ON COLUMN notification_preferences.device_id IS 'Device identifier for multi-device conflict resolution';
COMMENT ON COLUMN legal_acceptances.ip_address IS 'IP address at time of acceptance - only stored with explicit consent';
COMMENT ON COLUMN account_deletion_requests.scheduled_for IS 'Date/time when deletion will be executed (typically 30 days from request)';
COMMENT ON COLUMN bug_reports.diagnostics IS 'JSON object containing device info, app version, and other debugging data';
COMMENT ON COLUMN audit_logs.payload IS 'JSON object containing event-specific data';
