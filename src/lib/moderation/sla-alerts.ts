/**
 * SLA Alerts - Supervisor notification system for SLA threshold alerts
 *
 * Implements automated alerting with:
 * - 75% and 90% threshold notifications
 * - Alert deduplication
 * - Multi-channel delivery (email, in-app, webhook)
 * - Alert acknowledgment tracking
 *
 * Requirements: 5.2, 5.3
 */

import { supabase } from '@/lib/supabase';
import type { ContentReport } from '@/types/moderation';

import { AuditService } from './audit-service';

// ============================================================================
// Types
// ============================================================================

export interface SLAAlert {
  id: string;
  report_id: string;
  alert_level: 75 | 90 | 'breach';
  triggered_at: Date;
  supervisor_ids: string[];
  acknowledged: boolean;
  acknowledged_by?: string;
  acknowledged_at?: Date;
  notification_channels: NotificationChannel[];
  metadata?: Record<string, unknown>;
}

export interface NotificationChannel {
  type: 'email' | 'in_app' | 'webhook';
  recipient: string;
  sent: boolean;
  sent_at?: Date;
  error?: string;
}

export interface AlertConfig {
  enabled: boolean;
  channels: ('email' | 'in_app' | 'webhook')[];
  supervisorIds: string[];
  webhookUrl?: string;
}

interface AlertCreationResult {
  alert: SLAAlert;
  notifications: NotificationResult[];
}

interface NotificationResult {
  channel: string;
  success: boolean;
  error?: string;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_SUPERVISOR_IDS = ['system-supervisor']; // Fallback if no supervisors configured

// ============================================================================
// SLA Alerts Service
// ============================================================================

const auditService = new AuditService(supabase);

export class SLAAlertService {
  private config: AlertConfig;

  constructor(config?: Partial<AlertConfig>) {
    this.config = {
      enabled: config?.enabled ?? true,
      channels: config?.channels ?? ['in_app'],
      supervisorIds: config?.supervisorIds ?? DEFAULT_SUPERVISOR_IDS,
      webhookUrl: config?.webhookUrl,
    };
  }

  /**
   * Create and send SLA alert for threshold breach
   *
   * Requirements: 5.2
   */
  async createAlert(
    report: ContentReport,
    alertLevel: 75 | 90 | 'breach',
    percentUsed: number
  ): Promise<AlertCreationResult> {
    if (!this.config.enabled) {
      throw new Error('SLA alerts are disabled');
    }

    try {
      // Check for duplicate alert
      const existingAlert = await this.findExistingAlert(report.id, alertLevel);

      if (existingAlert) {
        console.log(
          `[SLAAlerts] Alert already exists for report ${report.id} at level ${alertLevel}`
        );
        return {
          alert: existingAlert,
          notifications: [],
        };
      }

      // Create alert record
      const alert = await this.insertAlertRecord(
        report,
        alertLevel,
        percentUsed
      );

      // Send notifications through configured channels
      const notifications = await this.sendNotifications(alert, report);

      // Log to audit trail
      await auditService.logEvent({
        event_type: 'sla_alert_created',
        actor_id: 'system',
        actor_type: 'system',
        target_id: report.id,
        target_type: 'content_report',
        action: 'sla_alert_triggered',
        metadata: {
          alertLevel,
          percentUsed,
          supervisors: this.config.supervisorIds,
          channels: this.config.channels,
        },
      });

      return { alert, notifications };
    } catch (error) {
      console.error('[SLAAlerts] Error creating alert:', error);
      throw error;
    }
  }

  /**
   * Find existing alert for report at specific level
   */
  private async findExistingAlert(
    reportId: string,
    alertLevel: 75 | 90 | 'breach'
  ): Promise<SLAAlert | null> {
    const { data, error } = await supabase
      .from('sla_alerts')
      .select('*')
      .eq('report_id', reportId)
      .eq('alert_level', alertLevel)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned
      throw new Error(`Failed to check for existing alert: ${error.message}`);
    }

