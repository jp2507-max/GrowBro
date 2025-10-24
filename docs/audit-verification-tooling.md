# Audit Trail Verification Tooling

## Overview

This document outlines the operational tooling and procedures for verifying the integrity and authenticity of audit trails in GrowBro's moderation system. The verification system ensures compliance with DSA Art. 24(5) transparency requirements and GDPR Art. 5(1)(f) integrity principles.

## Verification Components

### 1. Per-Event Signature Verification

**Purpose**: Verify that individual audit events have not been tampered with since creation.

**Implementation**: `AuditService.verifyIntegrity(event_id)`

**Process**:

1. Retrieve audit event from database
2. Reconstruct signature payload from event data
3. Compare computed signature with stored signature
4. Return verification result with details

**Usage Example**:

```typescript
import { AuditService } from '@/lib/moderation/audit-service';
import { createClient } from '@/lib/supabase';

const supabase = createClient();
const auditService = new AuditService(supabase);

// Verify a specific event
const result = await auditService.verifyIntegrity('event-uuid-here');

if (!result.is_valid) {
  console.error('Integrity violation detected!');
  console.error('Event ID:', result.event_id);
  console.error('Expected:', result.expected_signature);
  console.error('Actual:', result.actual_signature);
  console.error('Error:', result.error);
}
```

**Database Function**: `verify_audit_signature(p_event_id UUID)`

This function:

- Reconstructs the canonical event payload
- Computes HMAC-SHA256 signature using current signing key
- Compares with stored signature
- Returns boolean result

### 2. Partition-Level Checksum Verification

**Purpose**: Verify the integrity of an entire monthly partition of audit events.

**Implementation**: `AuditService.verifyPartitionIntegrity(partition_name)`

**Process**:

1. Generate fresh checksum for all events in partition
2. Retrieve stored checksum from `partition_manifests` table
3. Compare checksums
4. Update verification status
5. Return boolean result

**Usage Example**:

```typescript
// Verify current month's partition
const currentMonth = new Date().toISOString().slice(0, 7).replace('-', '');
const partitionName = `audit_events_${currentMonth}`;

const isValid = await auditService.verifyPartitionIntegrity(partitionName);

if (!isValid) {
  console.error('Partition integrity violation detected!');
  console.error('Partition:', partitionName);
  // Escalate to security team
}
```

**Automation**: Schedule periodic verification via cron job:

```sql
-- Run daily partition verification for last 3 months
SELECT verify_partition_integrity_batch(3);
```

### 3. Hash Chain Verification (Optional Enhancement)

**Purpose**: Verify sequential integrity across events using cryptographic chain.

**Status**: Optional - signatures provide primary integrity guarantee.

**Implementation**: Would require `previous_event_hash` column and chain verification logic.

## Verification Procedures

### Daily Verification Routine

Run these checks daily via automated job:

```typescript
// Daily verification script
async function runDailyVerification() {
  const auditService = new AuditService(supabase);

  // 1. Verify last 90 days of partitions
  const partitions = getLastNMonthsPartitions(3);

  for (const partition of partitions) {
    const isValid = await auditService.verifyPartitionIntegrity(partition);

    if (!isValid) {
      await alertSecurityTeam({
        severity: 'CRITICAL',
        message: `Partition ${partition} failed integrity check`,
        timestamp: new Date(),
      });
    }
  }

  // 2. Sample individual events (random 100 per day)
  const sampleEvents = await getSampleEvents(100);

  for (const eventId of sampleEvents) {
    const result = await auditService.verifyIntegrity(eventId);

    if (!result.is_valid) {
      await alertSecurityTeam({
        severity: 'HIGH',
        message: `Event ${eventId} failed signature verification`,
        details: result,
        timestamp: new Date(),
      });
    }
  }
}
```

### Pre-Legal-Request Verification

Before responding to legal or regulatory audit requests:

```typescript
async function verifyAuditTrailForLegalRequest(params: {
  start_date: Date;
  end_date: Date;
  target_id?: string;
}) {
  const auditService = new AuditService(supabase);

  // 1. Get all relevant partitions
  const partitions = getPartitionsForDateRange(
    params.start_date,
    params.end_date
  );

  // 2. Verify each partition
  const verificationResults = await Promise.all(
    partitions.map((p) => auditService.verifyPartitionIntegrity(p))
  );

  if (verificationResults.some((r) => !r)) {
    throw new Error('Audit trail integrity compromised - cannot certify');
  }

  // 3. Query and verify specific events
  const trail = await auditService.queryAuditTrail(
    {
      start_date: params.start_date,
      end_date: params.end_date,
      target_id: params.target_id,
    },
    {
      accessor_id: 'legal-team',
      accessor_type: 'system',
      purpose: 'legal_request_response',
    }
  );

  // 4. Verify sample of returned events
  const sampleSize = Math.min(trail.events.length, 100);
  const sampleIndices = generateRandomIndices(trail.events.length, sampleSize);

  for (const idx of sampleIndices) {
    const event = trail.events[idx];
    const result = await auditService.verifyIntegrity(event.id);

    if (!result.is_valid) {
      throw new Error(`Event ${event.id} failed verification`);
    }
  }

  return {
    verified: true,
    event_count: trail.total_count,
    verification_timestamp: new Date(),
    verifier: 'automated_verification_system',
  };
}
```

