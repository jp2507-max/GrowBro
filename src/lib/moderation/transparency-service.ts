/**
 * Transparency Service - DSA Arts. 15 & 24 Compliance
 *
 * Implements:
 * - Annual transparency report generation with DSA metrics
 * - Real-time metrics dashboard for supervisors
 * - Structured export formats for authority requests
 * - ODS case tracking and outcome reporting
 *
 * DSA Compliance: Arts. 15 & 24 (Transparency Reporting)
 * Requirements: 6.3, 6.5, 13.2, 13.7
 */

import { type SupabaseClient } from '@supabase/supabase-js';

import { getODSStatistics } from './ods-integration';

// ============================================================================
// Types
// ============================================================================

export interface TransparencyReportPeriod {
  startDate: Date;
  endDate: Date;
  year: number;
}

export interface NoticeMetrics {
  totalNotices: number;
  illegalContentNotices: number;
  policyViolationNotices: number;
  noticesByCategory: Record<string, number>;
  averageHandlingTimeHours: number;
  trustedFlaggerNotices: number;
}

export interface DecisionMetrics {
  totalDecisions: number;
  actionBreakdown: Record<string, number>;
  averageDecisionTimeHours: number;
  supervisorApprovalRate: number;
}

export interface AppealMetrics {
  totalAppeals: number;
  upheldAppeals: number;
  rejectedAppeals: number;
  reversalRate: number;
  averageResolutionDays: number;
}

export interface ODSMetrics {
  totalEscalations: number;
  resolved: number;
  pending: number;
  averageResolutionDays: number;
  outcomeBreakdown: Record<string, number>;
  upholdsReversed: number;
}

export interface RepeatOffenderMetrics {
  totalRepeatOffenders: number;
  suspensionsByLevel: Record<string, number>;
  manifestlyUnfoundedReporters: number;
}

export interface TrustedFlaggerMetrics {
  totalTrustedFlaggers: number;
  activeCount: number;
  suspendedCount: number;
  revokedCount: number;
  averageAccuracyRate: number;
  totalReportsProcessed: number;
}

export interface SoRSubmissionMetrics {
  totalSubmissions: number;
  successfulSubmissions: number;
  failedSubmissions: number;
  averageSubmissionTimeMinutes: number;
  p95SubmissionTimeMinutes: number;
}

export interface AnnualTransparencyReport {
  period: TransparencyReportPeriod;
  generatedAt: Date;
  platformInfo: {
    name: string;
    jurisdiction: string;
    userCount: number;
    contentCount: number;
  };
  notices: NoticeMetrics;
  decisions: DecisionMetrics;
  appeals: AppealMetrics;
  ods: ODSMetrics;
  repeatOffenders: RepeatOffenderMetrics;
  trustedFlaggers: TrustedFlaggerMetrics;
  sorSubmissions: SoRSubmissionMetrics;
  complianceNotes: string[];
}

export interface RealTimeDashboard {
  timestamp: Date;
  pendingReports: number;
  slaBreaches: number;
  activeAppeals: number;
  circuitBreakerStatus: string;
  last24Hours: {
    reportsReceived: number;
    decisionsIssued: number;
    appealsSubmitted: number;
    sorSubmissions: number;
  };
}

/**
 * Database record with PII fields removed for authority export
 */
type RedactedDbRecord = Record<string, unknown>;

export interface AuthorityExportFormat {
  exportId: string;
  requestedBy: string;
  requestDate: Date;
  period: TransparencyReportPeriod;
  format: 'json' | 'csv' | 'xml';
  data: {
    reports: RedactedDbRecord[];
    decisions: RedactedDbRecord[];
    appeals: RedactedDbRecord[];
    auditTrail: RedactedDbRecord[];
  };
  metadata: {
    totalRecords: number;
    piiRedacted: boolean;
    legalBasis: string;
  };
}

// ============================================================================
// Transparency Service Class
// ============================================================================

