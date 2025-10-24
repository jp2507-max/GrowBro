-- Migration: Create audit database WORM enforcement triggers
-- Implements: Append-only audit logging with cryptographic signatures,
-- per-row digital signatures, tamper prevention
--
-- DSA Compliance: Art. 24(5) (Transparency DB integrity), GDPR Art. 5(1)(f) (integrity and confidentiality)
--
-- Requirements: 6.1, 6.6

-- ============================================================================
-- Audit Events Table (WORM-enforced, partitioned by month)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.audit_events (
  id UUID NOT NULL DEFAULT uuid_generate_v4(),
  
  -- Event classification
  event_type TEXT NOT NULL, -- e.g., 'report_submitted', 'decision_made', 'appeal_filed'
  
  -- Actor and target
  actor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'moderator', 'system')),
  target_id TEXT NOT NULL, -- UUID or identifier of affected entity
  target_type TEXT NOT NULL, -- e.g., 'content_report', 'moderation_decision', 'appeal'
  
  -- Action details
  action TEXT NOT NULL, -- e.g., 'create', 'update', 'delete', 'approve', 'reject'
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  
  -- Timestamp (immutable)
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Cryptographic signature (HMAC-SHA256 of event data)
  signature TEXT NOT NULL,
  
  -- GDPR data minimization and retention
  pii_tagged BOOLEAN NOT NULL DEFAULT FALSE, -- TRUE if metadata contains PII requiring redaction
  retention_until TIMESTAMPTZ NOT NULL, -- Auto-calculated based on retention policy
  
  -- Immutability enforcement
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- No updated_at or deleted_at - these records are append-only
  
  CONSTRAINT audit_events_timestamp_check CHECK (timestamp <= NOW()),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create initial partitions for current and next 6 months
-- Partition naming: audit_events_YYYYMM
DO $$
DECLARE
  partition_date DATE;
  partition_name TEXT;
  start_date DATE;
  end_date DATE;
BEGIN
  FOR i IN 0..6 LOOP
    partition_date := DATE_TRUNC('month', NOW() + (i || ' months')::INTERVAL)::DATE;
    partition_name := 'audit_events_' || TO_CHAR(partition_date, 'YYYYMM');
    start_date := partition_date;
    end_date := partition_date + INTERVAL '1 month';
    
    -- Create partition if it doesn't exist
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.audit_events
       FOR VALUES FROM (%L) TO (%L)',
      partition_name,
      start_date,
      end_date
    );
  END LOOP;
END $$;

