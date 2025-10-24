-- =====================================================================
-- Geo-Location Schema Migration
-- =====================================================================
-- Creates tables and indexes for privacy-first geographic content filtering
-- Implements DSA compliance for regional content restrictions
-- Part of Task 10: Geo-Location Service (Requirements 9.1-9.7)

-- =====================================================================
-- Table: user_roles
-- Simple user role management for RLS policies
-- =====================================================================
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'moderator', 'supervisor', 'user')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, role)
);

-- Index for role lookups
CREATE INDEX IF NOT EXISTS idx_user_roles_user_role 
  ON user_roles(user_id, role);

-- =====================================================================
-- Table: geo_restrictions
-- Stores content-specific geographic restrictions with lawful basis
-- =====================================================================
CREATE TABLE IF NOT EXISTS geo_restrictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('post', 'comment', 'user_content')),
  restricted_regions TEXT[] NOT NULL DEFAULT '{}', -- ISO 3166-1 alpha-2 codes (e.g., ['DE', 'FR'])
  permitted_regions TEXT[] NOT NULL DEFAULT '{}', -- Empty = globally available in non-restricted regions
  lawful_basis TEXT NOT NULL, -- Legal reference or policy citation
  reason_code TEXT NOT NULL, -- Category: illegal_content, policy_violation, legal_request
  include_in_sor BOOLEAN NOT NULL DEFAULT false, -- Include in Statement of Reasons
  applied_by UUID REFERENCES auth.users(id), -- Moderator or system that applied restriction
  expires_at TIMESTAMPTZ, -- Optional expiry for time-limited restrictions
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient content availability checks
CREATE INDEX IF NOT EXISTS idx_geo_restrictions_content_id 
  ON geo_restrictions(content_id);

CREATE INDEX IF NOT EXISTS idx_geo_restrictions_expires_at 
  ON geo_restrictions(expires_at) 
  WHERE expires_at IS NOT NULL;

-- Index for active restrictions query
CREATE INDEX IF NOT EXISTS idx_geo_restrictions_active 
  ON geo_restrictions(content_id, expires_at);

-- =====================================================================
-- Table: geo_location_cache
-- Caches user location data with configurable TTL (default 1h)
-- =====================================================================
CREATE TABLE IF NOT EXISTS geo_location_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  location_method TEXT NOT NULL CHECK (location_method IN ('ip', 'gps', 'device_region')),
  location_data JSONB NOT NULL, -- { country: 'DE', region: 'Bavaria', city: 'Munich', coords?: {...} }
  vpn_detected BOOLEAN NOT NULL DEFAULT false,
  confidence_score NUMERIC(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  expires_at TIMESTAMPTZ NOT NULL,
  cached_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint: one active cache entry per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_geo_location_cache_user_active 
  ON geo_location_cache(user_id);

-- Index for cache expiry cleanup
CREATE INDEX IF NOT EXISTS idx_geo_location_cache_expires_at 
  ON geo_location_cache(expires_at);

-- =====================================================================
-- Table: geo_restriction_rules
-- Defines region-specific content filtering rules with versioning
-- =====================================================================
CREATE TABLE IF NOT EXISTS geo_restriction_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_code TEXT NOT NULL, -- ISO 3166-1 alpha-2 (e.g., 'DE', 'FR') or 'EU' for EU-wide
  rule_type TEXT NOT NULL, -- e.g., 'cannabis_content', 'age_restricted', 'legal_restriction'
  rule_config JSONB NOT NULL, -- Flexible configuration: { action: 'block' | 'age_gate', min_age?: 18 }
  lawful_basis TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 100, -- Higher priority = applied first
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Index for active rule lookups by region
CREATE INDEX IF NOT EXISTS idx_geo_restriction_rules_region_active 
  ON geo_restriction_rules(region_code, effective_from, expires_at);

-- Index for rule priority ordering
CREATE INDEX IF NOT EXISTS idx_geo_restriction_rules_priority 
  ON geo_restriction_rules(priority DESC);

-- =====================================================================
-- Table: geo_restriction_appeals
-- Tracks appeals for false positive geo-restrictions
-- =====================================================================
CREATE TABLE IF NOT EXISTS geo_restriction_appeals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restriction_id UUID NOT NULL REFERENCES geo_restrictions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  appeal_reason TEXT NOT NULL,
  supporting_evidence JSONB, -- { location_proof: 'passport_scan', travel_documents: [...] }
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'upheld', 'rejected')),
  reviewer_id UUID REFERENCES auth.users(id),
  review_notes TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for appeal status tracking
