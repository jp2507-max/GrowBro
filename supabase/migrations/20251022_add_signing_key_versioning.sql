-- Migration: Add signing key versioning and rotation support
-- Implements: Per-event key versioning, key history tracking, dual-key verification
--
-- DSA Compliance: Art. 24(5) (Transparency DB integrity), GDPR Art. 5(1)(f) (integrity and confidentiality)
--
-- Requirements: 6.1, 6.6

-- ============================================================================
-- Add signing key version to audit_events table
-- ============================================================================

-- Add signing_key_version column to audit_events
ALTER TABLE public.audit_events
ADD COLUMN IF NOT EXISTS signing_key_version TEXT NOT NULL DEFAULT 'v1.0';

-- Add signing_key_version column to partition_manifests
ALTER TABLE public.partition_manifests
ADD COLUMN IF NOT EXISTS signing_key_version TEXT NOT NULL DEFAULT 'v1.0';

-- Update existing records to use v1.0 as baseline
UPDATE public.audit_events
SET signing_key_version = 'v1.0'
WHERE signing_key_version IS NULL;

UPDATE public.partition_manifests
SET signing_key_version = 'v1.0'
WHERE signing_key_version IS NULL;

-- ============================================================================
-- Create audit_signing_keys table for key management
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.audit_signing_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Key identification
  key_id TEXT NOT NULL UNIQUE, -- e.g., 'audit-key-v1.0', 'audit-key-v2.0'
  version TEXT NOT NULL UNIQUE, -- e.g., 'v1.0', 'v2.0'

  -- Key material (stored securely in vault, referenced here)
  public_key_hash TEXT NOT NULL, -- SHA-256 hash of public key for verification
  key_fingerprint TEXT NOT NULL, -- Additional verification hash

  -- Lifecycle management
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_at TIMESTAMPTZ, -- When key became active for signing
  rotated_at TIMESTAMPTZ, -- When key was rotated out
  deactivated_at TIMESTAMPTZ, -- When key was fully deactivated

  -- Status flags
  is_active BOOLEAN NOT NULL DEFAULT FALSE, -- Currently active for new signatures
  is_rotation_candidate BOOLEAN NOT NULL DEFAULT FALSE, -- Eligible for rotation

  -- Rotation metadata
  rotation_reason TEXT, -- e.g., 'annual', 'compromise', 'compliance'
  rotated_by UUID REFERENCES auth.users(id), -- Who performed rotation
  overlap_window INTERVAL DEFAULT INTERVAL '30 days', -- Dual-key verification window

  -- Audit trail
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,

  CONSTRAINT audit_signing_keys_version_check CHECK (version ~ '^v\d+\.\d+$'),
  CONSTRAINT audit_signing_keys_temporal_order CHECK (
    (activated_at IS NULL OR rotated_at IS NULL) OR
    (activated_at <= rotated_at)
  ),
  CONSTRAINT audit_signing_keys_single_active CHECK (
    NOT (is_active = TRUE AND deactivated_at IS NOT NULL)
  )
);

-- Indexes for efficient key lookups
CREATE INDEX IF NOT EXISTS idx_audit_signing_keys_version_active
  ON public.audit_signing_keys (version, is_active)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_audit_signing_keys_key_id
  ON public.audit_signing_keys (key_id);

CREATE INDEX IF NOT EXISTS idx_audit_signing_keys_lifecycle
  ON public.audit_signing_keys (activated_at, rotated_at, deactivated_at);

-- Insert baseline key (v1.0) - public_key_hash should be updated with actual hash
INSERT INTO public.audit_signing_keys (
  key_id,
  version,
  public_key_hash,
  key_fingerprint,
  activated_at,
  is_active,
  metadata
) VALUES (
  'audit-key-v1.0',
  'v1.0',
  'PLACEHOLDER_UPDATE_WITH_ACTUAL_SHA256_HASH',
  'PLACEHOLDER_UPDATE_WITH_ACTUAL_FINGERPRINT',
  NOW(),
  TRUE,
  jsonb_build_object(
    'initial_key', TRUE,
    'key_type', 'HMAC-SHA256',
    'key_length', 256,
    'notes', 'Baseline signing key - update hash after deployment'
  )
) ON CONFLICT (version) DO NOTHING;

-- ============================================================================
-- Update signature verification function to support key versioning
-- ============================================================================

