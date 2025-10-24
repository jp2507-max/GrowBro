-- Migration: Create partition management functions and automation
-- Implements: Automated partition creation, sealing, retention enforcement
--
-- Requirements: 14.2

-- ============================================================================
-- Automated Partition Creation
-- ============================================================================

-- Function to create next month's partition for audit_events
CREATE OR REPLACE FUNCTION create_next_audit_partition()
RETURNS TEXT AS $$
DECLARE
  next_month DATE;
  partition_name TEXT;
  start_date DATE;
  end_date DATE;
BEGIN
  -- Calculate next month
  next_month := DATE_TRUNC('month', NOW() + INTERVAL '1 month')::DATE;
  partition_name := 'audit_events_' || TO_CHAR(next_month, 'YYYYMM');
  start_date := next_month;
  end_date := next_month + INTERVAL '1 month';
  
  -- Create partition if it doesn't exist
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.audit_events
     FOR VALUES FROM (%L) TO (%L)',
    partition_name,
    start_date,
    end_date
  );
  
  RETURN partition_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Partition Sealing and Manifest Generation
-- ============================================================================

-- Function to seal a partition and generate its manifest
-- Should be run at the end of each month for the previous month's partition
CREATE OR REPLACE FUNCTION seal_audit_partition(
  p_partition_name TEXT
)
RETURNS UUID AS $$
DECLARE
  v_manifest_id UUID;
  v_record_count BIGINT;
  v_checksum TEXT;
  v_manifest_signature TEXT;
  v_start_date DATE;
  v_end_date DATE;
  v_signing_key TEXT;
  v_payload TEXT;
BEGIN
  -- Extract partition dates from partition name (e.g., audit_events_202410)
  v_start_date := TO_DATE(SUBSTRING(p_partition_name FROM '\d{6}'), 'YYYYMM');
  v_end_date := v_start_date + INTERVAL '1 month';
  
  -- Generate partition checksum
  SELECT * INTO v_record_count, v_checksum
  FROM generate_partition_checksum(p_partition_name);
  
  -- Retrieve signing key
  v_signing_key := current_setting('app.audit_signing_key', true);
  IF v_signing_key IS NULL OR v_signing_key = '' THEN
    v_signing_key := 'default-signing-key-replace-in-production';
  END IF;
  
  -- Generate manifest signature
  v_payload := 'audit_events|' || p_partition_name || '|' || 
               v_start_date::TEXT || '|' || v_end_date::TEXT || '|' ||
               v_record_count::TEXT || '|' || v_checksum;
               
  v_manifest_signature := encode(
    hmac(v_payload::bytea, v_signing_key::bytea, 'sha256'),
    'hex'
  );
  
  -- Insert or update manifest
  INSERT INTO public.partition_manifests (
    table_name,
    partition_name,
    partition_start_date,
    partition_end_date,
    record_count,
    checksum,
    manifest_signature,
    verification_status
  ) VALUES (
    'audit_events',
    p_partition_name,
    v_start_date,
    v_end_date,
    v_record_count,
    v_checksum,
    v_manifest_signature,
    'valid'
  )
  ON CONFLICT (partition_name) DO UPDATE SET
    record_count = EXCLUDED.record_count,
    checksum = EXCLUDED.checksum,
    manifest_signature = EXCLUDED.manifest_signature,
    verification_status = 'valid',
    updated_at = NOW()
  RETURNING id INTO v_manifest_id;
  
  RETURN v_manifest_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Data Retention Enforcement
-- ============================================================================

-- Function to identify partitions eligible for deletion based on retention policy
-- Default: 7 years for audit_events
CREATE OR REPLACE FUNCTION get_expired_partitions(
  p_table_name TEXT DEFAULT 'audit_events',
  p_retention_years INTEGER DEFAULT 7
)
RETURNS TABLE(
  partition_name TEXT,
  partition_start_date DATE,
  partition_end_date DATE,
  age_in_days INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pm.partition_name,
    pm.partition_start_date,
    pm.partition_end_date,
    (CURRENT_DATE - pm.partition_end_date)::INTEGER AS age_in_days
  FROM public.partition_manifests pm
  WHERE pm.table_name = p_table_name
    AND pm.partition_end_date < (CURRENT_DATE - (p_retention_years || ' years')::INTERVAL)
  ORDER BY pm.partition_start_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to drop expired partitions (with safety checks)
-- NOTE: This is a destructive operation and should only be run after verification
CREATE OR REPLACE FUNCTION drop_expired_partition(
  p_partition_name TEXT,
  p_dry_run BOOLEAN DEFAULT TRUE
)
RETURNS JSONB AS $$
DECLARE
  v_manifest RECORD;
  v_result JSONB;
BEGIN
  -- Retrieve manifest
  SELECT * INTO v_manifest
  FROM public.partition_manifests
  WHERE partition_name = p_partition_name;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Partition manifest not found',
      'partition_name', p_partition_name
    );
  END IF;
  
  -- Safety check: ensure partition is old enough (at least 7 years)
  IF v_manifest.partition_end_date >= (CURRENT_DATE - INTERVAL '7 years') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Partition not old enough for deletion (minimum 7 years)',
      'partition_name', p_partition_name,
      'partition_end_date', v_manifest.partition_end_date,
      'minimum_end_date', (CURRENT_DATE - INTERVAL '7 years')::DATE
    );
  END IF;
  
  IF p_dry_run THEN
    -- Dry run: return what would be dropped
    RETURN jsonb_build_object(
      'success', true,
      'dry_run', true,
      'partition_name', p_partition_name,
      'table_name', v_manifest.table_name,
      'record_count', v_manifest.record_count,
      'partition_start_date', v_manifest.partition_start_date,
      'partition_end_date', v_manifest.partition_end_date,
      'action', 'Would drop partition (dry run)'
    );
  ELSE
    -- Actually drop the partition
    BEGIN
      EXECUTE format('DROP TABLE IF EXISTS public.%I', p_partition_name);
      
      -- Mark manifest as deleted
      UPDATE public.partition_manifests
      SET verification_status = 'deleted',
          updated_at = NOW()
      WHERE partition_name = p_partition_name;
      
      RETURN jsonb_build_object(
        'success', true,
        'dry_run', false,
        'partition_name', p_partition_name,
        'record_count', v_manifest.record_count,
        'action', 'Partition dropped successfully'
      );
    EXCEPTION WHEN OTHERS THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'partition_name', p_partition_name
      );
    END;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Retention Policy Auto-Calculator
