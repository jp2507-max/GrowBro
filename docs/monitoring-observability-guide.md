## Monitoring and Observability Guide

Comprehensive guide for monitoring the DSA-compliant moderation system.

## Overview

The monitoring and observability system provides real-time insights into:

- **Performance**: Response times, throughput, SLA compliance
- **Errors**: Error rates, compliance violations, system failures
- **Audit Integrity**: Cryptographic verification, partition health
- **Capacity**: Queue depths, resource utilization, scaling indicators

## Architecture

### Components

1. **MonitoringService** (`src/lib/moderation/monitoring-service.ts`)
   - Collects and aggregates metrics
   - Generates alerts based on thresholds
   - Calculates health status

2. **AlertingService** (`src/lib/moderation/alerting-service.ts`)
   - Manages alert delivery
   - Handles escalation workflows
   - Tracks acknowledgments

3. **Monitoring Dashboard** (`src/components/moderation/monitoring-dashboard.tsx`)
   - Real-time visualization
   - Auto-refresh every 30 seconds
   - Mobile-optimized UI

### Database Tables

- `monitoring_alerts`: Stores generated alerts
- `alert_rules`: Defines alert thresholds and channels
- `alert_notifications`: Tracks notification delivery
- `alert_escalations`: Manages escalation workflow
- `performance_metrics`: Time-series performance data
- `capacity_metrics`: Time-series capacity data
- `audit_partition_checksums`: Partition integrity checksums
- `moderation_sessions`: Active moderator sessions

## Metrics

### Performance Metrics

#### Response Times (Percentiles)

- **report_submission_p50/p95/p99**: Report submission latency
- **moderation_decision_p50/p95/p99**: Decision processing latency
- **appeal_processing_p50/p95/p99**: Appeal processing latency

**Thresholds:**

- P95 < 5 seconds (warning if exceeded)
- P99 < 10 seconds (error if exceeded)

#### Throughput

- **reports_per_minute**: Report submission rate
- **decisions_per_minute**: Decision processing rate
- **appeals_per_minute**: Appeal processing rate

**Thresholds:**

- Monitor for sudden drops (>50% decrease)

#### SLA Compliance

- **sla_compliance_rate**: Percentage of reports resolved within SLA
- **average_sla_buffer_hours**: Average time before SLA deadline

**Thresholds:**

- Compliance rate > 95% (error if below)
- Buffer > 2 hours (warning if below)

### Error Metrics

#### Error Counts

- **database_errors**: Database connectivity/query failures
- **external_service_errors**: External API failures
- **validation_errors**: Input validation failures
- **authorization_errors**: Permission denied errors

#### Compliance Violations

- **dsa_submission_failures**: Failed DSA Transparency DB submissions
- **audit_integrity_violations**: Audit trail integrity failures
- **privacy_violations**: GDPR/privacy policy violations

**Thresholds:**

- DSA failures > 10/hour (critical)
- Audit violations > 0 (critical)
- Privacy violations > 0 (critical)

#### Error Rates

- **error_rate_percent**: Overall error rate
- **critical_error_rate_percent**: Critical error rate

**Thresholds:**

- Error rate > 5% (warning)
- Critical error rate > 1% (critical)

### Audit Integrity Metrics

#### Verification

- **total_events_checked**: Number of events verified
- **integrity_violations**: Failed integrity checks
- **signature_mismatches**: Invalid cryptographic signatures
- **missing_events**: Sequence gaps detected

**Thresholds:**

- Integrity score < 99% (critical)
- Any signature mismatch (critical)

#### Partition Health

- **partitions_checked**: Number of partitions verified
- **corrupted_partitions**: Partitions with checksum failures
- **checksum_verifications**: Total checksum verifications
- **checksum_failures**: Failed checksum verifications

**Thresholds:**

- Any corrupted partition (critical)

### Capacity Metrics

#### Queue Depths

- **pending_reports**: Reports awaiting moderation
- **pending_appeals**: Appeals awaiting review
- **pending_sor_exports**: SoRs awaiting export

**Thresholds:**

- Pending reports > 1000 (warning)
- Pending appeals > 100 (warning)

#### Resource Utilization

- **moderator_utilization**: Percentage of active moderators
- **queue_growth_rate**: Reports added per hour
- **estimated_capacity_hours**: Hours until capacity limit

**Thresholds:**

