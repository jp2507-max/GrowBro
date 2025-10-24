# SoR Submission Failure Recovery Runbook

## Overview

This runbook provides procedures for recovering from failed Statement of Reasons (SoR) submissions to the DSA Commission Transparency Database, ensuring compliance with Art. 24(5) "without undue delay" requirements.

## SoR Submission Architecture

### Components

1. **SoR Export Queue** (`sor_export_queue` table)
2. **PII Scrubber** (deterministic redaction)
3. **DSA Transparency Client** (API integration)
4. **Circuit Breaker** (failure protection)
5. **Dead Letter Queue** (DLQ) (failed submissions)
6. **SoR Submission Orchestrator** (coordination)

### Normal Flow

```
Moderation Decision
  ↓
Generate SoR
  ↓
Scrub PII (deterministic)
  ↓
Enqueue (idempotent)
  ↓
Submit to Commission DB
  ↓
Store transparency_db_id
  ↓
Mark as submitted
```

## Failure Scenarios

### Scenario 1: PII Scrubbing Failure

**Symptoms**:

- Validation errors in queue
- "PII validation failed" in logs
- Items stuck in `pending` status

**Detection**:

```bash
# Check for validation failures
pnpm tsx scripts/check-sor-queue.ts --status=failed --error-type=validation
```

**Root Causes**:

- Scrubbing algorithm bug
- Missing required fields
- Invalid data format

**Resolution**:

1. **Identify Failed Items**:

```bash
# Get failed items with validation errors
pnpm tsx scripts/get-failed-sor.ts --error-type=validation --output=json > failed-validation.json
```

2. **Analyze Failures**:

```bash
# Run validation diagnostics
pnpm tsx scripts/diagnose-sor-validation.ts --input=failed-validation.json
```

3. **Fix Data Issues**:

```bash
# Re-scrub with updated algorithm
pnpm tsx scripts/rescrub-sor.ts --queue-ids=[IDS] --algorithm-version=latest

# Validate redaction
pnpm tsx scripts/validate-redaction.ts --queue-ids=[IDS]
```

4. **Retry Submission**:

```bash
# Retry validated items
pnpm tsx scripts/retry-sor-submissions.ts --queue-ids=[IDS]
```

### Scenario 2: Commission DB API Failure

**Symptoms**:

- HTTP 5xx errors
- Connection timeouts
- Circuit breaker OPEN state
- Items in retry status

**Detection**:

```bash
# Check circuit breaker status
pnpm tsx scripts/check-circuit-breaker.ts

# Check API connectivity
pnpm tsx scripts/test-dsa-api-connection.ts
```

**Root Causes**:

- Commission DB downtime
- Network issues
- API credential problems
- Rate limiting

**Resolution**:

1. **Verify API Status**:

```bash
# Check Commission DB health
curl -I https://transparency-database.ec.europa.eu/api/health

# Test authentication
pnpm tsx scripts/test-dsa-auth.ts
```

2. **Check Circuit Breaker**:

```bash
# Get circuit breaker stats
pnpm tsx scripts/get-circuit-stats.ts

# Reset circuit breaker (if safe)
pnpm tsx scripts/reset-circuit-breaker.ts --confirm
```

3. **Manual Retry**:

```bash
# Get items in retry queue
pnpm tsx scripts/get-retry-queue.ts --output=json > retry-items.json

# Retry with exponential backoff
pnpm tsx scripts/retry-with-backoff.ts --input=retry-items.json --max-attempts=5
```

4. **Escalate if Persistent**:

```bash
# Create incident ticket
pnpm tsx scripts/create-incident.ts --type=dsa_api_failure --severity=P1

# Notify Commission DB support
# Email: transparency-database-support@ec.europa.eu
```

### Scenario 3: Dead Letter Queue Overflow

**Symptoms**:

- DLQ count > threshold (100)
- Multiple failed retry attempts
- "Max retries exceeded" errors

**Detection**:

```bash
# Check DLQ status
pnpm tsx scripts/check-dlq-status.ts

# Get DLQ metrics
pnpm tsx scripts/get-dlq-metrics.ts
```

**Root Causes**:

- Systematic API failures
- Invalid payload format
- Persistent network issues
- Bug in submission logic

**Resolution**:

1. **Analyze DLQ Items**:

```bash
# Export DLQ for analysis
pnpm tsx scripts/export-dlq.ts --output=dlq-analysis.json

# Categorize failures
pnpm tsx scripts/categorize-dlq-failures.ts --input=dlq-analysis.json
```

