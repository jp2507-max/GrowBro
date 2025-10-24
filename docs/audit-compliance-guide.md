# Compliance Auditing Guide

## Overview

This guide provides comprehensive procedures for conducting compliance audits of GrowBro's moderation system, with focus on DSA (Digital Services Act) and GDPR requirements. It outlines how to use the audit trail system to demonstrate regulatory compliance and respond to audit requests.

## Regulatory Framework

### DSA Compliance (Arts. 15, 24, 24(5))

**Key Requirements**:

- Transparency reporting with specific metrics
- Statement of Reasons (SoR) submission to Commission Transparency Database
- Audit trail integrity for all moderation decisions
- Public availability of transparency reports

**Audit Evidence Required**:

- Annual transparency reports
- SoR submission records with timestamps
- Decision audit trails with complete metadata
- Appeal handling documentation

### GDPR Compliance (Art. 5, 30, 32)

**Key Requirements**:

- Lawful basis for data processing
- Data minimization and storage limitation
- Security of processing (integrity and confidentiality)
- Records of Processing Activities (RoPA)

**Audit Evidence Required**:

- Data retention policies and enforcement records
- PII anonymization logs
- Access control logs with purpose documentation
- Security incident records

## Audit Preparation Checklist

### Before Regulatory Audit

- [ ] Run full integrity verification on all audit partitions
- [ ] Generate transparency metrics for audit period
- [ ] Verify SoR submission completeness
- [ ] Prepare RoPA entries for moderation activities
- [ ] Review and document legal bases for data processing
- [ ] Compile security incident reports (if any)
- [ ] Test audit trail export functionality
- [ ] Verify backup integrity and accessibility

### Documentation to Prepare

1. **System Architecture Documentation**
   - Audit service design and implementation
   - WORM enforcement mechanisms
   - Cryptographic signature system
   - Partition and manifest structure

2. **Policy Documentation**
   - Data retention policy with legal justification
   - Access control policies
   - Incident response procedures
   - Key rotation procedures

3. **Operational Logs**
   - Partition verification history
   - Backup and restore logs
   - Key rotation events
   - Security incidents (if any)

## Audit Queries and Reports

### DSA Transparency Metrics

Generate annual transparency report data:

```sql
-- DSA Art. 15 & 24 Metrics for Transparency Report
WITH reporting_period AS (
  SELECT
    DATE_TRUNC('year', NOW() - INTERVAL '1 year') AS start_date,
    DATE_TRUNC('year', NOW()) - INTERVAL '1 day' AS end_date
)
SELECT
  -- Notices received by category (Art. 16)
  (SELECT COUNT(*)
   FROM audit_events ae, reporting_period rp
   WHERE ae.event_type = 'report_submitted'
   AND ae.timestamp BETWEEN rp.start_date AND rp.end_date
  ) as total_notices_received,

  (SELECT COUNT(*)
   FROM audit_events ae, reporting_period rp
   WHERE ae.event_type = 'report_submitted'
   AND ae.metadata->>'report_type' = 'illegal_content'
   AND ae.timestamp BETWEEN rp.start_date AND rp.end_date
  ) as illegal_content_notices,

  (SELECT COUNT(*)
   FROM audit_events ae, reporting_period rp
   WHERE ae.event_type = 'report_submitted'
   AND ae.metadata->>'report_type' = 'policy_violation'
   AND ae.timestamp BETWEEN rp.start_date AND rp.end_date
  ) as policy_violation_notices,

  -- Moderation decisions by action type (Art. 17)
  (SELECT COUNT(*)
   FROM audit_events ae, reporting_period rp
   WHERE ae.event_type = 'decision_made'
   AND ae.timestamp BETWEEN rp.start_date AND rp.end_date
  ) as total_moderation_decisions,

  (SELECT COUNT(*)
   FROM audit_events ae, reporting_period rp
   WHERE ae.event_type = 'decision_made'
   AND ae.metadata->>'action' = 'content_removed'
   AND ae.timestamp BETWEEN rp.start_date AND rp.end_date
  ) as content_removal_decisions,

  -- SoR submissions to Commission DB (Art. 24(5))
  (SELECT COUNT(*)
   FROM audit_events ae, reporting_period rp
   WHERE ae.event_type = 'sor_submitted'
   AND ae.timestamp BETWEEN rp.start_date AND rp.end_date
  ) as sor_submissions,

  -- Appeals and outcomes (Art. 20)
  (SELECT COUNT(*)
   FROM audit_events ae, reporting_period rp
   WHERE ae.event_type = 'appeal_filed'
   AND ae.timestamp BETWEEN rp.start_date AND rp.end_date
  ) as appeals_received,

  (SELECT COUNT(*)
   FROM audit_events ae, reporting_period rp
   WHERE ae.event_type = 'appeal_decided'
   AND ae.metadata->>'outcome' = 'upheld'
   AND ae.timestamp BETWEEN rp.start_date AND rp.end_date
  ) as appeals_upheld,

  -- ODS escalations (Art. 21)
  (SELECT COUNT(*)
   FROM audit_events ae, reporting_period rp
   WHERE ae.event_type = 'ods_escalation'
   AND ae.timestamp BETWEEN rp.start_date AND rp.end_date
  ) as ods_escalations,

  -- Trusted flagger metrics (Art. 22)
  (SELECT COUNT(DISTINCT ae.metadata->>'trusted_flagger_id')
   FROM audit_events ae, reporting_period rp
   WHERE ae.event_type = 'report_submitted'
   AND ae.metadata->>'is_trusted_flagger' = 'true'
   AND ae.timestamp BETWEEN rp.start_date AND rp.end_date
  ) as active_trusted_flaggers,

  -- Repeat offender actions (Art. 23)
  (SELECT COUNT(*)
   FROM audit_events ae, reporting_period rp
   WHERE ae.event_type = 'repeat_offender_action'
   AND ae.timestamp BETWEEN rp.start_date AND rp.end_date
  ) as repeat_offender_actions;
```