- Moderator utilization > 90% (error)
- Capacity < 24 hours (warning)
- Capacity < 4 hours (critical)

## Alert Rules

### Default Rules

1. **High Report Submission Latency**
   - Metric: `report_submission_p95`
   - Condition: > 5000ms
   - Severity: Warning
   - Channels: Email, Slack
   - Cooldown: 30 minutes

2. **Low SLA Compliance**
   - Metric: `sla_compliance_rate`
   - Condition: < 95%
   - Severity: Error
   - Channels: Email, Slack
   - Cooldown: 60 minutes

3. **High Critical Error Rate**
   - Metric: `critical_error_rate_percent`
   - Condition: > 1%
   - Severity: Critical
   - Channels: Email, Slack, PagerDuty
   - Cooldown: 15 minutes

4. **DSA Submission Failures**
   - Metric: `dsa_submission_failures`
   - Condition: > 10
   - Severity: Critical
   - Channels: Email, Slack
   - Cooldown: 30 minutes

5. **Low Audit Integrity**
   - Metric: `integrity_score`
   - Condition: < 99%
   - Severity: Critical
   - Channels: Email, Slack, PagerDuty
   - Cooldown: 15 minutes

6. **Low Capacity**
   - Metric: `estimated_capacity_hours`
   - Condition: < 24
   - Severity: Warning
   - Channels: Email, Slack
   - Cooldown: 60 minutes

7. **High Moderator Utilization**
   - Metric: `moderator_utilization`
   - Condition: > 90%
   - Severity: Error
   - Channels: Email, Slack
   - Cooldown: 30 minutes

### Custom Rules

Create custom alert rules via the admin interface or API:

```typescript
import { supabase } from '@/lib/supabase';

await supabase.from('alert_rules').insert({
  name: 'Custom Alert',
  metric_name: 'custom_metric',
  condition: 'greater_than',
  threshold: 100,
  severity: 'warning',
  notification_channels: ['email', 'slack'],
  cooldown_minutes: 30,
  enabled: true,
});
```

## Notification Channels

### Email

Configure email alerts via environment variables:

```bash
ALERT_EMAIL=alerts@growbro.app
```

### Slack

Configure Slack webhook URL:

```bash
ALERT_SLACK_WEBHOOK=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

### PagerDuty

Configure PagerDuty integration key:

```bash
ALERT_PAGERDUTY_KEY=your-pagerduty-integration-key
```

### Webhook

Configure custom webhook URL:

```bash
ALERT_WEBHOOK_URL=https://your-webhook-endpoint.com/alerts
```

## Escalation Workflow

### Escalation Chains

Critical alerts automatically escalate through defined chains:

1. **Performance Issues**
   - Level 1: Team Lead
   - Level 2: Engineering Manager

2. **Error Issues**
   - Level 1: On-Call Engineer
   - Level 2: Engineering Manager

3. **Compliance Issues**
   - Level 1: Compliance Officer
   - Level 2: Legal Team
   - Level 3: CEO

4. **Capacity Issues**
   - Level 1: DevOps Team
   - Level 2: Engineering Manager

5. **Audit Integrity Issues**
   - Level 1: Security Team
   - Level 2: Compliance Officer
   - Level 3: CEO

### Escalation Timing

- **Level 1**: Immediate notification
- **Level 2**: 15 minutes if not acknowledged
- **Level 3**: 30 minutes if not acknowledged

### Acknowledgment

Acknowledge alerts to stop escalation:

```typescript
import { alertingService } from '@/lib/moderation/alerting-service';

await alertingService.acknowledgeAlert(
  'alert-id',
  1, // escalation level
  'moderator-id'
);
```

## Dashboard Access

### Web Dashboard

Access the monitoring dashboard at:

```
https://app.growbro.com/moderation/monitoring
```

### Mobile Dashboard

The monitoring dashboard is available in the React Native app for moderators with admin privileges.

### API Access

Query metrics programmatically:

```typescript
import { monitoringService } from '@/lib/moderation/monitoring-service';

// Get full dashboard
const dashboard = await monitoringService.getDashboard();

// Get specific metrics
const performance = await monitoringService.getPerformanceMetrics();
const errors = await monitoringService.getErrorMetrics();
const auditIntegrity = await monitoringService.getAuditIntegrityMetrics();
const capacity = await monitoringService.getCapacityMetrics();
```

## Integration with External Tools

### DataDog

Export metrics to DataDog:

```typescript
// In production, integrate with DataDog API
import { datadogLogs } from '@datadog/browser-logs';

