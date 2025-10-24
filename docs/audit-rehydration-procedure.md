# Audit Trail Rehydration Procedure

## Overview

This document outlines the procedures for rehydrating audit trails from immutable offsite backups. Rehydration may be necessary for disaster recovery, forensic investigations, or compliance verification after suspected tampering.

## Prerequisites

- Access to offsite backup storage (S3/Azure Blob with object lock)
- Database administrative credentials
- Backup encryption keys
- Understanding of partition structure and manifest system

## Backup Architecture

### Storage Structure

```
s3://growbro-audit-backups/
├── production/
│   ├── partitions/
│   │   ├── audit_events_202510/
│   │   │   ├── data.parquet           # Compressed audit data
│   │   │   ├── manifest.json          # Partition metadata
│   │   │   └── signature.sig          # Cryptographic signature
│   │   ├── audit_events_202509/
│   │   └── ...
│   └── manifests/
│       ├── partition_manifests.json   # All partition checksums
│       └── backup_metadata.json       # Backup configuration
├── staging/
└── development/
```

### Backup Frequency

- **Incremental**: Daily at 02:00 UTC
- **Full Snapshot**: Weekly (Sunday 03:00 UTC)
- **Retention**: 7 years (aligned with audit retention policy)

### Object Lock Configuration

- **Mode**: Governance (allows privileged deletion if needed)
- **Retention**: 7 years
- **Versioning**: Enabled for audit trail of backup changes

## Rehydration Scenarios

### Scenario 1: Full Database Restoration

**Use Case**: Complete database loss, disaster recovery

**Steps**:

1. **Prepare Target Database**

```bash
# Create fresh database instance
createdb growbro_audit_restored

# Run schema migrations
psql -d growbro_audit_restored -f supabase/migrations/20251019_create_audit_worm_triggers.sql
psql -d growbro_audit_restored -f supabase/migrations/20251019_create_partition_management.sql
```

2. **Download Backup Data**

```bash
# Download all partitions for date range
aws s3 sync \
  s3://growbro-audit-backups/production/partitions/ \
  ./restore_data/partitions/ \
  --region us-east-1

# Download manifests
aws s3 cp \
  s3://growbro-audit-backups/production/manifests/partition_manifests.json \
  ./restore_data/
```

3. **Verify Backup Integrity**

```bash
# Verify signatures for each partition
for partition in ./restore_data/partitions/*/; do
  partition_name=$(basename "$partition")

  # Verify signature
  openssl dgst -sha256 -verify public_key.pem \
    -signature "$partition/signature.sig" \
    "$partition/data.parquet"

  if [ $? -ne 0 ]; then
    echo "ERROR: Signature verification failed for $partition_name"
    exit 1
  fi
done
```

4. **Load Data into Database**

```sql
-- For each partition, load data
\copy audit_events FROM './restore_data/partitions/audit_events_202510/data.parquet' WITH (FORMAT parquet);

-- Verify record counts match manifest
SELECT
  COUNT(*) as actual_count,
  manifest.record_count as expected_count
FROM audit_events_202510
CROSS JOIN (
  SELECT record_count
  FROM partition_manifests
  WHERE partition_name = 'audit_events_202510'
) manifest;
```

5. **Verify Restored Data**

```typescript
// Run verification on restored database
const supabase = createClient(); // Connected to restored DB
const auditService = new AuditService(supabase);

// Verify each partition
const partitions = await getRestoredPartitions();

for (const partition of partitions) {
  const isValid = await auditService.verifyPartitionIntegrity(partition);

  if (!isValid) {
    console.error(`Partition ${partition} failed verification after restore`);
  }
}
```

6. **Compare with Original**

```sql
-- If original DB still accessible, compare checksums
SELECT
  o.partition_name,
  o.checksum as original_checksum,
  r.checksum as restored_checksum,
  o.checksum = r.checksum as match
FROM original_db.partition_manifests o
FULL OUTER JOIN restored_db.partition_manifests r
  ON o.partition_name = r.partition_name
WHERE o.checksum != r.checksum OR o.partition_name IS NULL OR r.partition_name IS NULL;
```

### Scenario 2: Selective Partition Restoration

**Use Case**: Suspected tampering in specific time period, forensic investigation

**Steps**:

1. **Identify Affected Partitions**

```sql
-- Find partitions with integrity violations
SELECT
  partition_name,
  verification_status,
  last_verified_at
FROM partition_manifests
WHERE verification_status = 'tampered'
ORDER BY partition_start_date;
```

2. **Download Specific Partitions**

```bash
# Download only affected partitions
aws s3 cp \
  s3://growbro-audit-backups/production/partitions/audit_events_202510/ \
  ./restore_data/partitions/audit_events_202510/ \
  --recursive
```

3. **Create Comparison Table**

```sql
-- Create temporary table for comparison
CREATE TABLE audit_events_202510_backup (LIKE audit_events_202510 INCLUDING ALL);

-- Load backup data
\copy audit_events_202510_backup FROM './restore_data/partitions/audit_events_202510/data.parquet' WITH (FORMAT parquet);
```