## Monitoring and Alerting

### Key Metrics to Track

1. **Verification Success Rate**: Percentage of events passing signature verification
2. **Partition Health**: Number of partitions with valid checksums
3. **Verification Latency**: Time to verify partitions and events
4. **Tamper Detection Rate**: Number of integrity violations detected

### Alert Thresholds

- **CRITICAL**: Any partition checksum mismatch
- **HIGH**: Individual event signature mismatch
- **MEDIUM**: Verification job failure or timeout
- **LOW**: Performance degradation in verification

### Alert Configuration

```typescript
interface VerificationAlert {
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
  affected_resource: string;
  detection_timestamp: Date;
  requires_immediate_action: boolean;
}

async function alertSecurityTeam(alert: VerificationAlert) {
  // 1. Log to security incident system
  await logSecurityIncident(alert);

  // 2. Send notifications based on severity
  if (alert.severity === 'CRITICAL' || alert.severity === 'HIGH') {
    await sendPagerDutyAlert(alert);
    await sendEmailAlert('security@growbro.app', alert);
  }

  // 3. Create audit event
  await auditService.logEvent({
    event_type: 'integrity_violation_detected',
    actor_id: 'system',
    actor_type: 'system',
    target_id: alert.affected_resource,
    target_type: 'audit_verification',
    action: 'detect_violation',
    metadata: alert,
  });
}
```

## Database Functions

### verify_audit_signature

```sql
-- Defined in: 20251019_create_audit_worm_triggers.sql
-- Purpose: Verify HMAC-SHA256 signature of audit event
-- Returns: boolean (true if valid, false if tampered)

SELECT verify_audit_signature('event-uuid-here');
```

### generate_partition_checksum

```sql
-- Defined in: 20251019_create_partition_management.sql
-- Purpose: Generate aggregate checksum for partition
-- Returns: record_count, checksum

SELECT generate_partition_checksum('audit_events_202510');
```

### verify_partition_integrity_batch

```sql
-- Purpose: Verify multiple recent partitions
-- Parameter: n_months (number of recent months to verify)
-- Returns: array of partition verification results

SELECT verify_partition_integrity_batch(3);
```

## Operational Commands

### Manual Verification Commands

```bash
# Verify specific event
psql -c "SELECT verify_audit_signature('event-uuid');"

# Generate partition checksum
psql -c "SELECT * FROM generate_partition_checksum('audit_events_202510');"

# Verify all recent partitions
psql -c "SELECT verify_partition_integrity_batch(6);"

# Get partition manifest status
psql -c "SELECT * FROM partition_manifests ORDER BY partition_start_date DESC LIMIT 10;"
```

### Query Verification Status

```sql
-- Get verification status for all partitions
SELECT
  partition_name,
  verification_status,
  last_verified_at,
  record_count,
  CASE
    WHEN last_verified_at < NOW() - INTERVAL '7 days' THEN 'STALE'
    WHEN verification_status = 'valid' THEN 'OK'
    ELSE 'REQUIRES_ATTENTION'
  END as health_status
FROM partition_manifests
ORDER BY partition_start_date DESC;
```

## Troubleshooting

### Signature Mismatch Detected

**Symptoms**: `verify_audit_signature` returns false for an event

**Possible Causes**:

1. Key rotation occurred and old key not available
2. Actual tampering attempt
3. Bug in signature generation logic
4. Database corruption

**Resolution Steps**:

1. Check signing key version and rotation history
2. Review audit event metadata for anomalies
3. Compare event with offsite backup
4. Escalate to security team if tampering suspected

### Partition Checksum Mismatch

**Symptoms**: `verifyPartitionIntegrity` returns false

**Possible Causes**:

1. Events added/removed from partition (should be impossible with WORM)
2. Checksum algorithm changed
3. Database corruption
4. Actual tampering

**Resolution Steps**:

1. Re-generate checksum and compare again
2. Verify partition hasn't been detached/re-attached
3. Check database logs for suspicious activity
4. Compare partition with offsite backup
5. File security incident report

## Integration with Compliance Auditing

The verification system integrates with compliance auditing workflows:

1. **Pre-Audit Verification**: Run full verification before regulatory audits
2. **Certification**: Provide verification certificates with audit trail exports
3. **Continuous Monitoring**: Real-time integrity monitoring for compliance
4. **Incident Response**: Automated incident logging for integrity violations

## Best Practices

1. **Automate Daily**: Run verification checks automatically every day
2. **Sample Testing**: Verify random samples for cost-effective monitoring
3. **Pre-Export Verification**: Always verify before exporting audit data
4. **Monitor Performance**: Track verification latency trends
5. **Document Incidents**: Log all integrity violations for investigation
6. **Regular Key Rotation**: Follow key rotation SOP quarterly
7. **Offsite Comparison**: Periodically compare with immutable backups
8. **Access Control**: Limit verification tool access to security team

## See Also

- [Audit Signer Key Rotation SOP](./audit-signer-key-rotation-sop.md)
- [Audit Trail Rehydration Procedure](./audit-rehydration-procedure.md)
- [Compliance Auditing Guide](./audit-compliance-guide.md)