datadogLogs.logger.info('Monitoring metric', {
  metric_name: 'sla_compliance_rate',
  value: 98.5,
  timestamp: new Date(),
});
```

### Prometheus

Expose metrics in Prometheus format:

```typescript
// Create Prometheus exporter endpoint
app.get('/metrics', async (req, res) => {
  const metrics = await monitoringService.getPerformanceMetrics();

  res.set('Content-Type', 'text/plain');
  res.send(`
# HELP report_submission_p95 Report submission P95 latency
# TYPE report_submission_p95 gauge
report_submission_p95 ${metrics.report_submission_p95}

# HELP sla_compliance_rate SLA compliance rate
# TYPE sla_compliance_rate gauge
sla_compliance_rate ${metrics.sla_compliance_rate}
  `);
});
```

### CloudWatch

Export metrics to AWS CloudWatch:

```typescript
import { CloudWatch } from 'aws-sdk';

const cloudwatch = new CloudWatch();

await cloudwatch
  .putMetricData({
    Namespace: 'GrowBro/Moderation',
    MetricData: [
      {
        MetricName: 'SLAComplianceRate',
        Value: metrics.sla_compliance_rate,
        Unit: 'Percent',
        Timestamp: new Date(),
      },
    ],
  })
  .promise();
```

## Troubleshooting

### High Latency

**Symptoms:**

- P95 latency > 5 seconds
- Slow dashboard loading

**Diagnosis:**

1. Check database connection pool
2. Review slow query logs
3. Check external service health

**Resolution:**

1. Scale database connections
2. Optimize slow queries
3. Implement caching
4. Add read replicas

### Low SLA Compliance

**Symptoms:**

- Compliance rate < 95%
- Frequent SLA breach alerts

**Diagnosis:**

1. Check moderator availability
2. Review queue depths
3. Analyze report complexity

**Resolution:**

1. Add moderator capacity
2. Adjust SLA targets
3. Implement priority queues
4. Automate simple decisions

### Audit Integrity Violations

**Symptoms:**

- Integrity score < 99%
- Signature mismatches

**Diagnosis:**

1. Check audit database health
2. Review recent migrations
3. Verify signing key rotation

**Resolution:**

1. Restore from backup
2. Re-verify affected partitions
3. Rotate signing keys
4. Contact security team

### Capacity Issues

**Symptoms:**

- Estimated capacity < 24 hours
- High moderator utilization

**Diagnosis:**

1. Check queue growth rate
2. Review moderator schedules
3. Analyze report patterns

**Resolution:**

1. Add moderator shifts
2. Implement auto-scaling
3. Defer non-critical tasks
4. Optimize processing workflows

## Best Practices

### Monitoring

1. **Set Realistic Thresholds**: Base thresholds on historical data
2. **Avoid Alert Fatigue**: Use cooldown periods and severity levels
3. **Monitor Trends**: Track metrics over time, not just current values
4. **Test Alerts**: Regularly test alert delivery and escalation

### Performance

1. **Optimize Queries**: Use indexes and query optimization
2. **Cache Metrics**: Cache dashboard data for 30 seconds
3. **Batch Operations**: Batch database queries where possible
4. **Use Read Replicas**: Offload monitoring queries to replicas

### Compliance

1. **Audit Regularly**: Verify audit integrity daily
2. **Document Incidents**: Log all compliance violations
3. **Review Alerts**: Weekly review of alert patterns
4. **Update Thresholds**: Adjust thresholds based on compliance requirements

### Capacity Planning

1. **Monitor Trends**: Track queue growth over weeks/months
2. **Plan Ahead**: Scale before reaching capacity limits
3. **Load Test**: Regular load testing to validate capacity
4. **Document Scaling**: Document scaling procedures and triggers

## Support

For monitoring issues or questions:

- **Email**: monitoring@growbro.app
- **Slack**: #moderation-monitoring
- **On-Call**: PagerDuty escalation

## References

- [SLA Monitoring Service](../src/lib/moderation/sla-monitor-service.ts)
- [Audit Service](../src/lib/moderation/audit-service.ts)
- [Graceful Degradation](../src/lib/moderation/graceful-degradation.ts)
- [DSA Compliance Guide](./audit-compliance-guide.md)