CREATE INDEX IF NOT EXISTS idx_geo_restriction_appeals_status 
  ON geo_restriction_appeals(status, created_at);

-- Index for user appeal history
CREATE INDEX IF NOT EXISTS idx_geo_restriction_appeals_user 
  ON geo_restriction_appeals(user_id, created_at DESC);

-- =====================================================================
-- Table: geo_restriction_notifications
-- Audit trail for author notifications about regional restrictions
-- =====================================================================
CREATE TABLE IF NOT EXISTS geo_restriction_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restriction_id UUID NOT NULL REFERENCES geo_restrictions(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES auth.users(id),
  notification_type TEXT NOT NULL CHECK (notification_type IN ('author_alert', 'user_explainer')),
  delivery_method TEXT NOT NULL CHECK (delivery_method IN ('push', 'email', 'in_app')),
  delivery_status TEXT NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'failed')),
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for notification delivery tracking
CREATE INDEX IF NOT EXISTS idx_geo_restriction_notifications_status 
  ON geo_restriction_notifications(delivery_status, created_at);

-- =====================================================================
-- RLS Policies
-- =====================================================================

-- geo_restrictions: moderators can insert/update, users can read own content restrictions
ALTER TABLE geo_restrictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Moderators can manage geo restrictions"
  ON geo_restrictions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('moderator', 'admin', 'supervisor')
    )
  );

CREATE POLICY "Users can view restrictions on their own content"
  ON geo_restrictions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM posts
      WHERE posts.id = geo_restrictions.content_id
      AND posts.user_id = auth.uid()
    )
  );

-- geo_location_cache: users can only read/update their own cache
ALTER TABLE geo_location_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own location cache"
  ON geo_location_cache
  FOR ALL
  USING (user_id = auth.uid());

-- geo_restriction_rules: admins can manage, all authenticated users can read
ALTER TABLE geo_restriction_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage geo restriction rules"
  ON geo_restriction_rules
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "Authenticated users can read geo restriction rules"
  ON geo_restriction_rules
  FOR SELECT
  TO authenticated
  USING (true);

-- geo_restriction_appeals: users can manage their own appeals, moderators can review
ALTER TABLE geo_restriction_appeals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own appeals"
  ON geo_restriction_appeals
  FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Moderators can review appeals"
  ON geo_restriction_appeals
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('moderator', 'admin', 'supervisor')
    )
  );

-- geo_restriction_notifications: users can read their own notifications
ALTER TABLE geo_restriction_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own geo restriction notifications"
  ON geo_restriction_notifications
  FOR SELECT
  USING (recipient_id = auth.uid());

CREATE POLICY "System can insert notifications"
  ON geo_restriction_notifications
  FOR INSERT
  WITH CHECK (true);

-- =====================================================================
-- Triggers
-- =====================================================================

-- Update updated_at timestamp on geo_restrictions
CREATE OR REPLACE FUNCTION update_geo_restrictions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_geo_restrictions_updated_at
  BEFORE UPDATE ON geo_restrictions
  FOR EACH ROW
  EXECUTE FUNCTION update_geo_restrictions_updated_at();

-- Update updated_at timestamp on geo_restriction_rules
CREATE OR REPLACE FUNCTION update_geo_restriction_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_geo_restriction_rules_updated_at
  BEFORE UPDATE ON geo_restriction_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_geo_restriction_rules_updated_at();