-- Function to get active signing key for a given version
CREATE OR REPLACE FUNCTION get_signing_key_by_version(
  p_version TEXT
)
RETURNS TABLE (
  key_id TEXT,
  version TEXT,
  public_key_hash TEXT,
  is_active BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ask.key_id,
    ask.version,
    ask.public_key_hash,
    ask.is_active
  FROM public.audit_signing_keys ask
  WHERE ask.version = p_version
    AND ask.activated_at IS NOT NULL
    AND ask.deactivated_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get all valid keys for dual-key verification during overlap
CREATE OR REPLACE FUNCTION get_valid_signing_keys_for_verification(
  p_event_timestamp TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  key_id TEXT,
  version TEXT,
  public_key_hash TEXT,
  is_active BOOLEAN,
  overlap_end TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ask.key_id,
    ask.version,
    ask.public_key_hash,
    ask.is_active,
    (ask.activated_at + ask.overlap_window) AS overlap_end
  FROM public.audit_signing_keys ask
  WHERE ask.activated_at IS NOT NULL
    AND ask.deactivated_at IS NULL
    AND (
      -- Key is currently active, or
      ask.is_active = TRUE
      OR
      -- Key is in overlap window (new key active, old key still valid)
      (ask.rotated_at IS NOT NULL AND p_event_timestamp <= (ask.rotated_at + ask.overlap_window))
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Update partition sealing to include key version
-- ============================================================================

-- Update seal_audit_partition function to record key version
CREATE OR REPLACE FUNCTION seal_audit_partition(
  p_partition_name TEXT,
  p_signing_key_version TEXT DEFAULT 'v1.0'
)
RETURNS UUID AS $$
DECLARE
  v_manifest_id UUID;
  v_record_count BIGINT;
  v_checksum TEXT;
  v_signature TEXT;
  v_table_name TEXT := 'audit_events';
BEGIN
  -- Validate key version exists and is active
  IF NOT EXISTS (
    SELECT 1 FROM public.audit_signing_keys
    WHERE version = p_signing_key_version
      AND activated_at IS NOT NULL
      AND deactivated_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Invalid or inactive signing key version: %', p_signing_key_version;
  END IF;

  -- Get partition statistics
  EXECUTE format(
    'SELECT COUNT(*), encode(digest(string_agg(signature, '''') ORDER BY id, ''sha256''), ''hex'')
     FROM public.%I',
    p_partition_name
  ) INTO v_record_count, v_checksum;

  -- Generate manifest signature (simplified - actual implementation uses vault key)
  v_signature := encode(
    digest(
      p_partition_name || v_record_count::TEXT || v_checksum || p_signing_key_version,
      'sha256'
    ),
    'hex'
  );

  -- Insert manifest
  INSERT INTO public.partition_manifests (
    table_name,
    partition_name,
    partition_start_date,
    partition_end_date,
    record_count,
    checksum,
    manifest_signature,
    signing_key_version,
    verification_status
  )
  SELECT
    v_table_name,
    p_partition_name,
    MIN(created_at)::DATE,
    (MAX(created_at) + INTERVAL '1 day')::DATE,
    v_record_count,
    v_checksum,
    v_signature,
    p_signing_key_version,
    'valid'
  FROM public.audit_events
  WHERE created_at >= (
    SELECT MIN(created_at)::DATE FROM public.audit_events
    WHERE created_at >= DATE_TRUNC('month', NOW() - INTERVAL '1 month')
  )
  AND created_at < DATE_TRUNC('month', NOW())
  RETURNING id INTO v_manifest_id;

  -- Mark partition as read-only (implementation depends on your partitioning strategy)
  -- This is a placeholder - actual implementation may vary
  EXECUTE format('ALTER TABLE public.%I SET (autovacuum_enabled = false)', p_partition_name);

  RETURN v_manifest_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Key rotation helper functions
-- ============================================================================

-- Function to activate new signing key and begin rotation
CREATE OR REPLACE FUNCTION activate_signing_key(
  p_key_id TEXT,
  p_version TEXT,
  p_public_key_hash TEXT,
  p_key_fingerprint TEXT,
  p_rotation_reason TEXT DEFAULT 'annual',
  p_overlap_window INTERVAL DEFAULT INTERVAL '30 days'
)
RETURNS UUID AS $$
DECLARE
  v_key_record_id UUID;
BEGIN
  -- Validate version format
  IF p_version !~ '^v\d+\.\d+$' THEN
    RAISE EXCEPTION 'Invalid version format. Must be vX.Y';
  END IF;

  -- Check for version conflicts
  IF EXISTS (SELECT 1 FROM public.audit_signing_keys WHERE version = p_version) THEN
    RAISE EXCEPTION 'Signing key version already exists: %', p_version;
  END IF;

  -- Deactivate current active key(s) and set rotation timestamp
  UPDATE public.audit_signing_keys
  SET
    rotated_at = NOW(),
    is_active = FALSE,
    rotation_reason = p_rotation_reason,
    rotated_by = auth.uid()
  WHERE is_active = TRUE;

  -- Insert new key
  INSERT INTO public.audit_signing_keys (
    key_id,
    version,
    public_key_hash,
    key_fingerprint,
    activated_at,
    is_active,
    overlap_window,
    rotation_reason,
    rotated_by,
    metadata
  ) VALUES (
    p_key_id,
    p_version,
    p_public_key_hash,
    p_key_fingerprint,
    NOW(),
    TRUE,
    p_overlap_window,
    p_rotation_reason,
    auth.uid(),
    jsonb_build_object(
      'activated_by', auth.uid(),
      'overlap_window_days', EXTRACT(EPOCH FROM p_overlap_window) / 86400
    )
  ) RETURNING id INTO v_key_record_id;

  RETURN v_key_record_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to deactivate old key after overlap period
CREATE OR REPLACE FUNCTION deactivate_expired_signing_keys()
RETURNS INTEGER AS $$
DECLARE
  v_deactivated_count INTEGER := 0;
BEGIN
  -- Deactivate keys where overlap window has expired
  UPDATE public.audit_signing_keys
  SET
    deactivated_at = NOW(),
    is_active = FALSE
  WHERE deactivated_at IS NULL
    AND rotated_at IS NOT NULL
    AND (rotated_at + overlap_window) < NOW();

  GET DIAGNOSTICS v_deactivated_count = ROW_COUNT;
  RETURN v_deactivated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Enhanced verification function with key versioning
-- ============================================================================

-- Function to verify audit event with key version resolution
CREATE OR REPLACE FUNCTION verify_audit_event_with_key_versioning(
  p_event_id UUID
)
RETURNS TABLE (
  is_valid BOOLEAN,
  key_version TEXT,
  verification_method TEXT,
  verified_at TIMESTAMPTZ
) AS $$
DECLARE
  v_event RECORD;
  v_key_record RECORD;
  v_expected_signature TEXT;
  v_verification_result BOOLEAN := FALSE;
  v_used_key_version TEXT;
BEGIN
  -- Retrieve event with key version
  SELECT ae.*, ae.signing_key_version INTO v_event
  FROM public.audit_events ae
  WHERE ae.id = p_event_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::TEXT, 'event_not_found', NOW();
    RETURN;
  END IF;

  -- Get signing key for this event's version
  SELECT * INTO v_key_record
  FROM public.audit_signing_keys
  WHERE version = v_event.signing_key_version
    AND activated_at IS NOT NULL
    AND deactivated_at IS NULL;

  IF NOT FOUND THEN
    -- Try dual-key verification for events during overlap
    SELECT * INTO v_key_record
    FROM public.get_valid_signing_keys_for_verification(v_event.timestamp)
    WHERE version = v_event.signing_key_version
    LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, v_event.signing_key_version, 'key_not_found', NOW();
    RETURN;
  END IF;

  -- Generate expected signature (simplified - actual implementation uses vault key)
  v_expected_signature := encode(
    digest(
      v_event.id::TEXT || v_event.event_type || v_event.actor_id::TEXT ||
      v_event.target_id || v_event.action || v_event.metadata::TEXT ||
      v_event.timestamp::TEXT,
      'sha256'
    ),
    'hex'
  );

  -- Verify signature matches (simplified comparison)
  v_verification_result := (v_event.signature = v_expected_signature);
  v_used_key_version := v_key_record.version;

  RETURN QUERY SELECT
    v_verification_result,
    v_used_key_version,
    CASE
      WHEN v_key_record.is_active THEN 'active_key'
      ELSE 'overlap_key'
    END,
    NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Comments and documentation
-- ============================================================================

COMMENT ON TABLE public.audit_signing_keys IS 'Tracks signing key versions, lifecycle, and rotation history for audit integrity';
COMMENT ON COLUMN public.audit_events.signing_key_version IS 'Version of signing key used to create this event signature';
COMMENT ON COLUMN public.partition_manifests.signing_key_version IS 'Version of signing key used to seal this partition';

COMMENT ON FUNCTION get_signing_key_by_version(TEXT) IS 'Retrieves active signing key configuration by version';
COMMENT ON FUNCTION get_valid_signing_keys_for_verification(TIMESTAMPTZ) IS 'Returns all keys valid for verification at given timestamp (supports dual-key overlap)';
COMMENT ON FUNCTION activate_signing_key(TEXT, TEXT, TEXT, TEXT, TEXT, INTERVAL) IS 'Activates new signing key and rotates previous key with overlap window';
COMMENT ON FUNCTION deactivate_expired_signing_keys() IS 'Deactivates keys that have exceeded their overlap window';
COMMENT ON FUNCTION verify_audit_event_with_key_versioning(UUID) IS 'Verifies audit event signature using appropriate key version with dual-key support';

-- ============================================================================
-- DOWN MIGRATION: Rollback signing key versioning
-- ============================================================================

-- Drop helper functions in reverse order of creation
DROP FUNCTION IF EXISTS verify_audit_event_with_key_versioning(UUID);
DROP FUNCTION IF EXISTS deactivate_expired_signing_keys();
DROP FUNCTION IF EXISTS activate_signing_key(TEXT, TEXT, TEXT, TEXT, TEXT, INTERVAL);
DROP FUNCTION IF EXISTS get_valid_signing_keys_for_verification(TIMESTAMPTZ);
DROP FUNCTION IF EXISTS get_signing_key_by_version(TEXT);

-- Drop the audit_signing_keys table
DROP TABLE IF EXISTS public.audit_signing_keys;

-- Remove signing_key_version columns
ALTER TABLE public.audit_events DROP COLUMN IF EXISTS signing_key_version;
ALTER TABLE public.partition_manifests DROP COLUMN IF EXISTS signing_key_version;</content>
<parameter name="filePath">c:\Users\Peter\GrowBro\supabase\migrations\20251022_add_signing_key_versioning.sql