/**
 * SLA Monitor Service - Real-time SLA monitoring and alerting
 *
 * Implements automated SLA compliance monitoring with:
 * - Real-time threshold detection (75%, 90%)
 * - Automated supervisor alerts
 * - Breach detection and escalation
 * - Performance metrics tracking
 *
 * Requirements: 5.1, 5.2, 5.3, 5.5
 */

import { supabase } from '@/lib/supabase';
import type { ContentReport, SLAStatus } from '@/types/moderation';

import { AuditService } from './audit-service';
import { trackSLABreach } from './moderation-metrics-trackers';
import { calculateSLAStatus, shouldTriggerSLAAlert } from './sla-calculator';

// ============================================================================
// Types
// ============================================================================

interface ReportDbRow {
  id: string;
  content_id: string;
  content_type: string;
  report_type: 'illegal' | 'policy_violation';
  status: string;
  priority: number;
  sla_deadline: string;
  last_alert_level?: 75 | 90;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
}

export interface SLAMonitorResult {
  reportId: string;
  status: SLAStatus;
  timeRemainingMs: number;
  percentUsed: number;
  shouldAlert: boolean;
  alertLevel: 75 | 90 | null;
  isBreached: boolean;
}

export interface SLAComplianceMetrics {
  totalReports: number;
  withinSLA: number;
  breached: number;
  atRisk: number;
  complianceRate: number;
  averageResponseTimeMs: number;
}

// ============================================================================
// Constants
// ============================================================================

const SLA_MONITOR_BATCH_SIZE = 100;

// ============================================================================
// SLA Monitor Service
// ============================================================================

const auditService = new AuditService(supabase);

export class SLAMonitorService {
  async monitorActiveReports(): Promise<SLAMonitorResult[]> {
    try {
      const { data: reports, error } = await supabase
        .from('content_reports')
        .select('*')
        .in('status', ['pending', 'in_progress'])
        .order('sla_deadline', { ascending: true })
        .limit(SLA_MONITOR_BATCH_SIZE);

      if (error) {
        throw new Error(
          `Failed to fetch reports for SLA monitoring: ${error.message}`
        );
      }

      if (!reports || reports.length === 0) {
        return [];
      }

      const results: SLAMonitorResult[] = [];

      for (const report of reports as ReportDbRow[]) {
        const result = await this.monitorSingleReport(report);
        results.push(result);
      }

      return results;
    } catch (error) {
      console.error('[SLAMonitor] Error monitoring active reports:', error);
      throw error;
    }
  }

  async monitorSingleReport(report: ReportDbRow): Promise<SLAMonitorResult> {
    const reportCreatedAt = new Date(report.created_at);
    const slaDeadline = new Date(report.sla_deadline);
    const priority = 'standard' as const;

    const status = calculateSLAStatus(reportCreatedAt, slaDeadline, priority);

    const now = new Date();
    const timeRemainingMs = Math.max(0, slaDeadline.getTime() - now.getTime());
    const totalWindow = slaDeadline.getTime() - reportCreatedAt.getTime();
    const timeElapsed = now.getTime() - reportCreatedAt.getTime();
    const percentUsed =
      totalWindow > 0 ? (timeElapsed / totalWindow) * 100 : 100;

    const { shouldAlert, alertLevel } = shouldTriggerSLAAlert(
      reportCreatedAt,
      slaDeadline,
      report.last_alert_level
    );

    const isBreached = timeRemainingMs === 0 || percentUsed >= 100;

    return {
      reportId: report.id,
      status,
      timeRemainingMs,
      percentUsed,
      shouldAlert,
      alertLevel,
      isBreached,
    };
  }

  async getComplianceMetrics(
    startDate: Date,
    endDate: Date
  ): Promise<SLAComplianceMetrics> {
    try {
      const { data: reports, error } = await supabase
        .from('content_reports')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .in('status', ['resolved', 'dismissed', 'pending', 'in_progress']);

      if (error) {
        throw new Error(`Failed to fetch compliance metrics: ${error.message}`);
      }

      if (!reports || reports.length === 0) {
        return {
          totalReports: 0,
          withinSLA: 0,
          breached: 0,
          atRisk: 0,
          complianceRate: 100,
          averageResponseTimeMs: 0,
        };
      }

      let withinSLA = 0;
      let breached = 0;
      let atRisk = 0;
      let totalResponseTime = 0;
      let resolvedCount = 0;

      for (const report of reports as ReportDbRow[]) {
        const createdAt = new Date(report.created_at);
        const deadline = new Date(report.sla_deadline);
        const resolvedAt = report.resolved_at
          ? new Date(report.resolved_at)
          : null;

        if (resolvedAt) {
          const responseTime = resolvedAt.getTime() - createdAt.getTime();
          totalResponseTime += responseTime;
          resolvedCount++;

          if (resolvedAt <= deadline) {
            withinSLA++;
          } else {
            breached++;
          }
        } else {
          const now = new Date();
          const totalWindow = deadline.getTime() - createdAt.getTime();
          const timeElapsed = now.getTime() - createdAt.getTime();
          const percentUsed =
            totalWindow > 0 ? (timeElapsed / totalWindow) * 100 : 100;

          if (percentUsed >= 100) {
            breached++;
          } else if (percentUsed >= 75) {
            atRisk++;
          }
        }
      }

      const totalReports = reports.length;
      const complianceRate =
        totalReports > 0 ? (withinSLA / totalReports) * 100 : 100;
      const averageResponseTimeMs =
        resolvedCount > 0 ? totalResponseTime / resolvedCount : 0;

      return {
        totalReports,
        withinSLA,
        breached,
        atRisk,
        complianceRate,
        averageResponseTimeMs,
      };
    } catch (error) {
      console.error(
        '[SLAMonitor] Error calculating compliance metrics:',
        error
      );
      throw error;
    }
  }