### GDPR Data Processing Records

Generate RoPA-compliant processing records:

```sql
-- Processing activities for moderation audit trails
SELECT
  'Moderation Audit Trail' as processing_activity,
  'Content moderation, decision tracking, appeal management' as purpose,
  'Art. 6(1)(c) - Legal obligation (DSA Art. 24)' as legal_basis,
  'Moderator IDs, User IDs, Content IDs, Timestamps, Decision metadata' as data_categories,
  '7 years for audit events, 30 days for PII before anonymization' as retention_period,
  'HMAC-SHA256 signatures, WORM enforcement, RLS policies, encrypted backups' as security_measures,
  'Commission Transparency Database (EU), Backup storage (EU)' as transfers,
  COUNT(*) as total_events,
  MIN(timestamp) as earliest_event,
  MAX(timestamp) as latest_event
FROM audit_events
WHERE event_type IN ('decision_made', 'appeal_filed', 'sor_submitted')
GROUP BY 1,2,3,4,5,6,7;
```

### Data Retention Compliance

Verify retention policy enforcement:

```sql
-- Retention compliance check
WITH retention_analysis AS (
  SELECT
    event_type,
    COUNT(*) as total_events,
    COUNT(*) FILTER (WHERE retention_until < NOW()) as expired_events,
    COUNT(*) FILTER (WHERE pii_tagged = true AND created_at < NOW() - INTERVAL '30 days') as pii_requiring_anonymization,
    MIN(retention_until) as earliest_retention_expiry,
    MAX(retention_until) as latest_retention_expiry
  FROM audit_events
  GROUP BY event_type
)
SELECT
  event_type,
  total_events,
  expired_events,
  pii_requiring_anonymization,
  CASE
    WHEN expired_events > 0 THEN 'REQUIRES_CLEANUP'
    WHEN pii_requiring_anonymization > 0 THEN 'REQUIRES_ANONYMIZATION'
    ELSE 'COMPLIANT'
  END as compliance_status,
  earliest_retention_expiry,
  latest_retention_expiry
FROM retention_analysis
ORDER BY compliance_status DESC, expired_events DESC;
```

### Access Control Audit

Review audit trail access patterns:

```sql
-- Audit trail access log (chain of custody)
SELECT
  ae.timestamp as access_timestamp,
  ae.actor_id,
  ae.metadata->>'accessor_type' as accessor_type,
  ae.metadata->>'purpose' as access_purpose,
  ae.metadata->>'query_parameters' as query_details,
  ae.metadata->>'permission_verified' as permission_verified,
  COUNT(*) OVER (PARTITION BY ae.actor_id) as total_accesses_by_actor
FROM audit_events ae
WHERE ae.event_type = 'audit_access'
AND ae.timestamp >= NOW() - INTERVAL '90 days'
ORDER BY ae.timestamp DESC
LIMIT 100;
```

### Integrity Verification Status

Demonstrate audit trail integrity:

```sql
-- Partition integrity verification status
SELECT
  pm.partition_name,
  pm.partition_start_date,
  pm.partition_end_date,
  pm.record_count,
  pm.verification_status,
  pm.last_verified_at,
  CASE
    WHEN pm.last_verified_at >= NOW() - INTERVAL '7 days' THEN 'RECENTLY_VERIFIED'
    WHEN pm.last_verified_at >= NOW() - INTERVAL '30 days' THEN 'NEEDS_VERIFICATION'
    ELSE 'VERIFICATION_OVERDUE'
  END as verification_freshness,
  pm.checksum
FROM partition_manifests pm
ORDER BY pm.partition_start_date DESC
LIMIT 12; -- Last 12 months
```

