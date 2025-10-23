/**
 * Monitoring Alerts Generation
 * Extracted to keep functions under line limits
 */

import type {
  AuditIntegrityMetrics,
  CapacityMetrics,
  ErrorMetrics,
  MonitoringAlert,
  PerformanceMetrics,
} from './monitoring-service';

export function generateAlerts(metrics: {
  performance: PerformanceMetrics;
  errors: ErrorMetrics;
  auditIntegrity: AuditIntegrityMetrics;
  capacity: CapacityMetrics;
}): MonitoringAlert[] {
  const alerts: MonitoringAlert[] = [];

  // Performance alerts
  alerts.push(...generatePerformanceAlerts(metrics.performance));

  // Error alerts
  alerts.push(...generateErrorAlerts(metrics.errors));

  // Audit integrity alerts
  alerts.push(...generateAuditIntegrityAlerts(metrics.auditIntegrity));

  // Capacity alerts
  alerts.push(...generateCapacityAlerts(metrics.capacity));

  return alerts;
}

function generatePerformanceAlerts(
  performance: PerformanceMetrics
): MonitoringAlert[] {
  const alerts: MonitoringAlert[] = [];

  if (performance.report_submission_p95 > 5000) {
    alerts.push({
      id: `perf-report-${Date.now()}`,
      severity: 'warning',
      category: 'performance',
      message: 'Report submission P95 latency exceeds 5 seconds',
      metric_name: 'report_submission_p95',
      metric_value: performance.report_submission_p95,
      threshold: 5000,
      created_at: new Date(),
    });
  }

  if (performance.sla_compliance_rate < 95) {
    alerts.push({
      id: `perf-sla-${Date.now()}`,
      severity: 'error',
      category: 'performance',
      message: 'SLA compliance rate below 95%',
      metric_name: 'sla_compliance_rate',
      metric_value: performance.sla_compliance_rate,
      threshold: 95,
      created_at: new Date(),
    });
  }

  return alerts;
}

function generateErrorAlerts(errors: ErrorMetrics): MonitoringAlert[] {
  const alerts: MonitoringAlert[] = [];

  if (errors.critical_error_rate_percent > 1) {
    alerts.push({
      id: `error-critical-${Date.now()}`,
      severity: 'critical',
      category: 'error',
      message: 'Critical error rate exceeds 1%',
      metric_name: 'critical_error_rate_percent',
      metric_value: errors.critical_error_rate_percent,
      threshold: 1,
      created_at: new Date(),
    });
  }

  if (errors.dsa_submission_failures > 10) {
    alerts.push({
      id: `compliance-dsa-${Date.now()}`,
      severity: 'critical',
      category: 'compliance',
      message: 'High number of DSA submission failures',
      metric_name: 'dsa_submission_failures',
      metric_value: errors.dsa_submission_failures,
      threshold: 10,
      created_at: new Date(),
    });
  }

  return alerts;
}

function generateAuditIntegrityAlerts(
  auditIntegrity: AuditIntegrityMetrics
): MonitoringAlert[] {
  const alerts: MonitoringAlert[] = [];

  if (auditIntegrity.integrity_score < 99) {
    alerts.push({
      id: `audit-integrity-${Date.now()}`,
      severity: 'critical',
      category: 'audit_integrity',
      message: 'Audit integrity score below 99%',
      metric_name: 'integrity_score',
      metric_value: auditIntegrity.integrity_score,
      threshold: 99,
      created_at: new Date(),
    });
  }

  return alerts;
}

function generateCapacityAlerts(capacity: CapacityMetrics): MonitoringAlert[] {
  const alerts: MonitoringAlert[] = [];

  if (capacity.estimated_capacity_hours < 24) {
    alerts.push({
      id: `capacity-hours-${Date.now()}`,
      severity: 'warning',
      category: 'capacity',
      message: 'Estimated capacity less than 24 hours',
      metric_name: 'estimated_capacity_hours',
      metric_value: capacity.estimated_capacity_hours,
      threshold: 24,
      created_at: new Date(),
    });
  }

  if (capacity.moderator_utilization > 90) {
    alerts.push({
      id: `capacity-moderators-${Date.now()}`,
      severity: 'error',
      category: 'capacity',
      message: 'Moderator utilization exceeds 90%',
      metric_name: 'moderator_utilization',
      metric_value: capacity.moderator_utilization,
      threshold: 90,
      created_at: new Date(),
    });
  }

  return alerts;
}
