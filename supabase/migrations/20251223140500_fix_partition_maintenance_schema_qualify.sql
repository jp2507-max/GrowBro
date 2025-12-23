-- Migration: Fix run_monthly_partition_maintenance to use schema-qualified function calls
-- Resolves: After setting search_path = '', unqualified calls to helper functions fail
--
-- This must be applied BEFORE or included WITH the search_path fix migration

CREATE OR REPLACE FUNCTION public.run_monthly_partition_maintenance()
RETURNS JSONB AS $$
DECLARE
  v_new_partition TEXT;
  v_sealed_partitions TEXT[];
  v_partition_name TEXT;
  v_manifest_id UUID;
  v_result JSONB;
BEGIN
  -- Step 1: Create next month's partition (schema-qualified)
  v_new_partition := public.create_next_audit_partition();
  
  -- Step 2: Seal partitions from 2+ months ago (grace period)
  -- Get partitions that ended at least 2 months ago and haven't been sealed
  SELECT ARRAY_AGG(partition_name) INTO v_sealed_partitions
  FROM public.partition_manifests
  WHERE table_name = 'audit_events'
    AND partition_end_date < DATE_TRUNC('month', NOW() - INTERVAL '2 months')
    AND verification_status IN ('pending', 'valid')
    AND last_verified_at IS NULL;
  
  -- Seal each partition (schema-qualified)
  IF v_sealed_partitions IS NOT NULL THEN
    FOREACH v_partition_name IN ARRAY v_sealed_partitions LOOP
      v_manifest_id := public.seal_audit_partition(v_partition_name);
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
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

COMMENT ON FUNCTION public.run_monthly_partition_maintenance() IS 'Automated monthly maintenance: creates new partitions and seals old ones';
