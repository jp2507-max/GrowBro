# Incident Response Runbook

## Overview

This runbook provides step-by-step procedures for responding to incidents in the GrowBro moderation system. It covers detection, triage, resolution, and post-incident activities.

## Incident Classification

### Severity Levels

#### P0 - Critical

- Complete system outage
- Data breach or security incident
- Regulatory compliance violation
- SLA breach affecting >100 users

#### P1 - High

- Partial system degradation
- SLA breach affecting 10-100 users
- Failed SoR submissions to Commission DB
- Audit trail integrity issues

#### P2 - Medium

- Performance degradation
- Non-critical feature failures
- Individual SLA breaches (<10 users)

#### P3 - Low

- Minor bugs
- Documentation issues
- Enhancement requests

## Incident Response Team

### Roles and Responsibilities

#### Incident Commander (IC)

- Overall incident coordination
- Communication with stakeholders
- Decision-making authority
- Post-incident review lead

#### Technical Lead

- Technical investigation
- Root cause analysis
- Implementation of fixes
- System recovery

#### Communications Lead

- User communications
- Regulatory notifications (if required)
- Status updates
- Documentation

#### Compliance Officer

- Regulatory impact assessment
- Legal consultation coordination
- Compliance documentation
- Authority notifications

### Contact Information

```
Incident Commander: [ON-CALL ROTATION]
Technical Lead: [ON-CALL ROTATION]
Communications Lead: [CONTACT]
Compliance Officer: [CONTACT]
DPO: [DPO_EMAIL from env]
Legal Counsel: [CONTACT]
```

## Incident Response Procedure

### Phase 1: Detection and Triage (0-15 minutes)

#### 1. Incident Detection

- Automated alerts (Sentry, monitoring dashboards)
- User reports
- Manual discovery
- Regulatory authority notification

#### 2. Initial Assessment

```bash
# Check system health
pnpm tsx scripts/check-system-health.ts

# Check SLA compliance
pnpm tsx scripts/check-sla-status.ts

# Check audit trail integrity
pnpm tsx scripts/verify-audit-integrity.ts
```

#### 3. Severity Classification

- Determine severity level (P0-P3)
- Identify affected systems and users
- Assess regulatory impact

#### 4. Incident Declaration

- Create incident ticket
- Notify incident response team
- Start incident log

### Phase 2: Containment (15-60 minutes)

#### 1. Immediate Actions

##### System Outage

```bash
# Check service status
kubectl get pods -n production

# Check database connectivity
psql -h [SUPABASE_HOST] -U postgres -c "SELECT 1"

# Check external service status
curl -I https://transparency-database.ec.europa.eu/api/health
```

##### Data Breach

```bash
# Isolate affected systems
# Preserve evidence
# Notify DPO immediately
# Begin breach assessment
```

##### SLA Breach

```bash
# Identify affected reports
pnpm tsx scripts/get-sla-breaches.ts

# Escalate to manual processing
pnpm tsx scripts/escalate-reports.ts --priority=critical
```

#### 2. Communication

- Notify affected users (if applicable)
- Update status page
- Inform stakeholders

### Phase 3: Investigation (1-4 hours)

#### 1. Root Cause Analysis

- Review logs and metrics
- Analyze audit trails
- Identify failure points
- Document findings

#### 2. Data Collection

```bash
# Export relevant logs
pnpm tsx scripts/export-incident-logs.ts --incident-id=[ID]

# Generate system state snapshot
pnpm tsx scripts/snapshot-system-state.ts

# Collect audit trail evidence
pnpm tsx scripts/export-audit-trail.ts --start=[TIME] --end=[TIME]
```

#### 3. Impact Assessment

- Count affected users
- Identify failed operations
- Calculate SLA impact
- Assess regulatory implications

### Phase 4: Resolution (4-24 hours)

#### 1. Implement Fix

- Deploy hotfix (if applicable)
- Manual intervention (if required)
- System recovery procedures
- Data restoration (if needed)

#### 2. Verification

```bash
# Verify system health
pnpm tsx scripts/check-system-health.ts

# Run compliance validation
pnpm tsx scripts/validate-dsa-compliance.ts

# Verify audit trail integrity
pnpm tsx scripts/verify-audit-integrity.ts
```

#### 3. Recovery Actions

##### Failed SoR Submissions

```bash
# Retry failed submissions
pnpm tsx scripts/retry-sor-submissions.ts --queue-status=failed

# Verify Commission DB connectivity
pnpm tsx scripts/test-dsa-api-connection.ts
```

