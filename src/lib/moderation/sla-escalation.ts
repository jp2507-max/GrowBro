/**
 * SLA Escalation - Breach escalation and incident management
 *
 * Implements automated escalation workflows with:
 * - Management notification for breached SLAs
 * - Incident report generation
 * - Root cause analysis tracking
 * - Escalation path management
 *
 * Requirements: 5.3, 5.7
 */

import { supabase } from '@/lib/supabase';
import type { ContentReport } from '@/types/moderation';

import { AuditService } from './audit-service';
import { slaAlertService } from './sla-alerts';

// ============================================================================
// Types
// ============================================================================

export interface SLAIncident {
  id: string;
  report_id: string;
  incident_type: 'sla_breach' | 'system_degradation' | 'manual_escalation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'investigating' | 'resolved' | 'closed';
  breach_duration_hours: number;
  escalated_to: string[];
  created_at: Date;
  resolved_at?: Date;
  root_cause?: string;
  corrective_actions?: string[];
  metadata?: Record<string, unknown>;
}

export interface EscalationConfig {
  enabled: boolean;
  managementIds: string[];
  escalationThresholds: {
    immediate: number; // hours
    high: number;
    medium: number;
  };
  requireRootCauseAnalysis: boolean;
}

interface EscalationResult {
  incident: SLAIncident;
  notified: string[];
  success: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MANAGEMENT_IDS = ['system-manager'];

const DEFAULT_THRESHOLDS = {
  immediate: 0, // Immediate priority breaches escalate instantly
  high: 2, // 2 hours overdue for high priority
  medium: 6, // 6 hours overdue for medium priority
};

// ============================================================================
// SLA Escalation Service
// ============================================================================

const auditService = new AuditService(supabase);

export class SLAEscalationService {
  private config: EscalationConfig;

  constructor(config?: Partial<EscalationConfig>) {
    this.config = {
      enabled: config?.enabled ?? true,
      managementIds: config?.managementIds ?? DEFAULT_MANAGEMENT_IDS,
      escalationThresholds: config?.escalationThresholds ?? DEFAULT_THRESHOLDS,
      requireRootCauseAnalysis: config?.requireRootCauseAnalysis ?? true,
    };
  }

  /**
   * Escalate SLA breach to management
   *
   * Requirements: 5.3
   */
  async escalateBreach(
    report: ContentReport,
    breachDurationHours: number
  ): Promise<EscalationResult> {
    if (!this.config.enabled) {
      throw new Error('SLA escalation is disabled');
    }

    try {
      // Determine severity based on breach duration and priority
      const severity = this.determineSeverity(report, breachDurationHours);

      // Create incident record
      const incident = await this.createIncident(
        report,
        breachDurationHours,
        severity
      );

      // Notify management
      const notified = await this.notifyManagement(incident, report);

      // Create alert for management
      await slaAlertService.createAlert(report, 'breach', 100);

      // Log escalation
      await auditService.logEvent({
        event_type: 'sla_breach_escalated',
        actor_id: 'system',
        actor_type: 'system',
        target_id: report.id,
        target_type: 'content_report',
        action: 'escalate_to_management',
        metadata: {
          incidentId: incident.id,
          severity,
          breachDurationHours,
          notified,
        },
      });

      console.log(
        `[SLAEscalation] Breach escalated for report ${report.id}, incident ${incident.id}`
      );

      return {
        incident,
        notified,
        success: true,
      };
    } catch (error) {
      console.error('[SLAEscalation] Error escalating breach:', error);
      return {
        incident: {} as SLAIncident,
        notified: [],
        success: false,
      };
    }
  }

