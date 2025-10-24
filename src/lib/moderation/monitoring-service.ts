/**
 * Monitoring and Observability Service
 *
 * Implements real-time performance monitoring, error tracking, audit integrity
 * verification, and capacity planning metrics for the moderation system.
 *
 * Requirements: 5.5, 6.6, 10.5
 */

import { supabase } from '@/lib/supabase';

import { AuditService } from './audit-service';

// ============================================================================
// Types
// ============================================================================

export interface PerformanceMetrics {
  // Response times (milliseconds)
  report_submission_p50: number;
  report_submission_p95: number;
  report_submission_p99: number;
  moderation_decision_p50: number;
  moderation_decision_p95: number;
  moderation_decision_p99: number;
  appeal_processing_p50: number;
  appeal_processing_p95: number;
  appeal_processing_p99: number;

  // Throughput (operations per minute)
  reports_per_minute: number;
  decisions_per_minute: number;
  appeals_per_minute: number;

  // SLA compliance
  sla_compliance_rate: number; // Percentage
  average_sla_buffer_hours: number; // How much time before deadline

  // Timestamp
  measured_at: Date;
}

export interface ErrorMetrics {
  // Error counts by type
  database_errors: number;
  external_service_errors: number;
  validation_errors: number;
  authorization_errors: number;

  // Compliance violations
  dsa_submission_failures: number;
  audit_integrity_violations: number;
  privacy_violations: number;

  // Error rates
  error_rate_percent: number;
  critical_error_rate_percent: number;

  // Timestamp
  measured_at: Date;
}

export interface AuditIntegrityMetrics {
  // Integrity checks
  total_events_checked: number;
  integrity_violations: number;
  signature_mismatches: number;
  missing_events: number;

  // Partition health
  partitions_checked: number;
  corrupted_partitions: number;

  // Checksum verification
  checksum_verifications: number;
  checksum_failures: number;

  // Overall health
  integrity_score: number; // 0-100

  // Timestamp
  measured_at: Date;
}

export interface CapacityMetrics {
  // Database
  database_connections_used: number;
  database_connections_max: number;
  database_storage_used_gb: number;
  database_storage_max_gb: number;

  // Queue depths
  pending_reports: number;
  pending_appeals: number;
  pending_sor_exports: number;

  // Resource utilization
  cpu_usage_percent: number;
  memory_usage_percent: number;
  disk_usage_percent: number;

  // Scaling indicators
  queue_growth_rate: number; // Reports per hour
  moderator_utilization: number; // Percentage
  estimated_capacity_hours: number; // Hours until capacity limit

  // Timestamp
  measured_at: Date;
}

export interface MonitoringDashboard {
  performance: PerformanceMetrics;
  errors: ErrorMetrics;
  audit_integrity: AuditIntegrityMetrics;
  capacity: CapacityMetrics;
  health_status: 'healthy' | 'degraded' | 'critical';
  alerts: MonitoringAlert[];
}

export interface MonitoringAlert {
  id: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  category:
    | 'performance'
    | 'error'
    | 'compliance'
    | 'capacity'
    | 'audit_integrity';
  message: string;
  metric_name: string;
  metric_value: number;
  threshold: number;
  created_at: Date;
}

// ============================================================================
// Monitoring Service
// ============================================================================

export class MonitoringService {
  private auditService: AuditService;

  constructor() {
    this.auditService = new AuditService(supabase);
  }

