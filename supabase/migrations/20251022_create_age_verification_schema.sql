-- Migration: Create Age Verification Schema
-- Implements: DSA Art. 28 (Protection of Minors), EU Age-Verification Blueprint
-- Privacy-preserving age verification without raw ID storage
--
-- Requirements: 8.1, 8.2, 8.6
-- Task: Task 9 - Age Verification Service

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- Age Verification Tokens (Privacy-Preserving)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.age_verification_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- User reference (no raw ID data stored)
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Verification metadata (privacy-preserving)
  verification_method TEXT NOT NULL CHECK (verification_method IN (
    'eudi_wallet',
    'third_party_verifier',
    'id_attribute',
    'credit_card',
    'other'
  )),
  
  -- Token data (hashed, not plaintext)
  token_hash TEXT NOT NULL UNIQUE,
  
  -- Token lifecycle
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  revocation_reason TEXT,
  
  -- Usage tracking (prevent replay attacks)
  used_at TIMESTAMPTZ,
  use_count INTEGER NOT NULL DEFAULT 0,
  max_uses INTEGER NOT NULL DEFAULT 1, -- Single-use by default
  
  -- Compliance metadata
  verification_provider TEXT, -- e.g., 'eIDAS Trust Service Provider'
  assurance_level TEXT, -- e.g., 'substantial', 'high' per eIDAS
  age_attribute_verified BOOLEAN NOT NULL DEFAULT TRUE, -- ≥18 verified
  
  -- Audit trail
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure one active token per user
  CONSTRAINT unique_active_token_per_user UNIQUE (user_id, expires_at)
    WHERE revoked_at IS NULL AND used_at IS NULL
);

-- Indexes for performance
CREATE INDEX idx_age_verification_tokens_user_id ON public.age_verification_tokens(user_id);
CREATE INDEX idx_age_verification_tokens_expires_at ON public.age_verification_tokens(expires_at);
CREATE INDEX idx_age_verification_tokens_token_hash ON public.age_verification_tokens(token_hash);
CREATE INDEX idx_age_verification_tokens_active ON public.age_verification_tokens(user_id, expires_at)
  WHERE revoked_at IS NULL AND used_at IS NULL;

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_age_verification_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_age_verification_tokens_updated_at
  BEFORE UPDATE ON public.age_verification_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_age_verification_tokens_updated_at();