-- Update updated_at timestamp on geo_restriction_appeals
CREATE OR REPLACE FUNCTION update_geo_restriction_appeals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_geo_restriction_appeals_updated_at
  BEFORE UPDATE ON geo_restriction_appeals
  FOR EACH ROW
  EXECUTE FUNCTION update_geo_restriction_appeals_updated_at();

-- =====================================================================
-- Cleanup Functions
-- =====================================================================

-- Function to clean up expired cache entries (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_geo_location_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM geo_location_cache
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to check content availability based on user location
-- Returns: { available: boolean, reason?: text, affected_regions?: text[] }
CREATE OR REPLACE FUNCTION check_content_geo_availability(
  p_content_id UUID,
  p_user_location JSONB
)
RETURNS JSONB AS $$
DECLARE
  v_user_country TEXT;
  v_restriction RECORD;
  v_result JSONB;
BEGIN
  -- Extract country from user location
  v_user_country := p_user_location->>'country';
  
  IF v_user_country IS NULL THEN
    RETURN jsonb_build_object('available', true);
  END IF;
  
  -- Check for active restrictions
  SELECT * INTO v_restriction
  FROM geo_restrictions
  WHERE content_id = p_content_id
    AND (expires_at IS NULL OR expires_at > NOW())
    AND v_user_country = ANY(restricted_regions)
  LIMIT 1;
  
  IF FOUND THEN
    v_result := jsonb_build_object(
      'available', false,
      'reason', v_restriction.reason_code,
      'lawful_basis', v_restriction.lawful_basis,
      'affected_regions', v_restriction.restricted_regions
    );
  ELSE
    v_result := jsonb_build_object('available', true);
  END IF;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- Seed Data (Example Rules)
-- =====================================================================

-- Example: Cannabis content restrictions in France
INSERT INTO geo_restriction_rules (region_code, rule_type, rule_config, lawful_basis, priority)
VALUES (
  'FR',
  'cannabis_content',
  '{"action": "block", "reason": "Cannabis cultivation illegal in France"}',
  'French Public Health Code Article L3421-1',
  200
)
ON CONFLICT DO NOTHING;

-- Example: EU-wide age-gating for sensitive content
INSERT INTO geo_restriction_rules (region_code, rule_type, rule_config, lawful_basis, priority)
VALUES (
  'EU',
  'age_restricted',
  '{"action": "age_gate", "min_age": 18}',
  'DSA Article 28 - Protection of Minors',
  150
)
ON CONFLICT DO NOTHING;

-- =====================================================================
-- Indexes for Performance
-- =====================================================================

-- Composite index for fast content availability checks
CREATE INDEX IF NOT EXISTS idx_geo_restrictions_content_active_regions
  ON geo_restrictions(content_id, restricted_regions);

-- Index for notification delivery tracking
CREATE INDEX IF NOT EXISTS idx_geo_restriction_notifications_recipient
  ON geo_restriction_notifications(recipient_id, created_at DESC);

-- =====================================================================
-- Comments
-- =====================================================================

COMMENT ON TABLE geo_restrictions IS 'Stores content-specific geographic restrictions with DSA compliance';
COMMENT ON TABLE geo_location_cache IS 'Caches user location data with 1-hour TTL (configurable)';
COMMENT ON TABLE geo_restriction_rules IS 'Defines region-specific content filtering rules with versioning';
COMMENT ON TABLE geo_restriction_appeals IS 'Tracks appeals for false positive geo-restrictions';
COMMENT ON TABLE geo_restriction_notifications IS 'Audit trail for author notifications about regional restrictions';

COMMENT ON FUNCTION check_content_geo_availability IS 'Checks if content is available in user location based on active restrictions';
COMMENT ON FUNCTION cleanup_expired_geo_location_cache IS 'Removes expired location cache entries (run via cron)';
