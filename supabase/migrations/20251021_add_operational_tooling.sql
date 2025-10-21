-- Add operational tooling for DSA compliance monitoring
-- Includes signature verification, partition integrity checks, and compliance reporting

BEGIN;

-- ============================================================================
-- Signature Verification Procedures
-- ============================================================================

-- Function to verify audit event signatures in bulk
CREATE OR REPLACE FUNCTION verify_audit_event_signatures(
  p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '24 hours',
  p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE(
  event_id UUID,
  event_type TEXT,
  created_at TIMESTAMPTZ,
  signature_valid BOOLEAN,
  expected_signature TEXT,
  actual_signature TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ae.id,
    ae.event_type,
    ae.created_at,
    -- Recalculate signature and compare
    (generate_audit_signature(
      ae.event_type,
      ae.actor_id,
      ae.target_type,
      ae.target_id,
      ae.action,
      ae.metadata,
      ae.timestamp
    ) = ae.signature) as signature_valid,
    generate_audit_signature(
      ae.event_type,
      ae.actor_id,
      ae.target_type,
      ae.target_id,
      ae.action,
      ae.metadata,
      ae.timestamp
    ) as expected_signature,
    ae.signature as actual_signature
  FROM public.audit_events ae
  WHERE ae.created_at >= p_start_date
    AND ae.created_at <= p_end_date
  ORDER BY ae.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Partition Integrity Checks
-- ============================================================================

-- Function to verify all partition manifests
CREATE OR REPLACE FUNCTION verify_all_partition_manifests()
RETURNS TABLE(
  table_name TEXT,
  partition_name TEXT,
  partition_start_date DATE,
  partition_end_date DATE,
  record_count BIGINT,
  checksum TEXT,
  manifest_signature TEXT,
  verification_status TEXT,
  integrity_valid BOOLEAN,
  last_verified_at TIMESTAMPTZ
) AS $$
DECLARE
  manifest_record RECORD;
  expected_signature TEXT;
  expected_checksum TEXT;
  expected_count BIGINT;
BEGIN
  FOR manifest_record IN
    SELECT * FROM public.partition_manifests
    ORDER BY partition_end_date DESC
  LOOP
    -- Recalculate expected values
    SELECT * INTO expected_count, expected_checksum
    FROM generate_partition_checksum(manifest_record.partition_name);

    -- Recalculate signature
    expected_signature := generate_partition_signature(
      manifest_record.partition_name,
      manifest_record.partition_start_date,
      manifest_record.partition_end_date,
      expected_count,
      expected_checksum
    );

    RETURN QUERY SELECT
      manifest_record.table_name,
      manifest_record.partition_name,
      manifest_record.partition_start_date,
      manifest_record.partition_end_date,
      manifest_record.record_count,
      manifest_record.checksum,
      manifest_record.manifest_signature,
      manifest_record.verification_status,
      (manifest_record.record_count = expected_count
       AND manifest_record.checksum = expected_checksum
       AND manifest_record.manifest_signature = expected_signature) as integrity_valid,
      manifest_record.last_verified_at;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check for unsealed partitions (security risk)
CREATE OR REPLACE FUNCTION find_unsealed_partitions()
RETURNS TABLE(
  table_name TEXT,
  partition_name TEXT,
  partition_start_date DATE,
  partition_end_date DATE,
  age_days INTEGER,
  record_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pm.table_name,
    pm.partition_name,
    pm.partition_start_date,
    pm.partition_end_date,
    EXTRACT(EPOCH FROM (NOW() - pm.partition_end_date)) / 86400 :: INTEGER as age_days,
    pm.record_count
  FROM public.partition_manifests pm
  WHERE pm.verification_status IN ('pending', 'valid')
    AND pm.last_verified_at IS NULL
    AND pm.partition_end_date < NOW() - INTERVAL '2 months'
  ORDER BY pm.partition_end_date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Compliance Reporting Functions
-- ============================================================================

-- Generate DSA compliance report
CREATE OR REPLACE FUNCTION generate_dsa_compliance_report(
  p_report_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB AS $$
DECLARE
  report JSONB;
  audit_stats JSONB;
  sor_stats JSONB;
  partition_stats JSONB;
  signature_verification JSONB;
BEGIN
  -- Audit event statistics
  SELECT jsonb_build_object(
    'total_events', COUNT(*),
    'events_last_24h', COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours'),
    'events_last_7d', COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days'),
    'events_last_30d', COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days'),
    'oldest_event', MIN(created_at),
    'newest_event', MAX(created_at),
    'partitions_count', COUNT(DISTINCT DATE_TRUNC('month', created_at))
  ) INTO audit_stats
  FROM public.audit_events;

  -- SoR statistics
  SELECT jsonb_build_object(
    'total_sors', COUNT(*),
    'pending_submissions', COUNT(*) FILTER (WHERE transparency_db_id IS NULL),
    'submitted_sors', COUNT(*) FILTER (WHERE transparency_db_id IS NOT NULL),
    'submissions_last_30d', COUNT(*) FILTER (WHERE transparency_db_submitted_at >= NOW() - INTERVAL '30 days'),
    'oldest_sor', MIN(created_at),
    'newest_sor', MAX(created_at)
  ) INTO sor_stats
  FROM public.statements_of_reasons;

  -- Partition integrity statistics
  SELECT jsonb_build_object(
    'total_partitions', COUNT(*),
    'verified_partitions', COUNT(*) FILTER (WHERE verification_status = 'valid'),
    'pending_partitions', COUNT(*) FILTER (WHERE verification_status = 'pending'),
    'failed_partitions', COUNT(*) FILTER (WHERE verification_status = 'failed'),
    'unsealed_partitions', COUNT(*) FILTER (WHERE last_verified_at IS NULL AND partition_end_date < NOW() - INTERVAL '2 months')
  ) INTO partition_stats
  FROM public.partition_manifests;

  -- Signature verification summary (last 24h)
  SELECT jsonb_build_object(
    'total_verified', COUNT(*),
    'valid_signatures', COUNT(*) FILTER (WHERE signature_valid = true),
    'invalid_signatures', COUNT(*) FILTER (WHERE signature_valid = false),
    'verification_rate', ROUND(
      COUNT(*) FILTER (WHERE signature_valid = true)::DECIMAL /
      NULLIF(COUNT(*), 0) * 100, 2
    )
  ) INTO signature_verification
  FROM verify_audit_event_signatures(NOW() - INTERVAL '24 hours', NOW());

  -- Build final report
  report := jsonb_build_object(
    'report_date', p_report_date,
    'generated_at', NOW(),
    'audit_events', audit_stats,
    'statements_of_reasons', sor_stats,
    'partition_integrity', partition_stats,
    'signature_verification_24h', signature_verification,
    'compliance_status', CASE
      WHEN (signature_verification->>'verification_rate')::DECIMAL >= 99.9
           AND (partition_stats->>'unsealed_partitions')::INTEGER = 0
      THEN 'COMPLIANT'
      ELSE 'REVIEW_REQUIRED'
    END
  );

  RETURN report;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Automated Maintenance Procedures
-- ============================================================================

-- Function to run daily integrity checks
CREATE OR REPLACE FUNCTION run_daily_integrity_checks()
RETURNS JSONB AS $$
DECLARE
  results JSONB := '{}';
  invalid_signatures INTEGER;
  unsealed_partitions INTEGER;
BEGIN
  -- Check for invalid signatures in last 24h
  SELECT COUNT(*) INTO invalid_signatures
  FROM verify_audit_event_signatures(NOW() - INTERVAL '24 hours', NOW())
  WHERE signature_valid = false;

  -- Check for unsealed partitions
  SELECT COUNT(*) INTO unsealed_partitions
  FROM find_unsealed_partitions();

  results := results || jsonb_build_object(
    'check_time', NOW(),
    'invalid_signatures_24h', invalid_signatures,
    'unsealed_partitions', unsealed_partitions,
    'status', CASE
      WHEN invalid_signatures = 0 AND unsealed_partitions = 0 THEN 'HEALTHY'
      WHEN invalid_signatures > 0 THEN 'SIGNATURE_VIOLATION'
      WHEN unsealed_partitions > 0 THEN 'PARTITION_SECURITY_RISK'
      ELSE 'WARNING'
    END
  );

  -- Log the results (you might want to insert into a monitoring table)
  RAISE NOTICE 'Daily integrity check completed: %', results;

  RETURN results;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Comments and Documentation
-- ============================================================================

COMMENT ON FUNCTION verify_audit_event_signatures(TIMESTAMPTZ, TIMESTAMPTZ) IS 'DSA Art. 24(6) compliance: Verifies cryptographic signatures on audit events within date range';
COMMENT ON FUNCTION verify_all_partition_manifests() IS 'DSA Art. 24(6) compliance: Verifies integrity of all audit partitions using checksums and signatures';
COMMENT ON FUNCTION find_unsealed_partitions() IS 'Security monitoring: Identifies partitions that should be sealed but are not';
COMMENT ON FUNCTION generate_dsa_compliance_report(DATE) IS 'DSA compliance reporting: Generates comprehensive compliance status report';
COMMENT ON FUNCTION run_daily_integrity_checks() IS 'Automated maintenance: Runs daily integrity checks for monitoring and alerting';

COMMIT;