2. **Fix Systematic Issues**:

```bash
# If payload format issue:
pnpm tsx scripts/fix-payload-format.ts --queue-ids=[IDS]

# If API bug:
# Deploy hotfix, then retry

# If data corruption:
pnpm tsx scripts/regenerate-sor.ts --decision-ids=[IDS]
```

3. **Manual Submission**:

For items that cannot be automatically retried:

```bash
# Export for manual submission
pnpm tsx scripts/export-for-manual-submission.ts --queue-ids=[IDS] --format=csv

# Use Commission DB web form
# https://transparency-database.ec.europa.eu/submit

# Record manual submission IDs
pnpm tsx scripts/record-manual-submission.ts --queue-id=[ID] --transparency-db-id=[DB_ID]
```

4. **Clear DLQ**:

```bash
# After resolution, archive DLQ items
pnpm tsx scripts/archive-dlq.ts --resolved=true
```

### Scenario 4: Idempotency Key Collision

**Symptoms**:

- "Duplicate submission" errors
- Items stuck in `pending` with existing queue entry
- Race condition errors

**Detection**:

```bash
# Check for duplicate queue entries
pnpm tsx scripts/check-duplicate-queue-entries.ts
```

**Root Causes**:

- Concurrent submission attempts
- Retry logic bug
- Database constraint violation

**Resolution**:

1. **Identify Duplicates**:

```bash
# Find duplicate entries
pnpm tsx scripts/find-duplicate-sor.ts --output=duplicates.json
```

2. **Resolve Conflicts**:

```bash
# Keep earliest entry, mark others as duplicate
pnpm tsx scripts/resolve-duplicates.ts --strategy=keep_earliest

# Verify no data loss
pnpm tsx scripts/verify-sor-completeness.ts --decision-ids=[IDS]
```

### Scenario 5: Latency SLA Breach

**Symptoms**:

- P95 submission time > 5 seconds
- "Time to submit" > 1 hour
- Slow queue processing

**Detection**:

```bash
# Check submission metrics
pnpm tsx scripts/get-sor-metrics.ts

# Analyze latency
pnpm tsx scripts/analyze-sor-latency.ts --period=24h
```

**Root Causes**:

- Database performance issues
- Network latency
- Queue backlog
- Insufficient workers

**Resolution**:

1. **Identify Bottleneck**:

```bash
# Profile submission flow
pnpm tsx scripts/profile-sor-submission.ts --sample-size=100

# Check database performance
pnpm tsx scripts/check-db-performance.ts --table=sor_export_queue
```

2. **Optimize Performance**:

```bash
# Scale workers
pnpm tsx scripts/scale-sor-workers.ts --count=10

# Optimize batch size
pnpm tsx scripts/optimize-batch-size.ts --target-latency=2s

# Clear backlog
pnpm tsx scripts/process-sor-backlog.ts --parallel=5
```

## Monitoring and Alerting

### Key Metrics

**Queue Health**:

- Pending count
- Retry count
- DLQ count
- Average queue time

**Submission Performance**:

- Success rate
- P95 latency
- Time to submit
- Retry rate

**Circuit Breaker**:

- State (OPEN/HALF_OPEN/CLOSED)
- Failure count
- Success count
- Last state change

### Alert Thresholds

```typescript
const ALERT_THRESHOLDS = {
  dlqCount: 100,
  p95LatencyMs: 5000,
  successRate: 0.98,
  timeToSubmitMinutes: 60,
  circuitBreakerOpen: true,
};
```

### Monitoring Commands

```bash
# Real-time monitoring
watch -n 30 'pnpm tsx scripts/get-sor-health.ts'

# Generate metrics report
pnpm tsx scripts/generate-sor-metrics-report.ts --period=24h

# Check compliance
pnpm tsx scripts/check-sor-compliance.ts --sla=1h
```

## Compliance Requirements

### DSA Art. 24(5) - "Without Undue Delay"

**Target**: Submit SoR within 1 hour of decision  
**Acceptable**: 95% within 1 hour, 99% within 24 hours  
**Breach**: >5% exceed 1 hour or any exceed 24 hours

**Compliance Checks**:

```bash
# Verify compliance
pnpm tsx scripts/verify-sor-compliance.ts --period=monthly

# Generate compliance report
pnpm tsx scripts/generate-sor-compliance-report.ts --format=pdf
```