  async getAtRiskReports(): Promise<ContentReport[]> {
    try {
      const { data: reports, error } = await supabase
        .from('content_reports')
        .select('*')
        .in('status', ['pending', 'in_progress'])
        .order('sla_deadline', { ascending: true });

      if (error) {
        throw new Error(`Failed to fetch at-risk reports: ${error.message}`);
      }

      if (!reports || reports.length === 0) {
        return [];
      }

      const atRiskReports: ContentReport[] = [];
      const now = new Date();

      for (const report of reports as ReportDbRow[]) {
        const createdAt = new Date(report.created_at);
        const deadline = new Date(report.sla_deadline);
        const totalWindow = deadline.getTime() - createdAt.getTime();
        const timeElapsed = now.getTime() - createdAt.getTime();
        const percentUsed =
          totalWindow > 0 ? (timeElapsed / totalWindow) * 100 : 100;

        if (percentUsed >= 75 && percentUsed < 100) {
          atRiskReports.push({
            ...report,
            sla_deadline: deadline,
            created_at: createdAt,
            updated_at: new Date(report.updated_at),
          } as unknown as ContentReport);
        }
      }

      return atRiskReports;
    } catch (error) {
      console.error('[SLAMonitor] Error fetching at-risk reports:', error);
      throw error;
    }
  }

  async getBreachedReports(): Promise<ContentReport[]> {
    try {
      const now = new Date();

      const { data: reports, error } = await supabase
        .from('content_reports')
        .select('*')
        .in('status', ['pending', 'in_progress'])
        .lt('sla_deadline', now.toISOString())
        .order('sla_deadline', { ascending: true });

      if (error) {
        throw new Error(`Failed to fetch breached reports: ${error.message}`);
      }

      return (reports as ContentReport[]) || [];
    } catch (error) {
      console.error('[SLAMonitor] Error fetching breached reports:', error);
      throw error;
    }
  }

  async logSLABreach(reportId: string, report: ContentReport): Promise<void> {
    try {
      const createdAt = new Date(report.created_at);
      const deadline = new Date(report.sla_deadline);
      const now = new Date();
      const breachDurationMs = now.getTime() - deadline.getTime();
      const breachDurationHours = breachDurationMs / (1000 * 60 * 60);

      trackSLABreach(reportId, report.report_type, breachDurationHours);

      await auditService.logEvent({
        event_type: 'sla_breach',
        actor_id: 'system',
        actor_type: 'system',
        target_id: reportId,
        target_type: 'content_report',
        action: 'sla_breach_detected',
        metadata: {
          reportType: report.report_type,
          priority: report.priority,
          breachDurationHours,
          createdAt: createdAt.toISOString(),
          deadline: deadline.toISOString(),
          detectedAt: now.toISOString(),
        },
      });

      console.log(
        `[SLAMonitor] Breach logged for report ${reportId}: ${breachDurationHours.toFixed(2)}h overdue`
      );
    } catch (error) {
      console.error('[SLAMonitor] Error logging SLA breach:', error);
      throw error;
    }
  }

  async updateLastAlertLevel(
    reportId: string,
    alertLevel: 75 | 90
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('content_reports')
        .update({ last_alert_level: alertLevel })
        .eq('id', reportId);

      if (error) {
        throw new Error(`Failed to update alert level: ${error.message}`);
      }
    } catch (error) {
      console.error('[SLAMonitor] Error updating last alert level:', error);
      throw error;
    }
  }

  async getDashboardMetrics(): Promise<{
    activeReports: number;
    atRisk: number;
    breached: number;
    complianceRate: number;
    averageTimeRemainingMs: number;
  }> {
    try {
      const { data: reports, error } = await supabase
        .from('content_reports')
        .select('*')
        .in('status', ['pending', 'in_progress']);

      if (error) {
        throw new Error(`Failed to fetch dashboard metrics: ${error.message}`);
      }

      if (!reports || reports.length === 0) {
        return {
          activeReports: 0,
          atRisk: 0,
          breached: 0,
          complianceRate: 100,
          averageTimeRemainingMs: 0,
        };
      }

      let atRisk = 0;
      let breached = 0;
      let totalTimeRemaining = 0;
      const now = new Date();

      for (const report of reports as ReportDbRow[]) {
        const createdAt = new Date(report.created_at);
        const deadline = new Date(report.sla_deadline);
        const totalWindow = deadline.getTime() - createdAt.getTime();
        const timeElapsed = now.getTime() - createdAt.getTime();
        const percentUsed =
          totalWindow > 0 ? (timeElapsed / totalWindow) * 100 : 100;
        const timeRemaining = Math.max(0, deadline.getTime() - now.getTime());

        totalTimeRemaining += timeRemaining;

        if (percentUsed >= 100) {
          breached++;
        } else if (percentUsed >= 75) {
          atRisk++;
        }
      }

      const activeReports = reports.length;
      const complianceRate =
        activeReports > 0
          ? ((activeReports - breached) / activeReports) * 100
          : 100;
      const averageTimeRemainingMs =
        activeReports > 0 ? totalTimeRemaining / activeReports : 0;

      return {
        activeReports,
        atRisk,
        breached,
        complianceRate,
        averageTimeRemainingMs,
      };
    } catch (error) {
      console.error('[SLAMonitor] Error fetching dashboard metrics:', error);
      throw error;
    }
  }
}

export const slaMonitorService = new SLAMonitorService();
