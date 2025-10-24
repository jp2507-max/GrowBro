# SLA Breach Response Runbook

## Overview

This runbook provides procedures for responding to Service Level Agreement (SLA) breaches in the moderation system, ensuring compliance with DSA "act expeditiously" requirements.

## SLA Definitions

### Report Processing SLAs

| Priority     | Content Type      | Target Time | Alert Threshold |
| ------------ | ----------------- | ----------- | --------------- |
| **Critical** | CSAM, Self-harm   | Immediate   | N/A             |
| **Urgent**   | Credible threats  | 1 hour      | 45 minutes      |
| **High**     | Illegal content   | 24 hours    | 18 hours (75%)  |
| **Medium**   | Policy violations | 72 hours    | 54 hours (75%)  |

### Appeal Processing SLAs

| Appeal Type     | Target Time | Alert Threshold |
| --------------- | ----------- | --------------- |
| Content removal | 72 hours    | 54 hours (75%)  |
| Account action  | 72 hours    | 54 hours (75%)  |
| Geo-restriction | 48 hours    | 36 hours (75%)  |

### SoR Submission SLAs

| Metric         | Target     | Alert Threshold |
| -------------- | ---------- | --------------- |
| Time to submit | <1 hour    | 45 minutes      |
| P95 latency    | <5 seconds | 4 seconds       |
| Success rate   | >99%       | <98%            |

## Detection and Alerting

### Automated Monitoring

**SLA Monitor Service** runs continuously:

```typescript
// Automatic checks every 5 minutes
slaMonitor.checkPendingReports();
slaMonitor.checkPendingAppeals();
slaMonitor.checkSoRSubmissions();
```

**Alert Triggers**:

- 75% threshold: Warning alert to moderator team
- 90% threshold: Escalation alert to supervisor
- 100% breach: Critical alert to incident commander

### Manual Checks

```bash
# Check current SLA status
pnpm tsx scripts/check-sla-status.ts

# Get reports approaching SLA deadline
pnpm tsx scripts/get-sla-warnings.ts --threshold=75

# Get breached reports
pnpm tsx scripts/get-sla-breaches.ts
```

## Response Procedures

### Phase 1: Immediate Response (0-15 minutes)

**1. Acknowledge Alert**

```bash
# Acknowledge SLA alert
pnpm tsx scripts/acknowledge-alert.ts --alert-id=[ID]
```

**2. Assess Scope**

```bash
# Get breach details
pnpm tsx scripts/get-breach-details.ts --report-id=[ID]

# Check queue depth
pnpm tsx scripts/get-queue-stats.ts

# Identify bottlenecks
pnpm tsx scripts/analyze-queue-bottlenecks.ts
```

**3. Classify Breach Type**

**Type A: Single Report Breach**

- Individual report exceeded SLA
- Likely due to complexity or oversight
- Action: Manual escalation

**Type B: Queue Backlog**

- Multiple reports approaching/exceeding SLA
- System capacity issue
- Action: Resource scaling

**Type C: System Failure**

- Technical failure preventing processing
- Action: Incident response

### Phase 2: Escalation (15-30 minutes)

**For Type A (Single Report)**:

```bash
# Escalate to supervisor
pnpm tsx scripts/escalate-report.ts --report-id=[ID] --priority=critical

# Assign to senior moderator
pnpm tsx scripts/assign-report.ts --report-id=[ID] --moderator-id=[SENIOR_MOD]

# Notify moderator team
pnpm tsx scripts/notify-team.ts --message="SLA breach on report [ID] - requires immediate attention"
```

**For Type B (Queue Backlog)**:

```bash
# Scale moderator assignments
pnpm tsx scripts/scale-moderator-capacity.ts --increase=50%

# Redistribute queue
pnpm tsx scripts/rebalance-queue.ts

# Activate backup moderators
pnpm tsx scripts/activate-backup-moderators.ts
```

**For Type C (System Failure)**:

```bash
# Trigger incident response
pnpm tsx scripts/create-incident.ts --severity=P1 --type=sla_breach

# Follow incident response runbook
# See: docs/runbooks/incident-response.md
```

### Phase 3: Manual Processing (30 minutes - 4 hours)

**1. Priority Processing**

For **Critical/Urgent** reports:

```bash
# Move to fast lane
pnpm tsx scripts/move-to-fast-lane.ts --report-id=[ID]

# Assign to available moderator immediately
pnpm tsx scripts/assign-immediate.ts --report-id=[ID]

# Set auto-escalation timer (15 minutes)
pnpm tsx scripts/set-escalation-timer.ts --report-id=[ID] --minutes=15
```

For **Illegal Content**:

```bash
# Verify jurisdiction and legal reference
# Consult policy catalog
# Require supervisor approval if needed

# Process decision
pnpm tsx scripts/process-decision.ts --report-id=[ID] --decision=[ACTION]
```

**2. Batch Processing**

For queue backlog:

```bash
# Get all breached reports
pnpm tsx scripts/get-sla-breaches.ts --output=json > breached-reports.json

# Batch assign to team
pnpm tsx scripts/batch-assign.ts --input=breached-reports.json --team=all

# Monitor progress
watch -n 60 'pnpm tsx scripts/get-queue-stats.ts'
```

