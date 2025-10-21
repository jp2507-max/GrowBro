<!-- markdownlint-disable MD041 -->

# Moderation Audit Operations Guide

## Overview

This document provides operational procedures for managing the DSA-compliant audit system, including rehydration, verification, and compliance auditing workflows.

**Scope**: WORM-enforced audit trail, partition management, signature verification, retention enforcement, immutable snapshot management

**Requirements**: 6.6, 14.2

**Owner**: Moderation Platform Team (Lead: TBD)

**Reviewers**: Data Protection Officer (DPO), Legal/Counsel

---

## Table of Contents

1. [Audit System Architecture](#audit-system-architecture)
2. [Partition Management](#partition-management)
3. [Signature Verification](#signature-verification)
4. [Data Retention & Purging](#data-retention--purging)
5. [Backup & Restore](#backup--restore)
6. [Compliance Reporting](#compliance-reporting)
7. [Incident Response](#incident-response)
8. [Operational Runbooks](#operational-runbooks)

---

## Audit System Architecture

### Components

- **Primary Database**: PostgreSQL via Supabase with RLS, partitioned audit_events table
- **Audit Database**: Separate append-only WORM storage (same Postgres instance, separate schema recommended for production)
- **Partition Manifests**: Cryptographically signed checksums per partition
- **Signing Key**: HMAC-SHA256 key stored in Supabase secrets/vault (`app.audit_signing_key`)
- **Offsite Backups**: Immutable object storage (S3-compatible) with versioning enabled

### WORM Enforcement

- **Trigger**: `trigger_prevent_audit_update` and `trigger_prevent_audit_delete` raise exceptions on modification attempts
- **Per-Row Signatures**: `trigger_set_audit_signature` generates HMAC-SHA256 on INSERT
- **Partition Manifests**: Monthly sealed partitions with aggregate checksums

### Partitioning Strategy

- **Tables**: `audit_events` partitioned by `created_at` (monthly RANGE partitions)
- **Naming**: `audit_events_YYYYMM` (e.g., `audit_events_202410`)
- **Retention**: 7 years for audit events, 5 years for moderation records
- **Auto-Creation**: New partitions created 1 month in advance via `create_next_audit_partition()`

---

## Partition Management

### Monthly Maintenance

**When**: Run on the 1st day of each month (automated via pg_cron or manual)

**Command**:

```sql
SELECT run_monthly_partition_maintenance();
```

**What it does**:

1. Creates next month's partition (e.g., if today is 2024-11-01, creates `audit_events_202412`)
2. Seals partitions from 2+ months ago (grace period to allow late writes)
3. Generates partition manifests with checksums and signatures

**Expected output**:

```json
{
  "success": true,
  "timestamp": "2024-11-01T00:00:00Z",
  "new_partition_created": "audit_events_202412",
  "partitions_sealed": 1,
  "sealed_partition_names": ["audit_events_202409"]
}
```

### Manual Partition Creation

**When**: If automated maintenance fails or partition is needed urgently

**Command**:

```sql
SELECT create_next_audit_partition();
```

### Manual Partition Sealing

**When**: End of month or before partition verification

**Command**:

```sql
SELECT seal_audit_partition('audit_events_202410');
```

**Verification**:

```sql
SELECT * FROM partition_manifests
WHERE partition_name = 'audit_events_202410';
```

---

## Signature Verification

### Verify Single Audit Event

**When**: Investigating tampering, compliance audit, legal hold

**Command**:

```sql
SELECT verify_audit_signature('550e8400-e29b-41d4-a716-446655440000');
```

**Expected output**: `TRUE` (valid) or `FALSE` (tampered)

### Bulk Partition Verification

**When**: Monthly compliance checks, post-restore validation

**SQL Script**:

```sql
-- Verify all events in a partition
WITH verification_results AS (
  SELECT
    id,
    event_type,
    timestamp,
    verify_audit_signature(id) AS is_valid
  FROM public.audit_events_202410
)
SELECT
  COUNT(*) AS total_events,
  SUM(CASE WHEN is_valid THEN 1 ELSE 0 END) AS valid_signatures,
  SUM(CASE WHEN NOT is_valid THEN 1 ELSE 0 END) AS invalid_signatures,
  (SUM(CASE WHEN NOT is_valid THEN 1 ELSE 0 END)::DECIMAL / COUNT(*)) * 100 AS failure_rate_percent
FROM verification_results;
```

**Acceptance Criteria**:

- `invalid_signatures` = 0
- `failure_rate_percent` = 0.0

**If failures detected**:

1. Identify affected events: `SELECT id, event_type FROM verification_results WHERE NOT is_valid`
2. Cross-reference with partition manifest checksum
3. Escalate to security team and DPO
4. Document in incident log

### Partition Manifest Verification

**When**: After sealing, before backup, during compliance audit

**Command**:

```sql
-- Regenerate checksum and compare to stored manifest
WITH regenerated AS (
  SELECT * FROM generate_partition_checksum('audit_events_202410')
)
SELECT
  pm.partition_name,
  pm.record_count AS stored_count,
  r.record_count AS regenerated_count,
  pm.checksum AS stored_checksum,
  r.checksum AS regenerated_checksum,
  pm.checksum = r.checksum AS checksums_match
FROM partition_manifests pm
CROSS JOIN regenerated r
WHERE pm.partition_name = 'audit_events_202410';
```

**Acceptance Criteria**:

- `stored_count` = `regenerated_count`
- `checksums_match` = TRUE

---

## Data Retention & Purging

### Identify Expired Partitions

**Command**:

```sql
SELECT * FROM get_expired_partitions('audit_events', 7);
```

**Output columns**: `partition_name`, `partition_start_date`, `partition_end_date`, `age_in_days`

### Dry-Run Partition Deletion

**When**: Before actual deletion to preview impact

**Command**:

```sql
SELECT drop_expired_partition('audit_events_201710', true);
```

**Expected output**:

```json
{
  "success": true,
  "dry_run": true,
  "partition_name": "audit_events_201710",
  "table_name": "audit_events",
  "record_count": 125000,
  "partition_start_date": "2017-10-01",
  "partition_end_date": "2017-11-01",
  "action": "Would drop partition (dry run)"
}
```

### Execute Partition Deletion

**Prerequisites**:

1. Partition is ≥7 years old (enforced by function)
2. DPO approval documented
3. Backup verified (see [Backup & Restore](#backup--restore))
4. Legal hold check completed

**Command**:

```sql
SELECT drop_expired_partition('audit_events_201710', false);
```

**Post-deletion verification**:

```sql
-- Confirm partition is dropped
SELECT tablename FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'audit_events_201710';
-- Should return no rows

-- Confirm manifest updated
SELECT verification_status FROM partition_manifests
WHERE partition_name = 'audit_events_201710';
-- Should return 'deleted'
```

### Legal Hold Override

**When**: Court order, investigation, GDPR data subject request

**Process**:

1. Document legal basis (case ID, court order, etc.)
2. Update partition manifest with legal hold flag (manual)
3. Skip partition in retention queries
4. Review legal hold status quarterly

**SQL (manual flag)**:

```sql
-- Add legal_hold column if not exists
ALTER TABLE partition_manifests ADD COLUMN IF NOT EXISTS legal_hold BOOLEAN DEFAULT FALSE;

-- Apply legal hold
UPDATE partition_manifests
SET legal_hold = TRUE,
    verification_status = 'legal_hold'
WHERE partition_name = 'audit_events_202001';
```

---

## Backup & Restore

### Automated Offsite Backup

**Frequency**: Daily incremental, weekly full

**Destination**: S3-compatible immutable object storage (e.g., AWS S3 with Object Lock)

**Configuration**:

- Bucket: `growbro-audit-backups-{env}` (with versioning enabled)
- Retention: 7 years minimum
- Immutability: Object Lock enabled (COMPLIANCE mode)
- Encryption: AES-256 server-side encryption

**Backup command** (via pg_dump or WAL archiving):

```bash
# Full partition backup
pg_dump -h supabase-host -U postgres -d growbro \
  --table=public.audit_events_202410 \
  --format=custom \
  --file=/backup/audit_events_202410.dump

# Upload to S3 with checksum
aws s3 cp /backup/audit_events_202410.dump \
  s3://growbro-audit-backups-prod/audit_events_202410.dump \
  --metadata "checksum=$(sha256sum /backup/audit_events_202410.dump | awk '{print $1}')"
```

**Manifest backup**:

```sql
COPY (SELECT * FROM partition_manifests WHERE partition_name = 'audit_events_202410')
TO '/backup/manifest_202410.csv' WITH CSV HEADER;
```

### Restore Procedure

**When**: Data corruption, disaster recovery, migration

**Prerequisites**:

1. Backup verification (checksum match)
2. Target partition does not exist (or will be dropped)
3. WORM triggers temporarily disabled (requires superuser)

**Steps**:

```bash
# 1. Download backup from S3
aws s3 cp s3://growbro-audit-backups-prod/audit_events_202410.dump \
  /restore/audit_events_202410.dump

# 2. Verify checksum
echo "expected_checksum  /restore/audit_events_202410.dump" | sha256sum -c

# 3. Disable WORM triggers (temporary)
psql -h supabase-host -U postgres -d growbro <<EOF
ALTER TABLE public.audit_events DISABLE TRIGGER trigger_prevent_audit_update;
ALTER TABLE public.audit_events DISABLE TRIGGER trigger_prevent_audit_delete;
EOF

# 4. Restore partition
pg_restore -h supabase-host -U postgres -d growbro \
  --table=audit_events_202410 \
  --clean --if-exists \
  /restore/audit_events_202410.dump

# 5. Re-enable WORM triggers
psql -h supabase-host -U postgres -d growbro <<EOF
ALTER TABLE public.audit_events ENABLE TRIGGER trigger_prevent_audit_update;
ALTER TABLE public.audit_events ENABLE TRIGGER trigger_prevent_audit_delete;
EOF

# 6. Verify signatures
psql -h supabase-host -U postgres -d growbro -c \
  "SELECT COUNT(*), SUM(CASE WHEN verify_audit_signature(id) THEN 1 ELSE 0 END) AS valid
   FROM public.audit_events_202410;"
```

**Post-restore validation**:

1. Signature verification (100% valid)
2. Partition manifest checksum match
3. Record count match
4. Restore event logged to audit trail

---

## Compliance Reporting

### DSA Transparency Report (Annual)

**Data sources**: `audit_events`, `content_reports`, `moderation_decisions`, `appeals`, `statements_of_reasons`

**Query Example**:

```sql
-- Annual DSA metrics report
WITH reporting_period AS (
  SELECT
    DATE_TRUNC('year', NOW() - INTERVAL '1 year') AS start_date,
    DATE_TRUNC('year', NOW()) AS end_date
)
SELECT
  -- Notices received (Art. 16)
  (SELECT COUNT(*) FROM content_reports WHERE created_at >= (SELECT start_date FROM reporting_period)) AS total_notices,
  (SELECT COUNT(*) FROM content_reports WHERE report_type = 'illegal' AND created_at >= (SELECT start_date FROM reporting_period)) AS illegal_content_notices,

  -- Actions taken (Art. 17)
  (SELECT COUNT(*) FROM moderation_decisions WHERE status = 'executed' AND created_at >= (SELECT start_date FROM reporting_period)) AS actions_taken,

  -- Internal complaints (Art. 20)
  (SELECT COUNT(*) FROM appeals WHERE created_at >= (SELECT start_date FROM reporting_period)) AS internal_complaints,
  (SELECT COUNT(*) FROM appeals WHERE decision = 'upheld' AND created_at >= (SELECT start_date FROM reporting_period)) AS complaints_upheld,

  -- ODS cases (Art. 21)
  (SELECT COUNT(*) FROM appeals WHERE ods_submitted_at IS NOT NULL AND ods_submitted_at >= (SELECT start_date FROM reporting_period)) AS ods_cases,

  -- SoR submissions (Art. 24(5))
  (SELECT COUNT(*) FROM statements_of_reasons WHERE transparency_db_submitted_at IS NOT NULL AND transparency_db_submitted_at >= (SELECT start_date FROM reporting_period)) AS sor_submissions;
```

### GDPR Data Subject Access Request (DSAR)

**When**: User exercises Art. 15 right of access

**Process**:

1. Verify user identity
2. Query all audit events for user_id
3. Redact PII from third parties
4. Export to structured format (JSON/CSV)

**Query**:

```sql
-- Export all audit events for user (redacted)
SELECT
  id,
  event_type,
  timestamp,
  action,
  CASE
    WHEN pii_tagged THEN '[REDACTED]'::JSONB
    ELSE metadata
  END AS metadata
FROM audit_events
WHERE actor_id = '550e8400-e29b-41d4-a716-446655440000'
OR target_id = '550e8400-e29b-41d4-a716-446655440000'
ORDER BY timestamp DESC;
```

---

## Incident Response

### Detected Tampering

**Indicators**:

- Signature verification failures
- Partition manifest checksum mismatch
- Unexpected partition drop

**Response**:

1. **Immediate**: Isolate affected partition (prevent further writes)
2. **Investigate**: Compare backup checksums, review access logs
3. **Escalate**: Notify DPO, security team, legal counsel
4. **Document**: Create incident report in audit trail
5. **Restore**: From last known-good backup
6. **Review**: Access controls, signing key rotation

**Incident Log Entry**:

```sql
INSERT INTO audit_events (event_type, actor_type, actor_id, target_type, target_id, action, metadata)
VALUES (
  'audit_integrity_check',
  'system',
  '00000000-0000-0000-0000-000000000000', -- System actor
  'partition',
  'audit_events_202410',
  'tampering_detected',
  jsonb_build_object(
    'invalid_signatures', 5,
    'total_events', 125000,
    'detected_at', NOW(),
    'incident_id', 'INC-2024-001'
  )
);
```

### Signing Key Rotation

**When**: Annual rotation, suspected compromise, compliance requirement

**Overview**: Signing keys are rotated to maintain cryptographic security and comply with key management best practices. The system supports per-event key versioning, key history tracking, and dual-key verification during rotation overlap periods.

**Key Components**:

- `audit_signing_keys` table: Tracks key lifecycle, versions, and metadata
- `signing_key_version` column: Added to `audit_events` and `partition_manifests`
- Dual-key verification: Both old and new keys trusted during overlap window
- Automated key deactivation after overlap expires

**Process**:

1. **Preparation (Pre-rotation)**:
   - Generate new 256-bit HMAC-SHA256 key
   - Store new key securely in Supabase vault
   - Record public key hash and fingerprint in `audit_signing_keys`

2. **Activation (Rotation execution)**:
   - Call `activate_signing_key()` to activate new key and rotate previous
   - Update application configuration to use new key version (e.g., 'v2.0')
   - Seal current active partitions with old key version

3. **Overlap Period (30 days default)**:
   - Both old and new keys remain valid for verification
   - New events signed with new key
   - Old events verifiable with either key

4. **Cleanup (Post-overlap)**:
   - Run `deactivate_expired_signing_keys()` to deactivate old keys
   - Update partition manifests with correct key versions

**Dual-Key Verification During Overlap**:

During the overlap window, events can be verified using either the old or new key. The verification algorithm:

1. Extract `signing_key_version` from audit event
2. Query `get_valid_signing_keys_for_verification(event_timestamp)`
3. Try verification with each valid key until success
4. Record which key version was used for verification

**SQL Examples**:

```sql
-- Activate new signing key (v2.0) with 30-day overlap
SELECT activate_signing_key(
  'audit-key-v2.0',
  'v2.0',
  'sha256_hash_of_new_public_key',
  'fingerprint_of_new_key',
  'annual_rotation',
  INTERVAL '30 days'
);

-- Seal partition with specific key version
SELECT seal_audit_partition('audit_events_202410', 'v1.0');

-- Verify event with key versioning support
SELECT * FROM verify_audit_event_with_key_versioning('event-uuid-here');

-- Deactivate expired keys after overlap
SELECT deactivate_expired_signing_keys();
```

**Rollback Steps** (if new key compromised or issues detected):

1. **Immediate rollback**: Mark new key inactive, re-enable previous key
2. **Data cleanup**: No data loss - old key still valid for existing signatures
3. **Verification**: Confirm all events still verifiable with rolled-back key

```sql
-- Rollback: Deactivate new key, reactivate previous
UPDATE audit_signing_keys
SET is_active = FALSE, deactivated_at = NOW()
WHERE version = 'v2.0' AND is_active = TRUE;

UPDATE audit_signing_keys
SET is_active = TRUE, rotated_at = NULL, deactivated_at = NULL
WHERE version = 'v1.0';
```

**Sample Verification Algorithm**:

```sql
-- Function: verify_event_signature(event_id, event_data, signature, key_version)
-- Returns: (is_valid, used_key_version, verification_method)

CREATE OR REPLACE FUNCTION verify_event_signature(
  p_event_id UUID,
  p_event_data JSONB,
  p_signature TEXT,
  p_key_version TEXT
)
RETURNS TABLE (is_valid BOOLEAN, used_key_version TEXT, method TEXT) AS $$
DECLARE
  v_valid_keys RECORD;
  v_expected_sig TEXT;
  v_key_hash TEXT;
BEGIN
  -- Get all valid keys for this event's timestamp
  FOR v_valid_keys IN
    SELECT * FROM get_valid_signing_keys_for_verification(
      (p_event_data->>'timestamp')::TIMESTAMPTZ
    )
  LOOP
    -- Generate expected signature with this key
    v_expected_sig := generate_hmac_signature(p_event_data, v_valid_keys.key_id);

    IF v_expected_sig = p_signature THEN
      RETURN QUERY SELECT
        TRUE,
        v_valid_keys.version,
        CASE WHEN v_valid_keys.is_active THEN 'active' ELSE 'overlap' END;
      RETURN;
    END IF;
  END LOOP;

  -- No valid key found
  RETURN QUERY SELECT FALSE, NULL::TEXT, 'no_valid_key';
END;
$$ LANGUAGE plpgsql;
```

**Migration Updates Required**:

The following database changes are implemented in migration `20251022_add_signing_key_versioning.sql`:

- Add `signing_key_version` column to `audit_events` and `partition_manifests`
- Create `audit_signing_keys` table with key lifecycle tracking
- Update `seal_audit_partition()` to accept key version parameter
- Add helper functions: `activate_signing_key()`, `deactivate_expired_signing_keys()`
- Enhanced verification with `verify_audit_event_with_key_versioning()`

---

## Operational Runbooks

### Runbook 1: Monthly Partition Maintenance

**Frequency**: Monthly (1st of each month)

**Duration**: ~5 minutes

**Prerequisites**: Database access, pg_cron enabled (or manual execution)

**Steps**:

1. Execute: `SELECT run_monthly_partition_maintenance();`
2. Verify output: `success = true`
3. Check partition count: `SELECT COUNT(*) FROM pg_tables WHERE tablename LIKE 'audit_events_%';`
4. Review manifest: `SELECT * FROM partition_manifests ORDER BY partition_start_date DESC LIMIT 3;`
5. Log completion in operations log

**Rollback**: None (idempotent operation)

### Runbook 2: Annual Retention Purge

**Frequency**: Annually (or as needed based on storage constraints)

**Duration**: ~30 minutes per partition

**Prerequisites**: DPO approval, legal hold check, backup verification

**Steps**:

1. Identify expired partitions: `SELECT * FROM get_expired_partitions('audit_events', 7);`
2. For each partition:
   a. Dry-run: `SELECT drop_expired_partition('partition_name', true);`
   b. Verify backup exists and is valid (checksum match)
   c. Execute: `SELECT drop_expired_partition('partition_name', false);`
   d. Document in operations log
3. Update capacity planning metrics

**Rollback**: Restore from backup (see [Backup & Restore](#backup--restore))

### Runbook 3: Signature Verification Audit

**Frequency**: Quarterly compliance check

**Duration**: ~15 minutes per partition

**Prerequisites**: Read-only database access

**Steps**:

1. Select partition for audit (e.g., previous quarter)
2. Run bulk verification script (see [Signature Verification](#signature-verification))
3. Document results: `invalid_signatures` count, `failure_rate_percent`
4. If failures detected: escalate to security team
5. Update compliance dashboard

**Acceptance Criteria**: 100% valid signatures

---

## Appendix

### Environment Configuration

**Required Supabase Secrets**:

- `app.audit_signing_key`: HMAC-SHA256 key for event signatures (256-bit hex string)
- `app.audit_signing_key_version`: Key version for rotation tracking (e.g., 'v2.0')

**Example**:

```sql
-- Set signing key (superuser only)
ALTER DATABASE growbro SET app.audit_signing_key = 'your-256-bit-hex-key-here';
ALTER DATABASE growbro SET app.audit_signing_key_version = 'v2.0';
```

### Monitoring & Alerting

**Key Metrics**:

- Partition creation failures
- Signature verification failure rate
- Partition manifest checksum mismatches
- Retention purge execution status
- Backup completion status

**Alert Thresholds**:

- **Critical**: Any signature verification failure
- **Warning**: Partition not created 7 days before month end
- **Info**: Backup completion, retention purge execution

---

**Document Version**: 1.0

**Last Updated**: 2024-10-19

**Next Review**: 2025-01-19 (quarterly)