-- Indexes on partitioned table
CREATE INDEX IF NOT EXISTS idx_audit_events_event_type 
  ON public.audit_events (event_type, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_audit_events_actor 
  ON public.audit_events (actor_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_audit_events_target 
  ON public.audit_events (target_type, target_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_audit_events_retention 
  ON public.audit_events (retention_until) WHERE retention_until IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_events_pii_tagged 
  ON public.audit_events (pii_tagged, created_at DESC) WHERE pii_tagged = TRUE;

-- ============================================================================
-- WORM Enforcement: Prevent UPDATE and DELETE on audit_events
-- ============================================================================

CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
  -- Prevent any UPDATE or DELETE operations on audit_events
  RAISE EXCEPTION 'Audit events are immutable and cannot be modified or deleted. Event ID: %, Event Type: %', 
    OLD.id, OLD.event_type
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$ LANGUAGE plpgsql;

-- Apply WORM trigger for UPDATE operations
CREATE TRIGGER trigger_prevent_audit_update
  BEFORE UPDATE ON public.audit_events
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_modification();

-- Apply WORM trigger for DELETE operations
CREATE TRIGGER trigger_prevent_audit_delete
  BEFORE DELETE ON public.audit_events
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_modification();

-- ============================================================================
-- Per-Row Digital Signature (HMAC-SHA256)
-- ============================================================================

-- Function to generate cryptographic signature for audit event
-- Uses HMAC-SHA256 with environment-specific signing key
CREATE OR REPLACE FUNCTION generate_audit_signature(
  p_event_type TEXT,
  p_actor_id UUID,
  p_target_id TEXT,
  p_action TEXT,
  p_metadata JSONB,
  p_timestamp TIMESTAMPTZ
)
RETURNS TEXT AS $$
DECLARE
  signing_key TEXT;
  payload TEXT;
BEGIN
  -- Retrieve signing key from environment (configured via Supabase secrets/vault)
  -- In production, this should be stored in a secure vault, not hardcoded
  -- For now, use a placeholder that will be replaced in deployment
  signing_key := current_setting('app.audit_signing_key', true);
  
  -- Fallback to a default key if not configured (development only)
  IF signing_key IS NULL OR signing_key = '' THEN
    signing_key := 'default-signing-key-replace-in-production';
  END IF;
  
  -- Construct deterministic payload for signing
  -- Format: event_type|actor_id|target_id|action|metadata_json|timestamp_iso
  payload := p_event_type || '|' || 
             p_actor_id::TEXT || '|' || 
             p_target_id || '|' || 
             p_action || '|' || 
             p_metadata::TEXT || '|' || 
             p_timestamp::TEXT;
  
  -- Generate HMAC-SHA256 signature
  RETURN encode(
    hmac(payload::bytea, signing_key::bytea, 'sha256'),
    'hex'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-generate signature on INSERT
CREATE OR REPLACE FUNCTION set_audit_signature()
RETURNS TRIGGER AS $$
BEGIN
  -- Generate signature if not provided
  IF NEW.signature IS NULL OR NEW.signature = '' THEN
    NEW.signature := generate_audit_signature(
      NEW.event_type,
      NEW.actor_id,
      NEW.target_id,
      NEW.action,
      NEW.metadata,
      NEW.timestamp
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_audit_signature
  BEFORE INSERT ON public.audit_events
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_signature();

-- ============================================================================
-- Partition Manifest Tracking (Monthly Checksums)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.partition_manifests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Partition identification
  table_name TEXT NOT NULL,
  partition_name TEXT NOT NULL UNIQUE,
  partition_start_date DATE NOT NULL,
  partition_end_date DATE NOT NULL,
  
  -- Checksum and signature
  record_count BIGINT NOT NULL DEFAULT 0,
  checksum TEXT NOT NULL, -- SHA-256 hash of all signature values in partition
  manifest_signature TEXT NOT NULL, -- HMAC-SHA256 of manifest data
  
  -- Verification status
  last_verified_at TIMESTAMPTZ,
  verification_status TEXT CHECK (verification_status IN ('valid', 'tampered', 'pending')),
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_partition_manifests_table_partition 
  ON public.partition_manifests (table_name, partition_name);

CREATE INDEX IF NOT EXISTS idx_partition_manifests_verification 
  ON public.partition_manifests (verification_status, last_verified_at) 
  WHERE verification_status = 'pending';

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_partition_manifests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_partition_manifests_updated_at
  BEFORE UPDATE ON public.partition_manifests
  FOR EACH ROW
  EXECUTE FUNCTION update_partition_manifests_updated_at();

-- ============================================================================
-- Signature Verification Function
-- ============================================================================

-- Function to verify audit event signature integrity
CREATE OR REPLACE FUNCTION verify_audit_signature(
  p_event_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_event RECORD;
  v_expected_signature TEXT;
BEGIN
  -- Retrieve event
  SELECT * INTO v_event
  FROM public.audit_events
  WHERE id = p_event_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Audit event not found: %', p_event_id;
  END IF;
  
  -- Regenerate signature
  v_expected_signature := generate_audit_signature(
    v_event.event_type,
    v_event.actor_id,
    v_event.target_id,
    v_event.action,
    v_event.metadata,
    v_event.timestamp
  );
  
  -- Compare signatures
  RETURN v_event.signature = v_expected_signature;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Partition Checksum Generation Function
-- ============================================================================

-- Function to generate checksum for a partition
-- Should be run after partition is sealed (end of month)
CREATE OR REPLACE FUNCTION generate_partition_checksum(
  p_partition_name TEXT
)
RETURNS TABLE(
  record_count BIGINT,
  checksum TEXT
) AS $$
DECLARE
  v_count BIGINT;
  v_checksum TEXT;
  v_signing_key TEXT;
BEGIN
  -- Count records in partition
  EXECUTE format('SELECT COUNT(*) FROM public.%I', p_partition_name)
  INTO v_count;
  
  -- Generate aggregate checksum from all signatures (deterministic)
  EXECUTE format(
    'SELECT encode(digest(string_agg(signature, '''''' ORDER BY id), ''sha256''), ''hex'')
     FROM public.%I',
    p_partition_name
  ) INTO v_checksum;
  
  -- Return results
  record_count := v_count;
  checksum := v_checksum;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE public.audit_events IS 'Immutable audit log with WORM enforcement, cryptographic signatures, and monthly partitioning';
COMMENT ON TABLE public.partition_manifests IS 'Per-partition checksums and signatures for tamper detection';
COMMENT ON FUNCTION prevent_audit_modification() IS 'WORM trigger: prevents UPDATE/DELETE on audit_events to ensure immutability';
COMMENT ON FUNCTION generate_audit_signature(TEXT, UUID, TEXT, TEXT, JSONB, TIMESTAMPTZ) IS 'Generates HMAC-SHA256 signature for audit event integrity verification';
COMMENT ON FUNCTION verify_audit_signature(UUID) IS 'Verifies cryptographic signature of an audit event to detect tampering';
COMMENT ON FUNCTION generate_partition_checksum(TEXT) IS 'Generates aggregate checksum for a sealed partition to detect tampering';