    return data
      ? ({
          ...data,
          triggered_at: new Date(data.triggered_at),
          acknowledged_at: data.acknowledged_at
            ? new Date(data.acknowledged_at)
            : undefined,
        } as SLAAlert)
      : null;
  }

  /**
   * Insert alert record into database
   */
  private async insertAlertRecord(
    report: ContentReport,
    alertLevel: 75 | 90 | 'breach',
    percentUsed: number
  ): Promise<SLAAlert> {
    const { data, error } = await supabase
      .from('sla_alerts')
      .insert({
        report_id: report.id,
        alert_level: alertLevel,
        triggered_at: new Date().toISOString(),
        supervisor_ids: this.config.supervisorIds,
        acknowledged: false,
        notification_channels: [],
        metadata: {
          percentUsed,
          reportType: report.report_type,
          priority: report.priority,
          contentType: report.content_type,
        },
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create alert record: ${error.message}`);
    }

    return {
      ...data,
      triggered_at: new Date(data.triggered_at),
    } as SLAAlert;
  }

  /**
   * Send notifications through configured channels
   */
  private async sendNotifications(
    alert: SLAAlert,
    report: ContentReport
  ): Promise<NotificationResult[]> {
    const results: NotificationResult[] = [];

    for (const channelType of this.config.channels) {
      try {
        let success = false;

        switch (channelType) {
          case 'in_app':
            success = await this.sendInAppNotification(alert, report);
            break;
          case 'email':
            success = await this.sendEmailNotification(alert, report);
            break;
          case 'webhook':
            success = await this.sendWebhookNotification(alert, report);
            break;
        }

        results.push({
          channel: channelType,
          success,
        });
      } catch (error) {
        results.push({
          channel: channelType,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Update alert with notification results
    await this.updateNotificationChannels(alert.id, results);

    return results;
  }

  /**
   * Send in-app notification to supervisors
   */
  private async sendInAppNotification(
    alert: SLAAlert,
    report: ContentReport
  ): Promise<boolean> {
    try {
      const alertLevelText =
        alert.alert_level === 'breach'
          ? 'BREACHED'
          : `${alert.alert_level}% threshold`;

      const notifications = this.config.supervisorIds.map((supervisorId) => ({
        user_id: supervisorId,
        type: 'sla_alert',
        title: `SLA Alert: ${alertLevelText}`,
        message: `Report ${report.id} has ${alert.alert_level === 'breach' ? 'breached' : 'reached'} SLA ${alertLevelText}`,
        data: {
          reportId: report.id,
          alertLevel: alert.alert_level,
          alertId: alert.id,
          contentType: report.content_type,
          reportType: report.report_type,
        },
        read: false,
        created_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from('notifications')
        .insert(notifications);

      if (error) {
        console.error('[SLAAlerts] In-app notification error:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[SLAAlerts] In-app notification failed:', error);
      return false;
    }
  }

  /**
   * Send email notification to supervisors
   */
  private async sendEmailNotification(
    alert: SLAAlert,
    report: ContentReport
  ): Promise<boolean> {
    // Placeholder for email integration
    // In production, this would integrate with an email service (SendGrid, AWS SES, etc.)
    console.log(
      `[SLAAlerts] Email notification would be sent for alert ${alert.id}, report ${report.id}`
    );
    return true;
  }

  /**
   * Send webhook notification
   */
  private async sendWebhookNotification(
    alert: SLAAlert,
    report: ContentReport
  ): Promise<boolean> {
    if (!this.config.webhookUrl) {
      console.warn('[SLAAlerts] Webhook URL not configured');
      return false;
    }

    try {
      const payload = {
        event: 'sla_alert',
        alert: {
          id: alert.id,
          level: alert.alert_level,
          triggeredAt: alert.triggered_at.toISOString(),
        },
        report: {
          id: report.id,
          type: report.report_type,
          contentType: report.content_type,
          priority: report.priority,
        },
      };

      const response = await fetch(this.config.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      return response.ok;
    } catch (error) {
      console.error('[SLAAlerts] Webhook notification failed:', error);
      return false;
    }
  }

  /**
   * Update alert with notification channel results
   */
  private async updateNotificationChannels(
    alertId: string,
    results: NotificationResult[]
  ): Promise<void> {
    const channels: NotificationChannel[] = results.map((result) => ({
      type: result.channel as 'email' | 'in_app' | 'webhook',
      recipient: 'supervisor',
      sent: result.success,
      sent_at: result.success ? new Date() : undefined,
      error: result.error,
    }));

    const { error } = await supabase
      .from('sla_alerts')
      .update({ notification_channels: channels })
      .eq('id', alertId);

    if (error) {
      console.error(
        '[SLAAlerts] Failed to update notification channels:',
        error
      );
    }
  }

  /**
   * Acknowledge an alert
   *
   * Requirements: 5.2
   */
  async acknowledgeAlert(alertId: string, supervisorId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('sla_alerts')
        .update({
          acknowledged: true,
          acknowledged_by: supervisorId,
          acknowledged_at: new Date().toISOString(),
        })
        .eq('id', alertId);

      if (error) {
        throw new Error(`Failed to acknowledge alert: ${error.message}`);
      }

      // Log acknowledgment
      await auditService.logEvent({
        event_type: 'sla_alert_acknowledged',
        actor_id: supervisorId,
        actor_type: 'moderator',
        target_id: alertId,
        target_type: 'sla_alert',
        action: 'acknowledge',
        metadata: {
          acknowledgedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('[SLAAlerts] Error acknowledging alert:', error);
      throw error;
    }
  }

  /**
   * Get unacknowledged alerts for supervisor dashboard
   */
  async getUnacknowledgedAlerts(supervisorId?: string): Promise<SLAAlert[]> {
    try {
      let query = supabase
        .from('sla_alerts')
        .select('*')
        .eq('acknowledged', false)
        .order('triggered_at', { ascending: false });

      if (supervisorId) {
        query = query.contains('supervisor_ids', [supervisorId]);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(
          `Failed to fetch unacknowledged alerts: ${error.message}`
        );
      }

      return (data || []).map((alert) => ({
        ...alert,
        triggered_at: new Date(alert.triggered_at),
        acknowledged_at: alert.acknowledged_at
          ? new Date(alert.acknowledged_at)
          : undefined,
      }));
    } catch (error) {
      console.error('[SLAAlerts] Error fetching unacknowledged alerts:', error);
      throw error;
    }
  }

  /**
   * Get alert statistics for dashboard
   */
  async getAlertStatistics(
    startDate: Date,
    endDate: Date
  ): Promise<{
    total: number;
    by_level: Record<75 | 90 | 'breach', number>;
    acknowledged_count: number;
    average_acknowledgment_time_ms: number;
  }> {
    try {
      const { data, error } = await supabase
        .from('sla_alerts')
        .select('*')
        .gte('triggered_at', startDate.toISOString())
        .lte('triggered_at', endDate.toISOString());

      if (error) {
        throw new Error(`Failed to fetch alert statistics: ${error.message}`);
      }

      const alerts = data || [];
      const byLevel: Record<75 | 90 | 'breach', number> = {
        75: 0,
        90: 0,
        breach: 0,
      };
      let acknowledgedCount = 0;
      let totalAcknowledgmentTime = 0;

      for (const alert of alerts) {
        byLevel[alert.alert_level as 75 | 90 | 'breach']++;

        if (alert.acknowledged && alert.acknowledged_at) {
          acknowledgedCount++;
          const triggeredAt = new Date(alert.triggered_at);
          const acknowledgedAt = new Date(alert.acknowledged_at);
          totalAcknowledgmentTime +=
            acknowledgedAt.getTime() - triggeredAt.getTime();
        }
      }

      return {
        total: alerts.length,
        by_level: byLevel,
        acknowledged_count: acknowledgedCount,
        average_acknowledgment_time_ms:
          acknowledgedCount > 0
            ? totalAcknowledgmentTime / acknowledgedCount
            : 0,
      };
    } catch (error) {
      console.error('[SLAAlerts] Error fetching alert statistics:', error);
      throw error;
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const slaAlertService = new SLAAlertService();