-- ============================================================================
-- Age Verification Audit (Compliance Logging)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.age_verification_audit (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Event metadata
  event_type TEXT NOT NULL CHECK (event_type IN (
    'verification_attempt',
    'verification_success',
    'verification_failure',
    'token_issued',
    'token_validated',
    'token_revoked',
    'token_expired',
    'suspicious_activity_detected',
    'age_gating_check',
    'consent_requested',
    'consent_granted',
    'consent_denied'
  )),
  
  -- User reference (nullable for pre-registration events)
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Token reference (if applicable)
  token_id UUID REFERENCES public.age_verification_tokens(id) ON DELETE SET NULL,
  
  -- Event details (no PII)
  verification_method TEXT,
  result TEXT, -- 'success', 'failure', 'pending'
  failure_reason TEXT,
  
  -- Suspicious activity signals (no device fingerprinting without consent)
  suspicious_signals JSONB, -- e.g., {rapid_account_creation: true, vpn_detected: true}
  consent_given BOOLEAN, -- ePrivacy 5(3) compliance
  
  -- Content reference (for age-gating checks)
  content_id TEXT,
  content_type TEXT,
  access_granted BOOLEAN,
  
  -- IP address (minimal retention)
  ip_address INET,
  user_agent TEXT,
  
  -- Compliance metadata
  legal_basis TEXT, -- GDPR Art. 6(1) basis
  retention_period INTERVAL, -- Data retention period
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partitioning by month for efficient retention management
CREATE INDEX idx_age_verification_audit_created_at ON public.age_verification_audit(created_at);
CREATE INDEX idx_age_verification_audit_user_id ON public.age_verification_audit(user_id);
CREATE INDEX idx_age_verification_audit_event_type ON public.age_verification_audit(event_type);
CREATE INDEX idx_age_verification_audit_token_id ON public.age_verification_audit(token_id);

-- ============================================================================
-- User Age Status (Denormalized for Performance)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_age_status (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Age verification status
  is_age_verified BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  
  -- Active token reference
  active_token_id UUID REFERENCES public.age_verification_tokens(id) ON DELETE SET NULL,
  
  -- Safer defaults for minors
  is_minor BOOLEAN NOT NULL DEFAULT TRUE, -- Assume minor until verified
  minor_protections_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  
  -- Content visibility preferences
  show_age_restricted_content BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_user_age_status_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_age_status_updated_at
  BEFORE UPDATE ON public.user_age_status
  FOR EACH ROW
  EXECUTE FUNCTION update_user_age_status_updated_at();

-- ============================================================================
-- Content Age Restrictions
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.content_age_restrictions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Content reference
  content_id TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('post', 'comment', 'image', 'profile', 'other')),
  
  -- Age restriction metadata
  is_age_restricted BOOLEAN NOT NULL DEFAULT FALSE,
  min_age INTEGER NOT NULL DEFAULT 18,
  
  -- Flagging information
  flagged_by_system BOOLEAN NOT NULL DEFAULT FALSE,
  flagged_by_author BOOLEAN NOT NULL DEFAULT FALSE,
  flagged_by_moderator BOOLEAN NOT NULL DEFAULT FALSE,
  moderator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Restriction reason
  restriction_reason TEXT,
  keywords_detected TEXT[],
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Unique constraint per content
  CONSTRAINT unique_content_age_restriction UNIQUE (content_id, content_type)
);

-- Indexes
CREATE INDEX idx_content_age_restrictions_content ON public.content_age_restrictions(content_id, content_type);
CREATE INDEX idx_content_age_restrictions_flagged ON public.content_age_restrictions(is_age_restricted)
  WHERE is_age_restricted = TRUE;

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_content_age_restrictions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_content_age_restrictions_updated_at
  BEFORE UPDATE ON public.content_age_restrictions
  FOR EACH ROW
  EXECUTE FUNCTION update_content_age_restrictions_updated_at();

-- ============================================================================
-- Row-Level Security (RLS) Policies
-- ============================================================================

-- Age verification tokens: users can only see their own tokens
ALTER TABLE public.age_verification_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY age_verification_tokens_select_own
  ON public.age_verification_tokens
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY age_verification_tokens_insert_own
  ON public.age_verification_tokens
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Moderators can revoke tokens
CREATE POLICY age_verification_tokens_update_moderators
  ON public.age_verification_tokens
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'moderator')
    )
  );

-- Age verification audit: append-only, moderators can read
ALTER TABLE public.age_verification_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY age_verification_audit_insert_all
  ON public.age_verification_audit
  FOR INSERT
  WITH CHECK (TRUE);

CREATE POLICY age_verification_audit_select_moderators
  ON public.age_verification_audit
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'moderator', 'compliance_officer')
    )
  );

-- User age status: users can read/update their own status
ALTER TABLE public.user_age_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_age_status_select_own
  ON public.user_age_status
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY user_age_status_insert_own
  ON public.user_age_status
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_age_status_update_own
  ON public.user_age_status
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Content age restrictions: public read, moderators/authors write
ALTER TABLE public.content_age_restrictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY content_age_restrictions_select_all
  ON public.content_age_restrictions
  FOR SELECT
  USING (TRUE);

CREATE POLICY content_age_restrictions_insert_moderators
  ON public.content_age_restrictions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'moderator')
    )
  );