### Audit Trail Requirements

**Required Documentation**:

- Submission timestamp
- Scrubbing metadata (algorithm version, redacted fields)
- Commission DB response ID
- Retry attempts and outcomes
- Manual intervention records

**Audit Commands**:

```bash
# Export audit trail
pnpm tsx scripts/export-sor-audit-trail.ts --start=[DATE] --end=[DATE]

# Verify audit completeness
pnpm tsx scripts/verify-sor-audit.ts --period=monthly
```

## Recovery Procedures

### Full System Recovery

**When**: Complete SoR submission system failure

**Steps**:

1. **Stop All Workers**:

```bash
# Stop background workers
pnpm tsx scripts/stop-sor-workers.ts --all
```

2. **Verify Data Integrity**:

```bash
# Check queue integrity
pnpm tsx scripts/verify-queue-integrity.ts

# Check audit trail
pnpm tsx scripts/verify-audit-integrity.ts --table=sor_export_queue
```

3. **Restore from Backup** (if needed):

```bash
# Restore queue table
pnpm tsx scripts/restore-table.ts --table=sor_export_queue --timestamp=[TIME]

# Verify restoration
pnpm tsx scripts/verify-restoration.ts --table=sor_export_queue
```

4. **Replay Failed Submissions**:

```bash
# Get all pending/failed items
pnpm tsx scripts/get-unsubmitted-sor.ts --output=unsubmitted.json

# Replay in batches
pnpm tsx scripts/replay-sor-submissions.ts --input=unsubmitted.json --batch-size=50
```

5. **Restart Workers**:

```bash
# Start workers with monitoring
pnpm tsx scripts/start-sor-workers.ts --count=5 --monitor=true
```

6. **Verify Recovery**:

```bash
# Check system health
pnpm tsx scripts/check-sor-health.ts

# Verify no data loss
pnpm tsx scripts/verify-sor-completeness.ts --period=7d
```

### Partial Recovery

**When**: Specific batch or time period failed

**Steps**:

1. **Identify Failed Period**:

```bash
# Get failed submissions for period
pnpm tsx scripts/get-failed-sor.ts --start=[TIME] --end=[TIME] --output=failed.json
```

2. **Regenerate SoRs**:

```bash
# Regenerate from original decisions
pnpm tsx scripts/regenerate-sor.ts --input=failed.json
```

3. **Resubmit**:

```bash
# Submit with priority
pnpm tsx scripts/submit-sor.ts --input=failed.json --priority=high
```

## Escalation

### When to Escalate

- DLQ count > 100
- Circuit breaker OPEN for > 1 hour
- Success rate < 95% for > 4 hours
- Any submission > 24 hours old
- Commission DB API down > 2 hours

### Escalation Path

1. **Level 1**: On-call engineer (immediate)
2. **Level 2**: Technical lead (15 minutes)
3. **Level 3**: Compliance officer (30 minutes)
4. **Level 4**: Legal counsel + Commission DB support (1 hour)

### Contact Information

```
On-call Engineer: [PAGERDUTY]
Technical Lead: [CONTACT]
Compliance Officer: [CONTACT]
Commission DB Support: transparency-database-support@ec.europa.eu
Legal Counsel: [CONTACT]
```

## Post-Incident

### Documentation

```markdown
# SoR Submission Failure - [DATE]

## Incident Summary

- Start Time: [TIME]
- End Time: [TIME]
- Duration: [HOURS]
- Affected Submissions: [COUNT]

## Root Cause

[DESCRIPTION]

## Impact

- Failed Submissions: [COUNT]
- Max Delay: [HOURS]
- Compliance Breach: [YES/NO]

## Resolution

[DESCRIPTION]

## Preventive Measures

- [ACTION 1]
- [ACTION 2]
```

### Compliance Reporting

```bash
# Generate incident report for transparency reporting
pnpm tsx scripts/generate-incident-report.ts --incident-id=[ID] --format=transparency

# Update annual transparency metrics
pnpm tsx scripts/update-transparency-metrics.ts --incident-id=[ID]
```

## Related Runbooks

- [Incident Response](./incident-response.md)
- [Audit Trail Recovery](./audit-trail-recovery.md)
- [API Integration Troubleshooting](./api-troubleshooting.md)

## References

- DSA Art. 24(5) - SoR Database Submission
- Commission Transparency Database API Documentation
- PII Scrubbing Algorithm Specification
- Circuit Breaker Pattern Documentation