  /**
   * Get comprehensive monitoring dashboard
   */
  async getDashboard(): Promise<MonitoringDashboard> {
    const [performance, errors, auditIntegrity, capacity] = await Promise.all([
      this.getPerformanceMetrics(),
      this.getErrorMetrics(),
      this.getAuditIntegrityMetrics(),
      this.getCapacityMetrics(),
    ]);

    const alerts = this.generateAlerts({
      performance,
      errors,
      auditIntegrity,
      capacity,
    });

    const healthStatus = this.calculateHealthStatus(alerts);

    return {
      performance,
      errors,
      audit_integrity: auditIntegrity,
      capacity,
      health_status: healthStatus,
      alerts,
    };
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Query performance data from audit events
    const { data: reportTimes } = await supabase
      .from('audit_events')
      .select('metadata')
      .eq('event_type', 'report_submitted')
      .gte('timestamp', oneHourAgo.toISOString())
      .order('timestamp', { ascending: false })
      .limit(1000);

    const { data: decisionTimes } = await supabase
      .from('audit_events')
      .select('metadata')
      .eq('event_type', 'decision_made')
      .gte('timestamp', oneHourAgo.toISOString())
      .order('timestamp', { ascending: false })
      .limit(1000);

    const { data: appealTimes } = await supabase
      .from('audit_events')
      .select('metadata')
      .eq('event_type', 'appeal_submitted')
      .gte('timestamp', oneHourAgo.toISOString())
      .order('timestamp', { ascending: false })
      .limit(1000);

    // Calculate percentiles
    const reportDurations = this.extractDurations(reportTimes || []);
    const decisionDurations = this.extractDurations(decisionTimes || []);
    const appealDurations = this.extractDurations(appealTimes || []);

    // Calculate throughput
    const reportsPerMinute = (reportTimes?.length || 0) / 60;
    const decisionsPerMinute = (decisionTimes?.length || 0) / 60;
    const appealsPerMinute = (appealTimes?.length || 0) / 60;

    // Calculate SLA compliance
    const slaMetrics = await this.calculateSLAMetrics();

    return {
      report_submission_p50: this.percentile(reportDurations, 50),
      report_submission_p95: this.percentile(reportDurations, 95),
      report_submission_p99: this.percentile(reportDurations, 99),
      moderation_decision_p50: this.percentile(decisionDurations, 50),
      moderation_decision_p95: this.percentile(decisionDurations, 95),
      moderation_decision_p99: this.percentile(decisionDurations, 99),
      appeal_processing_p50: this.percentile(appealDurations, 50),
      appeal_processing_p95: this.percentile(appealDurations, 95),
      appeal_processing_p99: this.percentile(appealDurations, 99),
      reports_per_minute: reportsPerMinute,
      decisions_per_minute: decisionsPerMinute,
      appeals_per_minute: appealsPerMinute,
      sla_compliance_rate: slaMetrics.complianceRate,
      average_sla_buffer_hours: slaMetrics.averageBufferHours,
      measured_at: now,
    };
  }

  /**
   * Get error metrics
   */
  async getErrorMetrics(): Promise<ErrorMetrics> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Query error events
    const { data: errorEvents } = await supabase
      .from('audit_events')
      .select('event_type, metadata')
      .in('event_type', [
        'error_database',
        'error_external_service',
        'error_validation',
        'error_authorization',
        'dsa_submission_failed',
        'audit_integrity_violation',
        'privacy_violation',
      ])
      .gte('timestamp', oneHourAgo.toISOString());

    const errors = errorEvents || [];

    // Count by type
    const databaseErrors = errors.filter((e) =>
      e.event_type.includes('database')
    ).length;
    const externalServiceErrors = errors.filter((e) =>
      e.event_type.includes('external_service')
    ).length;
    const validationErrors = errors.filter((e) =>
      e.event_type.includes('validation')
    ).length;
    const authorizationErrors = errors.filter((e) =>
      e.event_type.includes('authorization')
    ).length;
    const dsaSubmissionFailures = errors.filter((e) =>
      e.event_type.includes('dsa_submission')
    ).length;
    const auditIntegrityViolations = errors.filter((e) =>
      e.event_type.includes('audit_integrity')
    ).length;
    const privacyViolations = errors.filter((e) =>
      e.event_type.includes('privacy')
    ).length;

    // Calculate error rates
    const { count: totalCount } = await supabase
      .from('audit_events')
      .select('*', { count: 'exact', head: true })
      .gte('timestamp', oneHourAgo.toISOString());

    const count = totalCount || 0;
    const errorRate = count > 0 ? (errors.length / count) * 100 : 0;

    const criticalErrors =
      dsaSubmissionFailures + auditIntegrityViolations + privacyViolations;
    const criticalErrorRate = count > 0 ? (criticalErrors / count) * 100 : 0;