##### Audit Trail Issues

```bash
# Verify partition integrity
pnpm tsx scripts/verify-partition-checksums.ts

# Restore from backup (if needed)
pnpm tsx scripts/restore-audit-partition.ts --partition=[MONTH]
```

### Phase 5: Post-Incident (24-72 hours)

#### 1. Post-Incident Review

- Schedule review meeting (within 48 hours)
- Document timeline
- Identify lessons learned
- Create action items

#### 2. Regulatory Notifications

##### Data Breach (GDPR Art. 33/34)

- Notify supervisory authority within 72 hours
- Notify affected users (if high risk)
- Document breach details

##### DSA Compliance Violation

- Assess notification requirements
- Consult legal counsel
- Prepare authority report

#### 3. Documentation

- Complete incident report
- Update runbooks
- Document preventive measures
- Archive evidence

#### 4. Follow-up Actions

- Implement preventive measures
- Update monitoring and alerts
- Conduct training (if needed)
- Schedule follow-up review

## Escalation Paths

### Technical Escalation

1. On-call engineer
2. Technical lead
3. Engineering manager
4. CTO

### Compliance Escalation

1. Compliance officer
2. DPO
3. Legal counsel
4. External counsel (if needed)

### Regulatory Escalation

1. Compliance officer
2. DPO
3. Legal counsel
4. Supervisory authority

## Communication Templates

### User Notification (System Outage)

```
Subject: Service Disruption - Moderation System

Dear GrowBro Community,

We are currently experiencing technical difficulties with our content moderation system. Our team is actively working to resolve the issue.

Impact: [DESCRIPTION]
Expected Resolution: [TIME]
Updates: [STATUS PAGE URL]

We apologize for the inconvenience.

GrowBro Team
```

### Regulatory Notification (Data Breach)

```
Subject: Personal Data Breach Notification - [INCIDENT ID]

To: [Supervisory Authority]

We are writing to notify you of a personal data breach affecting our moderation system.

Breach Details:
- Date/Time: [TIMESTAMP]
- Nature: [DESCRIPTION]
- Affected Data: [CATEGORIES]
- Affected Individuals: [COUNT]
- Measures Taken: [ACTIONS]

Full report attached.

[ORGANIZATION]
[DPO CONTACT]
```

## Incident Log Template

```markdown
# Incident Log - [INCIDENT ID]

**Severity**: [P0/P1/P2/P3]
**Status**: [OPEN/INVESTIGATING/RESOLVED/CLOSED]
**Started**: [TIMESTAMP]
**Resolved**: [TIMESTAMP]

## Timeline

- [TIME] - Incident detected
- [TIME] - Incident declared
- [TIME] - Team notified
- [TIME] - Containment actions started
- [TIME] - Root cause identified
- [TIME] - Fix deployed
- [TIME] - Incident resolved

## Impact

- Affected Users: [COUNT]
- Affected Systems: [LIST]
- SLA Breaches: [COUNT]
- Data Loss: [YES/NO]
- Regulatory Impact: [DESCRIPTION]

## Root Cause

[DESCRIPTION]

## Resolution

[DESCRIPTION]

## Preventive Measures

- [ACTION 1]
- [ACTION 2]

## Follow-up Actions

- [ ] [ACTION 1] - Owner: [NAME] - Due: [DATE]
- [ ] [ACTION 2] - Owner: [NAME] - Due: [DATE]
```

## Incident Metrics

Track the following metrics for continuous improvement:

- Mean Time to Detect (MTTD)
- Mean Time to Acknowledge (MTTA)
- Mean Time to Resolve (MTTR)
- Incident frequency by severity
- Root cause categories
- Preventive measure effectiveness

## Related Runbooks

- [SLA Breach Response](./sla-breach-response.md)
- [SoR Submission Failure](./sor-submission-failure.md)
- [Audit Trail Recovery](./audit-trail-recovery.md)
- [Security Incident Response](./security-incident-response.md)

## References

- [GDPR Art. 33 - Notification of breach to supervisory authority](https://gdpr-info.eu/art-33-gdpr/)
- [GDPR Art. 34 - Communication of breach to data subject](https://gdpr-info.eu/art-34-gdpr/)
- [DSA Transparency Reporting Requirements](https://digital-strategy.ec.europa.eu/en/policies/dsa-enforcement)