export class TransparencyService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Generate annual transparency report
   * Requirements: 6.3, 13.2
   */
  async generateAnnualReport(year: number): Promise<AnnualTransparencyReport> {
    const period = this.getReportPeriod(year);

    const [
      notices,
      decisions,
      appeals,
      ods,
      repeatOffenders,
      trustedFlaggers,
      sorSubmissions,
    ] = await Promise.all([
      this.getNoticeMetrics(period),
      this.getDecisionMetrics(period),
      this.getAppealMetrics(period),
      this.getODSMetrics(period),
      this.getRepeatOffenderMetrics(period),
      this.getTrustedFlaggerMetrics(period),
      this.getSoRSubmissionMetrics(period),
    ]);

    return {
      period,
      generatedAt: new Date(),
      platformInfo: {
        name: 'GrowBro',
        jurisdiction: 'EU',
        userCount: await this.getUserCount(),
        contentCount: await this.getContentCount(),
      },
      notices,
      decisions,
      appeals,
      ods,
      repeatOffenders,
      trustedFlaggers,
      sorSubmissions,
      complianceNotes: this.generateComplianceNotes({
        notices,
        decisions,
        appeals,
        ods,
      }),
    };
  }

  /**
   * Get real-time dashboard metrics
   * Requirements: 6.5
   */
  async getRealTimeDashboard(): Promise<RealTimeDashboard> {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [
      pendingReports,
      slaBreaches,
      activeAppeals,
      last24HoursMetrics,
      circuitBreakerStatus,
    ] = await Promise.all([
      this.getPendingReportsCount(),
      this.getSLABreachesCount(),
      this.getActiveAppealsCount(),
      this.getLast24HoursMetrics(last24Hours),
      this.getCircuitBreakerStatus(),
    ]);

    return {
      timestamp: now,
      pendingReports,
      slaBreaches,
      activeAppeals,
      circuitBreakerStatus,
      last24Hours: last24HoursMetrics,
    };
  }

  /**
   * Export data for authority requests
   * Requirements: 6.5
   */
  async exportForAuthority(
    requestedBy: string,
    period: TransparencyReportPeriod,
    format: 'json' | 'csv' | 'xml' = 'json'
  ): Promise<AuthorityExportFormat> {
    const [reports, decisions, appeals, auditTrail] = await Promise.all([
      this.getReportsForExport(period),
      this.getDecisionsForExport(period),
      this.getAppealsForExport(period),
      this.getAuditTrailForExport(period),
    ]);

    const exportData = {
      exportId: this.generateExportId(),
      requestedBy,
      requestDate: new Date(),
      period,
      format,
      data: {
        reports,
        decisions,
        appeals,
        auditTrail,
      },
      metadata: {
        totalRecords:
          reports.length +
          decisions.length +
          appeals.length +
          auditTrail.length,
        piiRedacted: true,
        legalBasis: 'DSA Art. 15 - Transparency Reporting',
      },
    };

    // Log export for audit trail
    await this.logAuthorityExport(exportData);

    return exportData;
  }

  // ============================================================================
  // Private Helper Methods - Notice Metrics
  // ============================================================================

  private async getNoticeMetrics(
    period: TransparencyReportPeriod
  ): Promise<NoticeMetrics> {
    const { data: reports, error } = await this.supabase
      .from('content_reports')
      .select('report_type, category, created_at, trusted_flagger')
      .gte('created_at', period.startDate.toISOString())
      .lte('created_at', period.endDate.toISOString());

    if (error)
      throw new Error(`Failed to fetch notice metrics: ${error.message}`);

    const totalNotices = reports?.length || 0;
    const illegalContentNotices =
      reports?.filter((r) => r.report_type === 'illegal').length || 0;
    const policyViolationNotices =
      reports?.filter((r) => r.report_type === 'policy_violation').length || 0;
    const trustedFlaggerNotices =
      reports?.filter((r) => r.trusted_flagger).length || 0;

    // Calculate notices by category
    const noticesByCategory: Record<string, number> = {};
    reports?.forEach((r) => {
      const category = r.category || 'uncategorized';
      noticesByCategory[category] = (noticesByCategory[category] || 0) + 1;
    });

    // Calculate average handling time
    const averageHandlingTimeHours =
      await this.calculateAverageHandlingTime(period);

    return {
      totalNotices,
      illegalContentNotices,
      policyViolationNotices,
      noticesByCategory,
      averageHandlingTimeHours,
      trustedFlaggerNotices,
    };
  }

  private async getDecisionMetrics(
    period: TransparencyReportPeriod
  ): Promise<DecisionMetrics> {
    const { data: decisions, error } = await this.supabase
      .from('moderation_decisions')
      .select('action, created_at, executed_at, requires_supervisor_approval')
      .gte('created_at', period.startDate.toISOString())
      .lte('created_at', period.endDate.toISOString());

    if (error)
      throw new Error(`Failed to fetch decision metrics: ${error.message}`);

    const totalDecisions = decisions?.length || 0;

    // Calculate action breakdown
    const actionBreakdown: Record<string, number> = {};
    decisions?.forEach((d) => {
      const action = d.action || 'unknown';
      actionBreakdown[action] = (actionBreakdown[action] || 0) + 1;
    });

    // Calculate average decision time
    let totalDecisionTimeMs = 0;
    let decisionsWithTime = 0;
    decisions?.forEach((d) => {
      if (d.created_at && d.executed_at) {
        const createdAt = new Date(d.created_at).getTime();
        const executedAt = new Date(d.executed_at).getTime();
        totalDecisionTimeMs += executedAt - createdAt;
        decisionsWithTime++;
      }
    });

    const averageDecisionTimeHours =
      decisionsWithTime > 0
        ? totalDecisionTimeMs / decisionsWithTime / (1000 * 60 * 60)
        : 0;

    // Calculate supervisor approval rate
    const supervisorApprovals =
      decisions?.filter((d) => d.requires_supervisor_approval).length || 0;
    const supervisorApprovalRate =
      totalDecisions > 0 ? (supervisorApprovals / totalDecisions) * 100 : 0;

    return {
      totalDecisions,
      actionBreakdown,
      averageDecisionTimeHours,
      supervisorApprovalRate,
    };
  }

  private async getAppealMetrics(
    period: TransparencyReportPeriod
  ): Promise<AppealMetrics> {
    const { data: appeals, error } = await this.supabase
      .from('appeals')
      .select('decision, submitted_at, resolved_at')
      .gte('submitted_at', period.startDate.toISOString())
      .lte('submitted_at', period.endDate.toISOString());

    if (error)
      throw new Error(`Failed to fetch appeal metrics: ${error.message}`);

    const totalAppeals = appeals?.length || 0;
    const upheldAppeals =
      appeals?.filter((a) => a.decision === 'upheld').length || 0;
    const rejectedAppeals =
      appeals?.filter((a) => a.decision === 'rejected').length || 0;
    const reversalRate =
      totalAppeals > 0 ? (upheldAppeals / totalAppeals) * 100 : 0;

    // Calculate average resolution time
    let totalResolutionTimeMs = 0;
    let resolvedAppeals = 0;
    appeals?.forEach((a) => {
      if (a.submitted_at && a.resolved_at) {
        const submittedAt = new Date(a.submitted_at).getTime();
        const resolvedAt = new Date(a.resolved_at).getTime();
        totalResolutionTimeMs += resolvedAt - submittedAt;
        resolvedAppeals++;
      }
    });

    const averageResolutionDays =
      resolvedAppeals > 0
        ? totalResolutionTimeMs / resolvedAppeals / (1000 * 60 * 60 * 24)
        : 0;

    return {
      totalAppeals,
      upheldAppeals,
      rejectedAppeals,
      reversalRate,
      averageResolutionDays,
    };
  }

  private async getODSMetrics(
    period: TransparencyReportPeriod
  ): Promise<ODSMetrics> {
    const odsStats = await getODSStatistics(period);
    return {
      totalEscalations: odsStats.totalEscalations,
      resolved: odsStats.resolved,
      pending: odsStats.pending,
      averageResolutionDays: odsStats.averageResolutionDays,
      outcomeBreakdown: odsStats.outcomeBreakdown,
      upholdsReversed: odsStats.upholdsReversed,
    };
  }

  private async getRepeatOffenderMetrics(
    period: TransparencyReportPeriod
  ): Promise<RepeatOffenderMetrics> {
    const { data: offenders, error } = await this.supabase
      .from('repeat_offender_records')
      .select('escalation_level, manifestly_unfounded_reports')
      .gte('created_at', period.startDate.toISOString())
      .lte('created_at', period.endDate.toISOString());

    if (error)
      throw new Error(
        `Failed to fetch repeat offender metrics: ${error.message}`
      );

    const totalRepeatOffenders = offenders?.length || 0;

    // Calculate suspensions by level
    const suspensionsByLevel: Record<string, number> = {};
    offenders?.forEach((o) => {
      const level = o.escalation_level || 'unknown';
      suspensionsByLevel[level] = (suspensionsByLevel[level] || 0) + 1;
    });

    // Count manifestly unfounded reporters
    const manifestlyUnfoundedReporters =
      offenders?.filter((o) => o.manifestly_unfounded_reports > 0).length || 0;

    return {
      totalRepeatOffenders,
      suspensionsByLevel,
      manifestlyUnfoundedReporters,
    };
  }

  private async getTrustedFlaggerMetrics(
    period: TransparencyReportPeriod
  ): Promise<TrustedFlaggerMetrics> {
    const { data: flaggers, error } = await this.supabase
      .from('trusted_flaggers')
      .select('status, accuracy_rate, total_reports')
      .gte('created_at', period.startDate.toISOString())
      .lte('created_at', period.endDate.toISOString());

    if (error)
      throw new Error(
        `Failed to fetch trusted flagger metrics: ${error.message}`
      );

    const totalTrustedFlaggers = flaggers?.length || 0;
    const activeCount =
      flaggers?.filter((f) => f.status === 'active').length || 0;
    const suspendedCount =
      flaggers?.filter((f) => f.status === 'suspended').length || 0;
    const revokedCount =
      flaggers?.filter((f) => f.status === 'revoked').length || 0;

    // Calculate average accuracy rate
    const totalAccuracy =
      flaggers?.reduce((sum, f) => sum + (f.accuracy_rate || 0), 0) || 0;
    const averageAccuracyRate =
      totalTrustedFlaggers > 0 ? totalAccuracy / totalTrustedFlaggers : 0;

    // Calculate total reports processed
    const totalReportsProcessed =
      flaggers?.reduce((sum, f) => sum + (f.total_reports || 0), 0) || 0;

    return {
      totalTrustedFlaggers,
      activeCount,
      suspendedCount,
      revokedCount,
      averageAccuracyRate,
      totalReportsProcessed,
    };
  }

  private async getSoRSubmissionMetrics(
    period: TransparencyReportPeriod
  ): Promise<SoRSubmissionMetrics> {
    const { data: submissions, error } = await this.supabase
      .from('sor_export_queue')
      .select('status, created_at, last_attempt')
      .gte('created_at', period.startDate.toISOString())
      .lte('created_at', period.endDate.toISOString());

    if (error)
      throw new Error(
        `Failed to fetch SoR submission metrics: ${error.message}`
      );

    const totalSubmissions = submissions?.length || 0;
    const successfulSubmissions =
      submissions?.filter((s) => s.status === 'submitted').length || 0;
    const failedSubmissions =
      submissions?.filter((s) => s.status === 'failed' || s.status === 'dlq')
        .length || 0;

    // Calculate average submission time
    let totalSubmissionTimeMs = 0;
    let submissionsWithTime = 0;
    const submissionTimes: number[] = [];

    submissions?.forEach((s) => {
      if (s.created_at && s.last_attempt) {
        const createdAt = new Date(s.created_at).getTime();
        const lastAttempt = new Date(s.last_attempt).getTime();
        const timeMs = lastAttempt - createdAt;
        totalSubmissionTimeMs += timeMs;
        submissionTimes.push(timeMs);
        submissionsWithTime++;
      }
    });

    const averageSubmissionTimeMinutes =
      submissionsWithTime > 0
        ? totalSubmissionTimeMs / submissionsWithTime / (1000 * 60)
        : 0;

    // Calculate p95 submission time
    submissionTimes.sort((a, b) => a - b);
    const p95Index = Math.floor(submissionTimes.length * 0.95);
    const p95SubmissionTimeMinutes =
      submissionTimes.length > 0 ? submissionTimes[p95Index] / (1000 * 60) : 0;

    return {
      totalSubmissions,
      successfulSubmissions,
      failedSubmissions,
      averageSubmissionTimeMinutes,
      p95SubmissionTimeMinutes,
    };
  }

  // ============================================================================
  // Real-Time Dashboard Helpers
  // ============================================================================

  private async getPendingReportsCount(): Promise<number> {
    const { count, error } = await this.supabase
      .from('content_reports')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    if (error)
      throw new Error(`Failed to fetch pending reports: ${error.message}`);
    return count || 0;
  }

  private async getSLABreachesCount(): Promise<number> {
    const now = new Date();
    const { count, error } = await this.supabase
      .from('content_reports')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')
      .lt('sla_deadline', now.toISOString());

    if (error)
      throw new Error(`Failed to fetch SLA breaches: ${error.message}`);
    return count || 0;
  }

  private async getActiveAppealsCount(): Promise<number> {
    const { count, error } = await this.supabase
      .from('appeals')
      .select('*', { count: 'exact', head: true })
      .in('status', ['pending', 'under_review']);

    if (error)
      throw new Error(`Failed to fetch active appeals: ${error.message}`);
    return count || 0;
  }

  private async getLast24HoursMetrics(since: Date): Promise<{
    reportsReceived: number;
    decisionsIssued: number;
    appealsSubmitted: number;
    sorSubmissions: number;
  }> {
    const [reportsReceived, decisionsIssued, appealsSubmitted, sorSubmissions] =
      await Promise.all([
        this.countRecordsSince('content_reports', since),
        this.countRecordsSince('moderation_decisions', since),
        this.countRecordsSince('appeals', since),
        this.countRecordsSince('sor_export_queue', since),
      ]);

    return {
      reportsReceived,
      decisionsIssued,
      appealsSubmitted,
      sorSubmissions,
    };
  }

  private async getCircuitBreakerStatus(): Promise<string> {
    // Query circuit breaker state from sor_export_queue or metrics
    const { data, error } = await this.supabase
      .from('sor_export_queue')
      .select('status')
      .eq('status', 'failed')
      .limit(10);

    if (error) return 'UNKNOWN';

    const recentFailures = data?.length || 0;
    if (recentFailures >= 5) return 'OPEN';
    if (recentFailures >= 3) return 'HALF_OPEN';
    return 'CLOSED';
  }

  private async countRecordsSince(table: string, since: Date): Promise<number> {
    const { count, error } = await this.supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .gte('created_at', since.toISOString());

    if (error) {
      console.error(`Failed to count records from ${table}:`, error);
      return 0;
    }
    return count || 0;
  }

  // ============================================================================
  // Authority Export Helpers
  // ============================================================================

  private async getReportsForExport(
    period: TransparencyReportPeriod
  ): Promise<RedactedDbRecord[]> {
    const { data, error } = await this.supabase
      .from('content_reports')
      .select('*')
      .gte('created_at', period.startDate.toISOString())
      .lte('created_at', period.endDate.toISOString());

    if (error)
      throw new Error(`Failed to fetch reports for export: ${error.message}`);
    return this.redactPIIFromRecords(data || []);
  }

  private async getDecisionsForExport(
    period: TransparencyReportPeriod
  ): Promise<RedactedDbRecord[]> {
    const { data, error } = await this.supabase
      .from('moderation_decisions')
      .select('*')
      .gte('created_at', period.startDate.toISOString())
      .lte('created_at', period.endDate.toISOString());

    if (error)
      throw new Error(`Failed to fetch decisions for export: ${error.message}`);
    return this.redactPIIFromRecords(data || []);
  }

  private async getAppealsForExport(
    period: TransparencyReportPeriod
  ): Promise<RedactedDbRecord[]> {
    const { data, error } = await this.supabase
      .from('appeals')
      .select('*')
      .gte('submitted_at', period.startDate.toISOString())
      .lte('submitted_at', period.endDate.toISOString());

    if (error)
      throw new Error(`Failed to fetch appeals for export: ${error.message}`);
    return this.redactPIIFromRecords(data || []);
  }

  private async getAuditTrailForExport(
    period: TransparencyReportPeriod
  ): Promise<RedactedDbRecord[]> {
    const { data, error } = await this.supabase
      .from('audit_events')
      .select('*')
      .gte('timestamp', period.startDate.toISOString())
      .lte('timestamp', period.endDate.toISOString())
      .in('event_type', [
        'report_submitted',
        'decision_made',
        'appeal_submitted',
        'sor_submitted',
      ]);

    if (error)
      throw new Error(
        `Failed to fetch audit trail for export: ${error.message}`
      );
    return this.redactPIIFromRecords(data || []);
  }

  private redactPIIFromRecords(
    records: Record<string, unknown>[]
  ): RedactedDbRecord[] {
    return records.map((record) => {
      const redacted = { ...record };
      // Remove PII fields
      delete redacted.reporter_contact;
      delete redacted.personal_identifiers;
      delete redacted.ip_address;
      delete redacted.location_data;
      delete redacted.evidence_urls;
      return redacted;
    });
  }

  private async logAuthorityExport(
    exportData: AuthorityExportFormat
  ): Promise<void> {
    await this.supabase.from('audit_events').insert({
      event_type: 'authority_export',
      actor_id: exportData.requestedBy,
      actor_type: 'authority',
      target_id: exportData.exportId,
      target_type: 'export',
      action: 'export_generated',
      metadata: {
        period: exportData.period,
        format: exportData.format,
        totalRecords: exportData.metadata.totalRecords,
      },
      timestamp: new Date(),
    });
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private getReportPeriod(year: number): TransparencyReportPeriod {
    return {
      startDate: new Date(year, 0, 1), // January 1st
      endDate: new Date(year, 11, 31, 23, 59, 59), // December 31st
      year,
    };
  }

  private async calculateAverageHandlingTime(
    period: TransparencyReportPeriod
  ): Promise<number> {
    const { data, error } = await this.supabase
      .from('content_reports')
      .select('created_at, resolved_at')
      .gte('created_at', period.startDate.toISOString())
      .lte('created_at', period.endDate.toISOString())
      .not('resolved_at', 'is', null);

    if (error) return 0;

    let totalTimeMs = 0;
    let count = 0;

    data?.forEach((report) => {
      if (report.created_at && report.resolved_at) {
        const createdAt = new Date(report.created_at).getTime();
        const resolvedAt = new Date(report.resolved_at).getTime();
        totalTimeMs += resolvedAt - createdAt;
        count++;
      }
    });

    return count > 0 ? totalTimeMs / count / (1000 * 60 * 60) : 0;
  }

  private async getUserCount(): Promise<number> {
    const { count, error } = await this.supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    if (error) return 0;
    return count || 0;
  }

  private async getContentCount(): Promise<number> {
    const { count, error } = await this.supabase
      .from('posts')
      .select('*', { count: 'exact', head: true });

    if (error) return 0;
    return count || 0;
  }

  private generateExportId(): string {
    return `export-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  private generateComplianceNotes(params: {
    notices: NoticeMetrics;
    decisions: DecisionMetrics;
    appeals: AppealMetrics;
    ods: ODSMetrics;
  }): string[] {
    const { notices, decisions, appeals, ods } = params;
    const notes: string[] = [];

    // DSA Art. 16 compliance
    if (notices.totalNotices > 0) {
      notes.push(
        `DSA Art. 16: Processed ${notices.totalNotices} notices with mandatory field validation`
      );
    }

    // DSA Art. 17 compliance
    if (decisions.totalDecisions > 0) {
      notes.push(
        `DSA Art. 17: Issued ${decisions.totalDecisions} Statements of Reasons to users`
      );
    }

    // DSA Art. 20 compliance
    if (appeals.totalAppeals > 0) {
      notes.push(
        `DSA Art. 20: Processed ${appeals.totalAppeals} internal appeals with ${appeals.reversalRate.toFixed(1)}% reversal rate`
      );
    }

    // DSA Art. 21 compliance
    if (ods.totalEscalations > 0) {
      notes.push(
        `DSA Art. 21: ${ods.totalEscalations} cases escalated to certified ODS bodies`
      );
    }

    // DSA Art. 22 compliance
    if (notices.trustedFlaggerNotices > 0) {
      notes.push(
        `DSA Art. 22: ${notices.trustedFlaggerNotices} notices from trusted flaggers processed with priority`
      );
    }

    return notes;
  }
}

// ============================================================================
// Exports
// ============================================================================

export const transparencyService = {
  create: (supabase: SupabaseClient) => new TransparencyService(supabase),
};