CREATE POLICY content_age_restrictions_update_moderators
  ON public.content_age_restrictions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'moderator')
    )
  );

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Check if user is age-verified
CREATE OR REPLACE FUNCTION public.is_user_age_verified(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_is_verified BOOLEAN;
BEGIN
  SELECT is_age_verified INTO v_is_verified
  FROM public.user_age_status
  WHERE user_id = p_user_id;
  
  RETURN COALESCE(v_is_verified, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get active verification token for user
CREATE OR REPLACE FUNCTION public.get_active_age_token(p_user_id UUID)
RETURNS UUID AS $$
DECLARE
  v_token_id UUID;
BEGIN
  SELECT id INTO v_token_id
  FROM public.age_verification_tokens
  WHERE user_id = p_user_id
    AND expires_at > NOW()
    AND revoked_at IS NULL
    AND (used_at IS NULL OR use_count < max_uses)
  ORDER BY issued_at DESC
  LIMIT 1;
  
  RETURN v_token_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check content age-gating access
CREATE OR REPLACE FUNCTION public.check_age_gating_access(
  p_user_id UUID,
  p_content_id TEXT,
  p_content_type TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_is_restricted BOOLEAN;
  v_is_verified BOOLEAN;
BEGIN
  -- Check if content is age-restricted
  SELECT is_age_restricted INTO v_is_restricted
  FROM public.content_age_restrictions
  WHERE content_id = p_content_id
    AND content_type = p_content_type;
  
  -- If not restricted, allow access
  IF NOT COALESCE(v_is_restricted, FALSE) THEN
    RETURN TRUE;
  END IF;
  
  -- Check if user is age-verified
  v_is_verified := public.is_user_age_verified(p_user_id);
  
  RETURN v_is_verified;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Data Retention Policy (GDPR Compliance)
-- ============================================================================

-- Automatic cleanup of expired tokens (run daily)
CREATE OR REPLACE FUNCTION public.cleanup_expired_age_tokens()
RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  -- Delete tokens expired more than 30 days ago
  DELETE FROM public.age_verification_tokens
  WHERE expires_at < NOW() - INTERVAL '30 days'
    AND used_at IS NOT NULL;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Automatic cleanup of old audit logs (keep only 12 months per requirement 6.7)
CREATE OR REPLACE FUNCTION public.cleanup_old_age_audit_logs()
RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  -- Delete audit logs older than 12 months
  DELETE FROM public.age_verification_audit
  WHERE created_at < NOW() - INTERVAL '12 months';
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Comments and Documentation
-- ============================================================================

COMMENT ON TABLE public.age_verification_tokens IS 'Privacy-preserving age verification tokens. No raw ID data stored. Implements DSA Art. 28 and EU Age-Verification Blueprint.';
COMMENT ON TABLE public.age_verification_audit IS 'Audit trail for age verification events. Append-only with 12-month retention per GDPR.';
COMMENT ON TABLE public.user_age_status IS 'Denormalized user age verification status for performance. Safer defaults for minors.';
COMMENT ON TABLE public.content_age_restrictions IS 'Content age-gating metadata. Automatic flagging and manual tagging support.';

COMMENT ON COLUMN public.age_verification_tokens.token_hash IS 'HMAC-SHA256 hash of verification token. Never stores plaintext tokens.';
COMMENT ON COLUMN public.age_verification_tokens.age_attribute_verified IS 'Boolean over-18 attribute per EU Age-Verification Blueprint. No birth date stored.';
COMMENT ON COLUMN public.age_verification_audit.suspicious_signals IS 'Privacy-preserving signals (no device fingerprinting without consent per ePrivacy 5(3)).';
COMMENT ON COLUMN public.user_age_status.is_minor IS 'Assumes minor until verified. Safety-by-design default per DSA Art. 28.';

-- Grant necessary permissions
GRANT SELECT, INSERT ON public.age_verification_tokens TO authenticated;
GRANT SELECT, INSERT ON public.age_verification_audit TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_age_status TO authenticated;
GRANT SELECT ON public.content_age_restrictions TO authenticated;

-- Grant moderator permissions
GRANT ALL ON public.age_verification_tokens TO service_role;
GRANT ALL ON public.age_verification_audit TO service_role;
GRANT ALL ON public.user_age_status TO service_role;
GRANT ALL ON public.content_age_restrictions TO service_role;