4. **Compare and Identify Differences**

```sql
-- Find events in production not in backup (potentially added)
SELECT p.*
FROM audit_events_202510 p
LEFT JOIN audit_events_202510_backup b ON p.id = b.id
WHERE b.id IS NULL;

-- Find events in backup not in production (potentially deleted)
SELECT b.*
FROM audit_events_202510_backup b
LEFT JOIN audit_events_202510 p ON b.id = p.id
WHERE p.id IS NULL;

-- Find modified events (signatures differ)
SELECT
  p.id,
  p.signature as production_signature,
  b.signature as backup_signature,
  p.metadata as production_metadata,
  b.metadata as backup_metadata
FROM audit_events_202510 p
INNER JOIN audit_events_202510_backup b ON p.id = b.id
WHERE p.signature != b.signature;
```

5. **Document Discrepancies**

```typescript
interface DiscrepancyReport {
  partition_name: string;
  events_added: string[]; // Events in prod not in backup
  events_removed: string[]; // Events in backup not in prod
  events_modified: Array<{
    id: string;
    original_signature: string;
    current_signature: string;
    metadata_diff: any;
  }>;
  investigation_timestamp: Date;
  investigator: string;
}

// Generate report
const report = await generateDiscrepancyReport('audit_events_202510');

// Log investigation
await auditService.logEvent({
  event_type: 'forensic_investigation',
  actor_id: 'security-team',
  actor_type: 'system',
  target_id: 'audit_events_202510',
  target_type: 'partition',
  action: 'compare_with_backup',
  metadata: report,
});
```

6. **Restore if Appropriate**

```sql
-- If authorized, restore from backup
-- WARNING: This requires disabling WORM triggers temporarily

BEGIN;

-- Drop compromised partition
DROP TABLE audit_events_202510;

-- Rename backup to production
ALTER TABLE audit_events_202510_backup RENAME TO audit_events_202510;

-- Re-enable triggers
-- (triggers automatically apply to new partition)

-- Update manifest
UPDATE partition_manifests
SET
  verification_status = 'restored_from_backup',
  last_verified_at = NOW(),
  checksum = (SELECT checksum FROM backup_manifest WHERE partition_name = 'audit_events_202510')
WHERE partition_name = 'audit_events_202510';

COMMIT;
```

### Scenario 3: Point-in-Time Investigation

**Use Case**: Legal discovery, compliance audit for specific time period

**Steps**:

1. **Define Investigation Scope**

```typescript
interface InvestigationScope {
  start_date: Date;
  end_date: Date;
  target_ids?: string[];
  event_types?: string[];
  purpose: string;
  requester: string;
}

const scope: InvestigationScope = {
  start_date: new Date('2025-09-01'),
  end_date: new Date('2025-09-30'),
  event_types: ['decision_made', 'appeal_filed'],
  purpose: 'legal_discovery_case_12345',
  requester: 'legal-team',
};
```

2. **Retrieve from Backup**

```bash
# Download relevant partitions
aws s3 cp \
  s3://growbro-audit-backups/production/partitions/audit_events_202509/ \
  ./investigation/audit_events_202509/ \
  --recursive
```

3. **Create Investigation Database**

```bash
# Create isolated investigation database
createdb audit_investigation_case_12345

# Load schema
psql -d audit_investigation_case_12345 -f audit_schema.sql

# Load data
psql -d audit_investigation_case_12345 << EOF
\copy audit_events FROM './investigation/audit_events_202509/data.parquet' WITH (FORMAT parquet);
EOF
```

4. **Extract Relevant Events**

```sql
-- Query events matching scope
CREATE TABLE investigation_results AS
SELECT *
FROM audit_events
WHERE
  timestamp BETWEEN '2025-09-01' AND '2025-09-30'
  AND event_type IN ('decision_made', 'appeal_filed')
ORDER BY timestamp;

-- Verify integrity of extracted events
SELECT
  id,
  verify_audit_signature(id) as signature_valid
FROM investigation_results;
```

5. **Generate Report with Certification**

```typescript
interface InvestigationReport {
  case_id: string;
  scope: InvestigationScope;
  events_found: number;
  integrity_verified: boolean;
  backup_date: Date;
  extraction_date: Date;
  certification: {
    verified_by: string;
    verification_method: string;
    all_signatures_valid: boolean;
    partition_checksums_matched: boolean;
  };
}

const report: InvestigationReport = {
  case_id: 'case_12345',
  scope,
  events_found: 1247,
  integrity_verified: true,
  backup_date: new Date('2025-09-30T03:00:00Z'),
  extraction_date: new Date(),
  certification: {
    verified_by: 'security-team@growbro.app',
    verification_method: 'HMAC-SHA256 signature + partition checksum',
    all_signatures_valid: true,
    partition_checksums_matched: true,
  },
};
```

6. **Export for Legal Team**