  /**
   * Determine incident severity based on report and breach duration
   */
  private determineSeverity(
    report: ContentReport,
    breachDurationHours: number
  ): 'low' | 'medium' | 'high' | 'critical' {
    // Critical: Immediate priority or very long breach
    if (report.priority >= 90 || breachDurationHours > 24) {
      return 'critical';
    }

    // High: High priority or significant breach
    if (
      report.priority >= 70 ||
      breachDurationHours > this.config.escalationThresholds.high
    ) {
      return 'high';
    }

    // Medium: Standard breach
    if (breachDurationHours > this.config.escalationThresholds.medium) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Create incident record in database
   */
  private async createIncident(
    report: ContentReport,
    breachDurationHours: number,
    severity: 'low' | 'medium' | 'high' | 'critical'
  ): Promise<SLAIncident> {
    const { data, error } = await supabase
      .from('sla_incidents')
      .insert({
        report_id: report.id,
        incident_type: 'sla_breach',
        severity,
        status: 'open',
        breach_duration_hours: breachDurationHours,
        escalated_to: this.config.managementIds,
        created_at: new Date().toISOString(),
        metadata: {
          reportType: report.report_type,
          contentType: report.content_type,
          priority: report.priority,
          slaDeadline: report.sla_deadline.toISOString(),
        },
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create incident: ${error.message}`);
    }

    return {
      ...data,
      created_at: new Date(data.created_at),
      resolved_at: data.resolved_at ? new Date(data.resolved_at) : undefined,
    } as SLAIncident;
  }

  /**
   * Notify management of escalation
   */
  private async notifyManagement(
    incident: SLAIncident,
    report: ContentReport
  ): Promise<string[]> {
    const notified: string[] = [];

    for (const managerId of this.config.managementIds) {
      try {
        await supabase.from('notifications').insert({
          user_id: managerId,
          type: 'sla_escalation',
          title: `SLA Breach Escalation - ${incident.severity.toUpperCase()}`,
          message: `Report ${report.id} has breached SLA by ${incident.breach_duration_hours.toFixed(1)} hours. Incident ${incident.id} created.`,
          data: {
            incidentId: incident.id,
            reportId: report.id,
            severity: incident.severity,
            breachDuration: incident.breach_duration_hours,
          },
          read: false,
          created_at: new Date().toISOString(),
        });

        notified.push(managerId);
      } catch (error) {
        console.error(
          `[SLAEscalation] Failed to notify manager ${managerId}:`,
          error
        );
      }
    }

    return notified;
  }

  /**
   * Update incident with root cause analysis
   *
   * Requirements: 5.7
   */
  async addRootCauseAnalysis(
    incidentId: string,
    rootCause: string,
    correctiveActions: string[]
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('sla_incidents')
        .update({
          root_cause: rootCause,
          corrective_actions: correctiveActions,
        })
        .eq('id', incidentId);

      if (error) {
        throw new Error(
          `Failed to update root cause analysis: ${error.message}`
        );
      }

      // Log RCA completion
      await auditService.logEvent({
        event_type: 'incident_rca_completed',
        actor_id: 'system',
        actor_type: 'system',
        target_id: incidentId,
        target_type: 'sla_incident',
        action: 'add_root_cause_analysis',
        metadata: {
          rootCause,
          correctiveActionsCount: correctiveActions.length,
        },
      });

      console.log(
        `[SLAEscalation] Root cause analysis added to incident ${incidentId}`
      );
    } catch (error) {
      console.error('[SLAEscalation] Error adding root cause analysis:', error);
      throw error;
    }
  }

  /**
   * Resolve incident
   */
  async resolveIncident(
    incidentId: string,
    resolutionNotes: string
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('sla_incidents')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          metadata: {
            resolutionNotes,
          },
        })
        .eq('id', incidentId);

      if (error) {
        throw new Error(`Failed to resolve incident: ${error.message}`);
      }

      // Log resolution
      await auditService.logEvent({
        event_type: 'incident_resolved',
        actor_id: 'system',
        actor_type: 'system',
        target_id: incidentId,
        target_type: 'sla_incident',
        action: 'resolve',
        metadata: {
          resolvedAt: new Date().toISOString(),
          resolutionNotes,
        },
      });

      console.log(`[SLAEscalation] Incident ${incidentId} resolved`);
    } catch (error) {
      console.error('[SLAEscalation] Error resolving incident:', error);
      throw error;
    }
  }

  /**
   * Get open incidents for management dashboard
   */
  async getOpenIncidents(severity?: string): Promise<SLAIncident[]> {
    try {
      let query = supabase
        .from('sla_incidents')
        .select('*')
        .in('status', ['open', 'investigating'])
        .order('created_at', { ascending: false });

      if (severity) {
        query = query.eq('severity', severity);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch open incidents: ${error.message}`);
      }

      return (data || []).map((incident) => ({
        ...incident,
        created_at: new Date(incident.created_at),
        resolved_at: incident.resolved_at
          ? new Date(incident.resolved_at)
          : undefined,
      }));
    } catch (error) {
      console.error('[SLAEscalation] Error fetching open incidents:', error);
      throw error;
    }
  }

  /**
   * Get incident statistics for reporting
   *
   * Requirements: 5.7
   */
  async getIncidentStatistics(
    startDate: Date,
    endDate: Date
  ): Promise<{
    total: number;
    by_severity: Record<string, number>;
    by_status: Record<string, number>;
    average_resolution_time_hours: number;
    with_root_cause: number;
  }> {
    try {
      const { data, error } = await supabase
        .from('sla_incidents')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (error) {
        throw new Error(
          `Failed to fetch incident statistics: ${error.message}`
        );
      }

      const incidents = data || [];
      const bySeverity: Record<string, number> = {};
      const byStatus: Record<string, number> = {};
      let totalResolutionTime = 0;
      let resolvedCount = 0;
      let withRootCause = 0;

      for (const incident of incidents) {
        // Count by severity
        bySeverity[incident.severity] =
          (bySeverity[incident.severity] || 0) + 1;

        // Count by status
        byStatus[incident.status] = (byStatus[incident.status] || 0) + 1;

        // Calculate resolution time
        if (incident.resolved_at) {
          const createdAt = new Date(incident.created_at);
          const resolvedAt = new Date(incident.resolved_at);
          totalResolutionTime +=
            (resolvedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
          resolvedCount++;
        }

        // Count root cause analyses
        if (incident.root_cause) {
          withRootCause++;
        }
      }

      return {
        total: incidents.length,
        by_severity: bySeverity,
        by_status: byStatus,
        average_resolution_time_hours:
          resolvedCount > 0 ? totalResolutionTime / resolvedCount : 0,
        with_root_cause: withRootCause,
      };
    } catch (error) {
      console.error(
        '[SLAEscalation] Error fetching incident statistics:',
        error
      );
      throw error;
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const slaEscalationService = new SLAEscalationService();