## Responding to Audit Requests

### Authority Data Request Response

When regulatory authority requests audit data:

```typescript
interface AuthorityRequest {
  request_id: string;
  authority: string; // e.g., "EU Commission", "Member State DSC"
  request_date: Date;
  scope: {
    start_date: Date;
    end_date: Date;
    event_types?: string[];
    target_ids?: string[];
  };
  legal_basis: string;
  response_deadline: Date;
}

async function respondToAuthorityRequest(request: AuthorityRequest) {
  const auditService = new AuditService(supabase);

  // 1. Log the request
  await auditService.logEvent({
    event_type: 'authority_data_request',
    actor_id: 'legal-team',
    actor_type: 'system',
    target_id: request.request_id,
    target_type: 'authority_request',
    action: 'received',
    metadata: request,
  });

  // 2. Verify audit trail integrity for requested period
  const verificationResult = await verifyAuditTrailForLegalRequest({
    start_date: request.scope.start_date,
    end_date: request.scope.end_date,
  });

  if (!verificationResult.verified) {
    throw new Error('Audit trail integrity compromised - cannot certify data');
  }

  // 3. Query relevant audit events
  const trail = await auditService.queryAuditTrail(
    {
      start_date: request.scope.start_date,
      end_date: request.scope.end_date,
      event_type: request.scope.event_types,
    },
    {
      accessor_id: 'legal-team',
      accessor_type: 'system',
      purpose: `authority_request_${request.request_id}`,
    }
  );

  // 4. Generate certified export
  const exportPackage = await generateCertifiedExport({
    request_id: request.request_id,
    events: trail.events,
    verification: verificationResult,
    authority: request.authority,
  });

  // 5. Log response
  await auditService.logEvent({
    event_type: 'authority_data_request',
    actor_id: 'legal-team',
    actor_type: 'system',
    target_id: request.request_id,
    target_type: 'authority_request',
    action: 'responded',
    metadata: {
      events_provided: trail.total_count,
      export_signature: exportPackage.signature,
      response_date: new Date(),
    },
  });

  return exportPackage;
}
```

### Export Certification

Provide cryptographic proof of authenticity:

```typescript
interface CertifiedExport {
  request_id: string;
  export_date: Date;
  events: AuditEvent[];
  certification: {
    total_events: number;
    date_range: { start: Date; end: Date };
    integrity_verified: boolean;
    verification_method: string;
    partition_checksums: Array<{
      partition: string;
      checksum: string;
      verified: boolean;
    }>;
    sample_event_signatures_verified: boolean;
    sample_size: number;
  };
  signature: string; // Signature of entire export package
}

async function generateCertifiedExport(params: {
  request_id: string;
  events: AuditEvent[];
  verification: any;
  authority: string;
}): Promise<CertifiedExport> {
  // Generate export package
  const exportPackage: CertifiedExport = {
    request_id: params.request_id,
    export_date: new Date(),
    events: params.events,
    certification: {
      total_events: params.events.length,
      date_range: {
        start: params.events[0].timestamp,
        end: params.events[params.events.length - 1].timestamp,
      },
      integrity_verified: params.verification.verified,
      verification_method: 'HMAC-SHA256 signatures + partition checksums',
      partition_checksums: params.verification.partition_checksums || [],
      sample_event_signatures_verified: true,
      sample_size: Math.min(params.events.length, 100),
    },
    signature: '', // Will be generated
  };

  // Sign entire export package
  const exportJson = JSON.stringify(exportPackage);
  const signature = await generateExportSignature(exportJson);
  exportPackage.signature = signature;

  return exportPackage;
}
```

## Internal Compliance Audits

### Quarterly Self-Assessment

Run quarterly to ensure ongoing compliance:

```typescript
interface QuarterlyAuditReport {
  quarter: string; // e.g., "2025-Q4"
  audit_date: Date;
  findings: {
    integrity_status: 'PASS' | 'FAIL';
    retention_compliance: 'PASS' | 'FAIL';
    access_control: 'PASS' | 'FAIL';
    backup_integrity: 'PASS' | 'FAIL';
  };
  metrics: {
    total_audit_events: number;
    integrity_verifications_passed: number;
    integrity_verifications_failed: number;
    expired_events_not_deleted: number;
    pii_events_not_anonymized: number;
    unauthorized_access_attempts: number;
  };
  recommendations: string[];
  next_audit_date: Date;
}

async function runQuarterlyComplianceAudit(): Promise<QuarterlyAuditReport> {
  const auditService = new AuditService(supabase);
  const retentionManager = new AuditRetentionManager(supabase, auditService);

  // 1. Verify partition integrity
  const partitions = await getLastNMonthsPartitions(3);
  let integrityPassed = 0;
  let integrityFailed = 0;

  for (const partition of partitions) {
    const isValid = await auditService.verifyPartitionIntegrity(partition);
    if (isValid) integrityPassed++;
    else integrityFailed++;
  }

  // 2. Check retention compliance
  const retentionStats = await retentionManager.getRetentionStatistics();

  // 3. Review access control logs
  const accessLogs = await auditService.queryAuditTrail(
    {
      event_type: 'audit_access',
      start_date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
    },
    {
      accessor_id: 'compliance-team',
      accessor_type: 'system',
      purpose: 'quarterly_audit',
    }
  );

  // 4. Verify backup integrity (sample)
  const backupVerified = await verifySampleBackups();

  // 5. Generate report
  const report: QuarterlyAuditReport = {
    quarter: getCurrentQuarter(),
    audit_date: new Date(),
    findings: {
      integrity_status: integrityFailed === 0 ? 'PASS' : 'FAIL',
      retention_compliance:
        retentionStats.events_expired === 0 ? 'PASS' : 'FAIL',
      access_control: 'PASS', // Would check for unauthorized access
      backup_integrity: backupVerified ? 'PASS' : 'FAIL',
    },
    metrics: {
      total_audit_events: retentionStats.total_audit_events,
      integrity_verifications_passed: integrityPassed,
      integrity_verifications_failed: integrityFailed,
      expired_events_not_deleted: retentionStats.events_expired,
      pii_events_not_anonymized: retentionStats.events_with_pii,
      unauthorized_access_attempts: 0,
    },
    recommendations: generateRecommendations(integrityFailed, retentionStats),
    next_audit_date: getNextQuarterDate(),
  };

  // 6. Log audit completion
  await auditService.logEvent({
    event_type: 'compliance_audit_completed',
    actor_id: 'compliance-team',
    actor_type: 'system',
    target_id: 'audit_system',
    target_type: 'system',
    action: 'quarterly_audit',
    metadata: report,
  });

  return report;
}
```

## Common Audit Questions and Responses

### "How do you ensure audit trail integrity?"

**Response**:

- HMAC-SHA256 cryptographic signatures on all events
- WORM (Write-Once-Read-Many) enforcement at database level
- Monthly partition checksums with manifest verification
- Immutable offsite backups with object lock
- Regular integrity verification procedures

**Evidence**:

- Partition verification logs
- Signature verification results
- Database trigger definitions
- Backup integrity reports

### "How do you handle data retention and deletion?"

**Response**:

- Documented retention policy: 7 years for audit events, 30 days for PII
- Automated retention enforcement via retention manager
- PII anonymization after 30 days
- Legal hold mechanisms for active investigations
- Audit logging for all retention actions

**Evidence**:

- Retention policy documentation
- Retention statistics reports
- PII anonymization logs
- Legal hold records

### "Who can access audit trails and how is access controlled?"

**Response**:

- Role-based access control via RLS policies
- All access logged with purpose documentation
- Chain of custody maintained for all queries
- Restricted access to authorized personnel only
- Permission verification before data access

**Evidence**:

- Access control logs
- RLS policy definitions
- User role mappings
- Access audit trail

### "How do you respond to data breaches or security incidents?"

**Response**:

- Integrity verification detects tampering
- Immutable audit trail provides forensic evidence
- Backup restoration capabilities for recovery
- Incident response procedures documented
- Regulatory notification procedures in place

**Evidence**:

- Incident response documentation
- Security incident logs (if any)
- Recovery procedures
- Notification records

## Best Practices for Audits

1. **Preparation**: Run integrity checks before auditor arrival
2. **Documentation**: Keep all procedures well-documented
3. **Evidence**: Maintain organized audit logs and reports
4. **Transparency**: Provide clear explanations of technical implementations
5. **Responsiveness**: Respond promptly to auditor requests
6. **Continuous Improvement**: Act on audit recommendations
7. **Training**: Ensure team understands compliance requirements

## Audit Timeline

### Annual Regulatory Audit Cycle

- **Q1**: Prepare transparency report for previous year
- **Q2**: Submit transparency report; conduct internal self-assessment
- **Q3**: Address any findings from self-assessment
- **Q4**: Year-end review and planning for next year

### Ongoing Compliance Activities

- **Daily**: Automated integrity verification
- **Weekly**: Backup verification tests
- **Monthly**: Access control review
- **Quarterly**: Comprehensive self-assessment
- **Annually**: External regulatory audit

## See Also

- [Audit Verification Tooling](./audit-verification-tooling.md)
- [Audit Trail Rehydration Procedure](./audit-rehydration-procedure.md)
- [Audit Signer Key Rotation SOP](./audit-signer-key-rotation-sop.md)
- DSA Arts. 15, 24, 24(5) - Transparency Reporting
- GDPR Arts. 5, 30, 32 - Data Protection Principles