-- ============================================================================

-- Function to calculate retention_until based on event type and GDPR requirements
CREATE OR REPLACE FUNCTION calculate_retention_date(
  p_event_type TEXT,
  p_timestamp TIMESTAMPTZ
)
RETURNS TIMESTAMPTZ AS $$
BEGIN
  -- Default retention: 5 years from event timestamp for most moderation events
  -- Audit events and integrity proofs: 7 years
  -- Adjust based on event type
  CASE 
    WHEN p_event_type IN ('audit_integrity_check', 'partition_sealed', 'signature_verified') THEN
      RETURN p_timestamp + INTERVAL '7 years';
    WHEN p_event_type IN ('report_submitted', 'decision_made', 'appeal_filed', 'sor_submitted') THEN
      RETURN p_timestamp + INTERVAL '5 years';
    WHEN p_event_type IN ('legal_hold_applied', 'court_order_received') THEN
      RETURN p_timestamp + INTERVAL '10 years'; -- Extended for legal matters
    ELSE
      RETURN p_timestamp + INTERVAL '5 years'; -- Default
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger to auto-set retention_until on audit_events INSERT
CREATE OR REPLACE FUNCTION set_audit_retention()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.retention_until IS NULL THEN
    NEW.retention_until := calculate_retention_date(NEW.event_type, NEW.timestamp);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_audit_retention
  BEFORE INSERT ON public.audit_events
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_retention();

-- ============================================================================
-- Partition Maintenance Scheduler (via pg_cron or manual execution)
-- ============================================================================

-- Function to perform monthly partition maintenance
-- Should be run on the 1st day of each month
CREATE OR REPLACE FUNCTION run_monthly_partition_maintenance()
RETURNS JSONB AS $$
DECLARE
  v_new_partition TEXT;
  v_sealed_partitions TEXT[];
  v_partition_name TEXT;
  v_manifest_id UUID;
  v_result JSONB;
BEGIN
  -- Step 1: Create next month's partition
  v_new_partition := create_next_audit_partition();
  
  -- Step 2: Seal partitions from 2+ months ago (grace period)
  -- Get partitions that ended at least 2 months ago and haven't been sealed
  SELECT ARRAY_AGG(partition_name) INTO v_sealed_partitions
  FROM public.partition_manifests
  WHERE table_name = 'audit_events'
    AND partition_end_date < DATE_TRUNC('month', NOW() - INTERVAL '2 months')
    AND verification_status IN ('pending', 'valid')
    AND last_verified_at IS NULL;
  
  -- Seal each partition
  IF v_sealed_partitions IS NOT NULL THEN
    FOREACH v_partition_name IN ARRAY v_sealed_partitions LOOP
      v_manifest_id := seal_audit_partition(v_partition_name);
    END LOOP;
  END IF;
  
  -- Return summary
  v_result := jsonb_build_object(
    'success', true,
    'timestamp', NOW(),
    'new_partition_created', v_new_partition,
    'partitions_sealed', COALESCE(array_length(v_sealed_partitions, 1), 0),
    'sealed_partition_names', COALESCE(v_sealed_partitions, ARRAY[]::TEXT[])
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON FUNCTION create_next_audit_partition() IS 'Creates partition for next month to ensure audit events are always accepted';
COMMENT ON FUNCTION seal_audit_partition(TEXT) IS 'Seals partition and generates cryptographic manifest for tamper detection';
COMMENT ON FUNCTION get_expired_partitions(TEXT, INTEGER) IS 'Identifies partitions eligible for deletion based on retention policy';
COMMENT ON FUNCTION drop_expired_partition(TEXT, BOOLEAN) IS 'Safely drops expired partitions after retention period (default 7 years)';
COMMENT ON FUNCTION calculate_retention_date(TEXT, TIMESTAMPTZ) IS 'Calculates GDPR-compliant retention date based on event type';
COMMENT ON FUNCTION run_monthly_partition_maintenance() IS 'Automated monthly maintenance: creates new partitions and seals old ones';