```bash
# Export to secure format
psql -d audit_investigation_case_12345 << EOF
\copy investigation_results TO './investigation/case_12345_audit_trail.csv' WITH CSV HEADER;
EOF

# Generate signature for exported file
openssl dgst -sha256 -sign private_key.pem \
  -out ./investigation/case_12345_audit_trail.csv.sig \
  ./investigation/case_12345_audit_trail.csv

# Package with report
tar -czf case_12345_audit_export.tar.gz \
  ./investigation/case_12345_audit_trail.csv \
  ./investigation/case_12345_audit_trail.csv.sig \
  ./investigation/report.json
```

## Backup Verification Procedures

### Weekly Backup Verification

Run weekly to ensure backups are restorable:

```bash
#!/bin/bash
# weekly-backup-verification.sh

# 1. Download random partition from backup
RANDOM_PARTITION=$(aws s3 ls s3://growbro-audit-backups/production/partitions/ | shuf -n 1 | awk '{print $2}')

aws s3 cp "s3://growbro-audit-backups/production/partitions/${RANDOM_PARTITION}" \
  ./verification_test/ --recursive

# 2. Verify signature
openssl dgst -sha256 -verify public_key.pem \
  -signature "./verification_test/signature.sig" \
  "./verification_test/data.parquet"

if [ $? -eq 0 ]; then
  echo "✓ Backup integrity verified for ${RANDOM_PARTITION}"
else
  echo "✗ Backup integrity FAILED for ${RANDOM_PARTITION}"
  exit 1
fi

# 3. Load into test database and verify checksum
psql -d backup_verification_db << EOF
TRUNCATE audit_events_test;
\copy audit_events_test FROM './verification_test/data.parquet' WITH (FORMAT parquet);

SELECT
  COUNT(*) as record_count,
  MD5(STRING_AGG(signature, '' ORDER BY created_at)) as checksum
FROM audit_events_test;
EOF

# 4. Clean up
rm -rf ./verification_test/
```

### Monthly Full Restore Test

Run monthly disaster recovery drill:

```bash
#!/bin/bash
# monthly-restore-drill.sh

# Simulate full database loss and restoration
echo "Starting monthly restore drill..."

# 1. Create test restore database
createdb audit_restore_drill_$(date +%Y%m%d)

# 2. Download latest full backup
aws s3 sync s3://growbro-audit-backups/production/ ./restore_drill/ --exclude "*" --include "partitions/*/data.parquet"

# 3. Restore all partitions
for partition_data in ./restore_drill/partitions/*/data.parquet; do
  partition_name=$(basename $(dirname "$partition_data"))
  echo "Restoring $partition_name..."

  psql -d audit_restore_drill_$(date +%Y%m%d) << EOF
  \copy ${partition_name} FROM '${partition_data}' WITH (FORMAT parquet);
EOF
done

# 4. Verify integrity
# Run verification script...

# 5. Document results
echo "Restore drill completed at $(date)" >> restore_drill_log.txt
```

## Troubleshooting

### Backup Download Failures

**Symptoms**: S3 sync fails or times out

**Resolution**:

- Check network connectivity
- Verify IAM permissions
- Use `--debug` flag for detailed error messages
- Try smaller batch sizes or single-partition downloads

### Signature Verification Failures

**Symptoms**: OpenSSL verification returns error

**Possible Causes**:

- Wrong public key used
- Backup corruption during transfer
- Key rotation occurred

**Resolution**:

- Verify correct public key version for backup date
- Re-download backup file
- Check backup metadata for key version used

### Checksum Mismatches After Restore

**Symptoms**: Partition checksum doesn't match manifest after loading

**Possible Causes**:

- Data corruption during transfer
- Incorrect partition loaded
- Database encoding issues

**Resolution**:

- Re-download and re-load partition
- Verify partition date ranges match
- Check database locale and encoding settings

## Security Considerations

1. **Access Control**: Limit backup access to authorized security personnel
2. **Encryption**: All backups encrypted at rest and in transit
3. **Audit Restoration**: Log all restoration activities
4. **Chain of Custody**: Document who accessed backups and when
5. **Immutability**: Object lock prevents unauthorized modification
6. **Key Management**: Separate backup encryption keys from signing keys

## Compliance Integration

The rehydration system supports compliance requirements:

- **DSA Art. 24(5)**: Ensure SoR submission trails can be reconstructed
- **GDPR Art. 5(1)(f)**: Demonstrate integrity and confidentiality
- **Legal Discovery**: Provide certified audit trails for legal proceedings
- **Regulatory Audits**: Rapid access to historical audit data

## Best Practices

1. **Regular Testing**: Test restoration procedures monthly
2. **Documentation**: Document all restoration activities
3. **Verification**: Always verify integrity after restoration
4. **Isolation**: Use separate databases for investigations
5. **Certification**: Provide cryptographic proof of authenticity
6. **Access Logging**: Log all backup access and downloads
7. **Retention Alignment**: Align backup retention with audit retention policy

## See Also

- [Audit Verification Tooling](./audit-verification-tooling.md)
- [Audit Signer Key Rotation SOP](./audit-signer-key-rotation-sop.md)
- [Compliance Auditing Guide](./audit-compliance-guide.md)