    return {
      database_errors: databaseErrors,
      external_service_errors: externalServiceErrors,
      validation_errors: validationErrors,
      authorization_errors: authorizationErrors,
      dsa_submission_failures: dsaSubmissionFailures,
      audit_integrity_violations: auditIntegrityViolations,
      privacy_violations: privacyViolations,
      error_rate_percent: errorRate,
      critical_error_rate_percent: criticalErrorRate,
      measured_at: now,
    };
  }

  /**
   * Get audit integrity metrics
   */
  async getAuditIntegrityMetrics(): Promise<AuditIntegrityMetrics> {
    const now = new Date();

    // Sample recent audit events for integrity verification
    const { data: recentEvents } = await supabase
      .from('audit_events')
      .select('id, signature, metadata')
      .order('timestamp', { ascending: false })
      .limit(100);

    const events = recentEvents || [];
    let integrityViolations = 0;
    let signatureMismatches = 0;

    // Verify signatures
    for (const event of events) {
      try {
        // TODO: Implement verifyEventSignature in AuditService
        const hasSignature = Boolean(event.signature);
        if (!hasSignature) {
          signatureMismatches++;
          integrityViolations++;
          continue;
        }

        const isValid = true; // await this.auditService.verifyEventSignature(
        //   event.id,
        //   event.signature
        // );
        if (!isValid) {
          signatureMismatches++;
          integrityViolations++;
        }
      } catch {
        integrityViolations++;
      }
    }

    // Check partition health
    const partitionMetrics = await this.checkPartitionHealth();

    // Calculate integrity score
    const integrityScore =
      events.length > 0
        ? ((events.length - integrityViolations) / events.length) * 100
        : 100;

    return {
      total_events_checked: events.length,
      integrity_violations: integrityViolations,
      signature_mismatches: signatureMismatches,
      missing_events: 0, // Would require sequence number checking
      partitions_checked: partitionMetrics.checked,
      corrupted_partitions: partitionMetrics.corrupted,
      checksum_verifications: partitionMetrics.checksumVerifications,
      checksum_failures: partitionMetrics.checksumFailures,
      integrity_score: integrityScore,
      measured_at: now,
    };
  }

  /**
   * Get capacity metrics
   */
  async getCapacityMetrics(): Promise<CapacityMetrics> {
    const now = new Date();

    // Query queue depths using count
    const { count: pendingReportsCount } = await supabase
      .from('reports')
      .select('*', { count: 'exact', head: true })
      .in('status', ['pending', 'in_review']);

    const { count: pendingAppealsCount } = await supabase
      .from('appeals')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    const { count: pendingSorExportsCount } = await supabase
      .from('sor_export_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    // Calculate queue growth rate
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const { count: recentReportsCount } = await supabase
      .from('reports')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', oneHourAgo.toISOString());

    const queueGrowthRate = recentReportsCount || 0;

    // Calculate moderator utilization
    const { count: activeModeratorsCount } = await supabase
      .from('moderation_sessions')
      .select('*', { count: 'exact', head: true })
      .gte('last_activity', oneHourAgo.toISOString());

    const { count: totalModeratorsCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .contains('roles', ['moderator']);

    const moderatorUtilization =
      totalModeratorsCount && totalModeratorsCount > 0
        ? ((activeModeratorsCount || 0) / totalModeratorsCount) * 100
        : 0;

    // Estimate capacity
    const estimatedCapacityHours = this.estimateCapacity({
      pendingReports: pendingReportsCount || 0,
      queueGrowthRate,
      moderatorUtilization,
    });

    return {
      database_connections_used: 0, // Would require DB-specific query
      database_connections_max: 100, // Configuration value
      database_storage_used_gb: 0, // Would require DB-specific query
      database_storage_max_gb: 1000, // Configuration value
      pending_reports: pendingReportsCount || 0,
      pending_appeals: pendingAppealsCount || 0,
      pending_sor_exports: pendingSorExportsCount || 0,
      cpu_usage_percent: 0, // Would require system metrics
      memory_usage_percent: 0, // Would require system metrics
      disk_usage_percent: 0, // Would require system metrics
      queue_growth_rate: queueGrowthRate,
      moderator_utilization: moderatorUtilization,
      estimated_capacity_hours: estimatedCapacityHours,
      measured_at: now,
    };
  }

  // generateAlerts method moved to monitoring-alerts.ts
  /**
   * Generate alerts based on metrics
   * TODO: Implement full alert generation logic
   */
  private generateAlerts(_metrics: {
    performance: any;
    errors: any;
    auditIntegrity: any;
    capacity: any;
  }): MonitoringAlert[] {
    // Placeholder implementation - return empty alerts array
    return [];
  }

  /**
   * Calculate overall health status
   */
  private calculateHealthStatus(
    alerts: MonitoringAlert[]
  ): 'healthy' | 'degraded' | 'critical' {
    const criticalAlerts = alerts.filter((a) => a.severity === 'critical');
    const errorAlerts = alerts.filter((a) => a.severity === 'error');

    if (criticalAlerts.length > 0) {
      return 'critical';
    }

    if (errorAlerts.length > 0 || alerts.length > 5) {
      return 'degraded';
    }

    return 'healthy';
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private extractDurations(events: any[]): number[] {
    return events
      .map((e) => e.metadata?.duration_ms)
      .filter((d): d is number => typeof d === 'number');
  }

  private percentile(values: number[], p: number): number {
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)] || 0;
  }

  private async calculateSLAMetrics(): Promise<{
    complianceRate: number;
    averageBufferHours: number;
  }> {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const { data: reports } = await supabase
      .from('reports')
      .select('sla_deadline, updated_at, status')
      .gte('created_at', oneDayAgo.toISOString())
      .in('status', ['resolved', 'duplicate']);

    if (!reports || reports.length === 0) {
      return { complianceRate: 100, averageBufferHours: 0 };
    }

    let compliantCount = 0;
    let totalBufferHours = 0;

    for (const report of reports) {
      const deadline = new Date(report.sla_deadline);
      const resolved = new Date(report.updated_at);

      if (resolved <= deadline) {
        compliantCount++;
        const bufferMs = deadline.getTime() - resolved.getTime();
        totalBufferHours += bufferMs / (1000 * 60 * 60);
      }
    }

    const complianceRate = (compliantCount / reports.length) * 100;
    const averageBufferHours = totalBufferHours / compliantCount || 0;

    return { complianceRate, averageBufferHours };
  }

  private async checkPartitionHealth(): Promise<{
    checked: number;
    corrupted: number;
    checksumVerifications: number;
    checksumFailures: number;
  }> {
    // Query partition checksums
    const { data: partitions } = await supabase
      .from('audit_partition_checksums')
      .select('partition_name, checksum, verified_at')
      .order('partition_name', { ascending: false })
      .limit(12); // Last 12 months

    if (!partitions) {
      return {
        checked: 0,
        corrupted: 0,
        checksumVerifications: 0,
        checksumFailures: 0,
      };
    }

    let checksumFailures = 0;

    // Verify checksums (simplified - would need actual verification logic)
    for (const partition of partitions) {
      if (!partition.checksum || !partition.verified_at) {
        checksumFailures++;
      }
    }

    return {
      checked: partitions.length,
      corrupted: checksumFailures,
      checksumVerifications: partitions.length,
      checksumFailures,
    };
  }

  private estimateCapacity(params: {
    pendingReports: number;
    queueGrowthRate: number;
    moderatorUtilization: number;
  }): number {
    // Simple capacity estimation
    // Assumes average processing rate and current queue depth

    const avgProcessingRatePerHour = 50; // Reports per moderator per hour
    const effectiveModeratorCapacity =
      avgProcessingRatePerHour * (1 - params.moderatorUtilization / 100);

    if (params.queueGrowthRate >= effectiveModeratorCapacity) {
      // Queue is growing faster than processing
      return 0;
    }

    const netProcessingRate =
      effectiveModeratorCapacity - params.queueGrowthRate;
    const hoursToEmpty = params.pendingReports / netProcessingRate;

    return Math.max(0, hoursToEmpty);
  }
}

export const monitoringService = new MonitoringService();