**3. Communication**

Notify affected users:

```bash
# Generate user notifications
pnpm tsx scripts/notify-users.ts --report-ids=[IDS] --template=sla_delay

# Log communications
pnpm tsx scripts/log-communications.ts --type=sla_notification
```

### Phase 4: Root Cause Analysis (4-24 hours)

**1. Data Collection**

```bash
# Export SLA metrics for period
pnpm tsx scripts/export-sla-metrics.ts --start=[TIME] --end=[TIME]

# Analyze moderator workload
pnpm tsx scripts/analyze-moderator-workload.ts --period=7d

# Check system performance
pnpm tsx scripts/check-system-performance.ts --period=24h
```

**2. Identify Root Cause**

Common causes:

- **Insufficient moderator capacity**: Hire/train more moderators
- **Complex cases requiring research**: Improve policy documentation
- **Technical issues**: System optimization needed
- **Spike in reports**: Implement auto-scaling
- **Trusted flagger misuse**: Review flagger quality

**3. Document Findings**

```markdown
# SLA Breach Analysis - [DATE]

## Breach Summary

- Total Breaches: [COUNT]
- Affected Reports: [IDS]
- Average Delay: [HOURS]
- Max Delay: [HOURS]

## Root Cause

[DESCRIPTION]

## Contributing Factors

- [FACTOR 1]
- [FACTOR 2]

## Impact

- Users Affected: [COUNT]
- Regulatory Risk: [LOW/MEDIUM/HIGH]
- Reputation Impact: [DESCRIPTION]
```

### Phase 5: Preventive Measures (24-72 hours)

**1. Immediate Fixes**

```bash
# Adjust SLA thresholds (if needed)
pnpm tsx scripts/update-sla-config.ts --priority=high --hours=20

# Increase alert lead time
pnpm tsx scripts/update-alert-thresholds.ts --warning=70 --critical=85

# Add capacity
pnpm tsx scripts/add-moderator-capacity.ts --count=5
```

**2. Long-term Improvements**

**Capacity Planning**:

- Analyze historical trends
- Forecast report volume
- Plan moderator hiring
- Implement auto-scaling

**Process Optimization**:

- Streamline decision workflows
- Improve policy documentation
- Enhance moderator training
- Automate routine decisions (with human oversight)

**Technical Improvements**:

- Optimize queue algorithms
- Improve priority classification
- Enhance duplicate detection
- Implement predictive analytics

**3. Update Monitoring**

```bash
# Add new alerts
pnpm tsx scripts/add-sla-alert.ts --metric=queue_depth --threshold=100

# Configure dashboards
pnpm tsx scripts/update-dashboard.ts --add-panel=sla_trends
```

## Compliance Documentation

### DSA Compliance

**"Act Expeditiously" Requirement**:

- Document all SLA breaches
- Maintain audit trail of escalations
- Report in annual transparency report
- Demonstrate continuous improvement

**Required Documentation**:

```bash
# Generate compliance report
pnpm tsx scripts/generate-sla-compliance-report.ts --period=monthly

# Export for transparency reporting
pnpm tsx scripts/export-transparency-metrics.ts --metric=sla_performance
```

### Regulatory Notifications

**When to Notify Authorities**:

- Systematic SLA failures (>10% breach rate)
- Illegal content processing delays (>24 hours)
- CSAM/self-harm content delays (>1 hour)

**Notification Template**:

```text
Subject: SLA Performance Report - [PERIOD]

To: [Digital Service Coordinator]

We are reporting SLA performance for the period [START] to [END]:

- Total Reports: [COUNT]
- SLA Breaches: [COUNT] ([PERCENTAGE]%)
- Average Processing Time: [HOURS]
- Corrective Actions: [DESCRIPTION]

Detailed report attached.

[ORGANIZATION]
[COMPLIANCE OFFICER]
```

## Escalation Matrix

| Breach Severity              | Escalation Level     | Notification      |
| ---------------------------- | -------------------- | ----------------- |
| Single breach (non-critical) | Moderator supervisor | Email             |
| Multiple breaches (3+)       | Moderation manager   | Email + Slack     |
| Critical content breach      | Compliance officer   | Immediate call    |
| Systematic failures (>10%)   | Executive team       | Emergency meeting |

## Metrics and Reporting

### Track These Metrics

**SLA Performance**:

- Breach rate by priority
- Average processing time
- P95/P99 processing time
- Escalation frequency

**Queue Health**:

- Queue depth over time
- Average wait time
- Moderator utilization
- Backlog trends

**Compliance**:

- DSA "act expeditiously" compliance rate
- Transparency reporting metrics
- Audit trail completeness

### Reporting Schedule

- **Daily**: SLA dashboard review
- **Weekly**: Breach analysis and trends
- **Monthly**: Compliance report generation
- **Quarterly**: Capacity planning review
- **Annually**: Transparency report submission

## Related Runbooks

- [Incident Response](./incident-response.md)
- [Queue Management](./queue-management.md)
- [Moderator Escalation](./moderator-escalation.md)

## References

- DSA Art. 16 - Notice-and-Action Mechanisms
- Internal SLA Policy Document
- Moderation Team Procedures
- Transparency Reporting Requirements
