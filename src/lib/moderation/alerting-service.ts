/**
 * Alerting Service
 *
 * Manages alert delivery, escalation, and notification for monitoring events.
 * Integrates with existing notification system for compliance violations.
 *
 * Requirements: 5.5, 6.6, 10.5
 */

import { supabase } from '@/lib/supabase';

import type { MonitoringAlert } from './monitoring-service';

// ============================================================================
// Types
// ============================================================================

export interface AlertRule {
  id: string;
  name: string;
  metric_name: string;
  condition: 'greater_than' | 'less_than' | 'equals';
  threshold: number;
  severity: 'info' | 'warning' | 'error' | 'critical';
  enabled: boolean;
  notification_channels: AlertChannel[];
  cooldown_minutes: number; // Minimum time between alerts
  created_at: Date;
  updated_at: Date;
}

export type AlertChannel = 'email' | 'sms' | 'slack' | 'pagerduty' | 'webhook';

export interface AlertNotification {
  id: string;
  alert_id: string;
  channel: AlertChannel;
  recipient: string;
  status: 'pending' | 'sent' | 'failed';
  sent_at?: Date;
  error_message?: string;
  created_at: Date;
}

export interface AlertEscalation {
  id: string;
  alert_id: string;
  escalation_level: number;
  escalated_to: string;
  escalated_at: Date;
  acknowledged: boolean;
  acknowledged_at?: Date;
  acknowledged_by?: string;
}

// ============================================================================
// Alerting Service
// ============================================================================

export class AlertingService {
  /**
   * Process and send alerts
   */
  async processAlert(alert: MonitoringAlert): Promise<void> {
    // Check if alert should be sent (cooldown period)
    const shouldSend = await this.checkCooldown(alert);
    if (!shouldSend) {
      console.log(`[Alerting] Alert ${alert.id} in cooldown period, skipping`);
      return;
    }

    // Store alert
    await this.storeAlert(alert);

    // Get matching alert rules
    const rules = await this.getMatchingRules(alert);

    // Send notifications
    for (const rule of rules) {
      await this.sendNotifications(alert, rule);
    }

    // Escalate if critical
    if (alert.severity === 'critical') {
      await this.escalateAlert(alert);
    }
  }

  /**
   * Send notifications for an alert
   */
  private async sendNotifications(
    alert: MonitoringAlert,
    rule: AlertRule
  ): Promise<void> {
    for (const channel of rule.notification_channels) {
      try {
        await this.sendNotification(alert, channel, rule);
      } catch (error) {
        console.error(
          `[Alerting] Failed to send notification via ${channel}:`,
          error
        );
      }
    }
  }

  /**
   * Send notification via specific channel
   */
  private async sendNotification(
    alert: MonitoringAlert,
    channel: AlertChannel,
    rule: AlertRule
  ): Promise<void> {
    const notification: Omit<AlertNotification, 'id' | 'created_at'> = {
      alert_id: alert.id,
      channel,
      recipient: this.getRecipientForChannel(channel, rule),
      status: 'pending',
    };

    // Store notification record
    const { data, error } = await supabase
      .from('alert_notifications')
      .insert(notification)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create notification: ${error.message}`);
    }

    try {
      // Send via channel
      switch (channel) {
        case 'email':
          await this.sendEmailAlert(alert, notification.recipient);
          break;
        case 'slack':
          await this.sendSlackAlert(alert, notification.recipient);
          break;
        case 'webhook':
          await this.sendWebhookAlert(alert, notification.recipient);
          break;
        default:
          console.log(`[Alerting] Channel ${channel} not implemented`);
      }

      // Mark as sent
      await supabase
        .from('alert_notifications')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', data.id);
    } catch (error) {
      // Mark as failed
      await supabase
        .from('alert_notifications')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : String(error),
        })
        .eq('id', data.id);

      throw error;
    }
  }

  /**
   * Escalate critical alert
   */
  private async escalateAlert(alert: MonitoringAlert): Promise<void> {
    // Get escalation chain
    const escalationChain = await this.getEscalationChain(alert.category);

    for (let level = 0; level < escalationChain.length; level++) {
      const escalation: Omit<AlertEscalation, 'id'> = {
        alert_id: alert.id,
        escalation_level: level + 1,
        escalated_to: escalationChain[level],
        escalated_at: new Date(),
        acknowledged: false,
      };

      await supabase.from('alert_escalations').insert(escalation);

      // Send escalation notification
      await this.sendEscalationNotification(alert, escalationChain[level]);

      // Wait for acknowledgment or timeout
      const acknowledged = await this.waitForAcknowledgment(
        alert.id,
        level + 1,
        15 // 15 minutes timeout
      );

      if (acknowledged) {
        break; // Stop escalation if acknowledged
      }
    }
  }

  /**
   * Check if alert is in cooldown period
   */
  private async checkCooldown(alert: MonitoringAlert): Promise<boolean> {
    const cooldownMinutes = 30; // Default cooldown

    const { data: recentAlerts } = await supabase
      .from('monitoring_alerts')
      .select('created_at')
      .eq('metric_name', alert.metric_name)
      .eq('severity', alert.severity)
      .gte(
        'created_at',
        new Date(Date.now() - cooldownMinutes * 60 * 1000).toISOString()
      )
      .order('created_at', { ascending: false })
      .limit(1);

    return !recentAlerts || recentAlerts.length === 0;
  }

  /**
   * Store alert in database
   */
  private async storeAlert(alert: MonitoringAlert): Promise<void> {
    const { error } = await supabase.from('monitoring_alerts').insert({
      id: alert.id,
      severity: alert.severity,
      category: alert.category,
      message: alert.message,
      metric_name: alert.metric_name,
      metric_value: alert.metric_value,
      threshold: alert.threshold,
      created_at: alert.created_at.toISOString(),
    });

    if (error) {
      console.error('[Alerting] Failed to store alert:', error);
    }
  }

  /**
   * Get matching alert rules
   */
  private async getMatchingRules(alert: MonitoringAlert): Promise<AlertRule[]> {
    const { data: rules } = await supabase
      .from('alert_rules')
      .select('*')
      .eq('metric_name', alert.metric_name)
      .eq('enabled', true);

    if (!rules) return [];

    return rules.map((r) => ({
      id: r.id,
      name: r.name,
      metric_name: r.metric_name,
      condition: r.condition,
      threshold: r.threshold,
      severity: r.severity,
      enabled: r.enabled,
      notification_channels: r.notification_channels,
      cooldown_minutes: r.cooldown_minutes,
      created_at: new Date(r.created_at),
      updated_at: new Date(r.updated_at),
    }));
  }

  /**
   * Get recipient for notification channel
   */
  private getRecipientForChannel(
    channel: AlertChannel,
    _rule: AlertRule
  ): string {
    // In production, this would fetch from configuration
    const recipients: Record<AlertChannel, string> = {
      email: process.env.ALERT_EMAIL || 'alerts@growbro.app',
      sms: process.env.ALERT_SMS || '+1234567890',
      slack: process.env.ALERT_SLACK_WEBHOOK || '',
      pagerduty: process.env.ALERT_PAGERDUTY_KEY || '',
      webhook: process.env.ALERT_WEBHOOK_URL || '',
    };

    return recipients[channel];
  }

  /**
   * Send email alert
   */
  private async sendEmailAlert(
    alert: MonitoringAlert,
    recipient: string
  ): Promise<void> {
    // In production, integrate with email service (SendGrid, SES, etc.)
    console.log(`[Alerting] Sending email alert to ${recipient}:`, {
      subject: `[${alert.severity.toUpperCase()}] ${alert.message}`,
      body: this.formatAlertMessage(alert),
    });

    // Simulate email sending
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  /**
   * Send Slack alert
   */
  private async sendSlackAlert(
    alert: MonitoringAlert,
    webhookUrl: string
  ): Promise<void> {
    if (!webhookUrl) {
      console.log('[Alerting] Slack webhook URL not configured');
      return;
    }

    const payload = {
      text: this.formatAlertMessage(alert),
      attachments: [
        {
          color: this.getSeverityColor(alert.severity),
          fields: [
            {
              title: 'Metric',
              value: alert.metric_name,
              short: true,
            },
            {
              title: 'Value',
              value: alert.metric_value.toString(),
              short: true,
            },
            {
              title: 'Threshold',
              value: alert.threshold.toString(),
              short: true,
            },
            {
              title: 'Severity',
              value: alert.severity.toUpperCase(),
              short: true,
            },
          ],
          footer: 'GrowBro Moderation Monitoring',
          ts: Math.floor(alert.created_at.getTime() / 1000),
        },
      ],
    };

    // In production, use fetch to send to Slack
    console.log('[Alerting] Sending Slack alert:', payload);
  }

  /**
   * Send webhook alert
   */
  private async sendWebhookAlert(
    alert: MonitoringAlert,
    webhookUrl: string
  ): Promise<void> {
    if (!webhookUrl) {
      console.log('[Alerting] Webhook URL not configured');
      return;
    }

    const payload = {
      alert_id: alert.id,
      severity: alert.severity,
      category: alert.category,
      message: alert.message,
      metric_name: alert.metric_name,
      metric_value: alert.metric_value,
      threshold: alert.threshold,
      created_at: alert.created_at.toISOString(),
    };

    // In production, use fetch to send webhook
    console.log('[Alerting] Sending webhook alert:', payload);
  }

  /**
   * Send escalation notification
   */
  private async sendEscalationNotification(
    alert: MonitoringAlert,
    recipient: string
  ): Promise<void> {
    console.log(`[Alerting] Escalating alert ${alert.id} to ${recipient}`);

    // Send via multiple channels for critical escalations
    await this.sendEmailAlert(alert, recipient);
  }

  /**
   * Wait for alert acknowledgment
   */
  private async waitForAcknowledgment(
    alertId: string,
    escalationLevel: number,
    timeoutMinutes: number
  ): Promise<boolean> {
    const startTime = Date.now();
    const timeoutMs = timeoutMinutes * 60 * 1000;

    while (Date.now() - startTime < timeoutMs) {
      const { data: escalation } = await supabase
        .from('alert_escalations')
        .select('acknowledged')
        .eq('alert_id', alertId)
        .eq('escalation_level', escalationLevel)
        .single();

      if (escalation?.acknowledged) {
        return true;
      }

      // Wait 30 seconds before checking again
      await new Promise((resolve) => setTimeout(resolve, 30000));
    }

    return false;
  }

  /**
   * Get escalation chain for category
   */
  private async getEscalationChain(
    category: MonitoringAlert['category']
  ): Promise<string[]> {
    // In production, fetch from configuration
    const chains: Record<MonitoringAlert['category'], string[]> = {
      performance: ['team-lead@growbro.app', 'engineering-manager@growbro.app'],
      error: ['on-call@growbro.app', 'engineering-manager@growbro.app'],
      compliance: [
        'compliance-officer@growbro.app',
        'legal@growbro.app',
        'ceo@growbro.app',
      ],
      capacity: ['devops@growbro.app', 'engineering-manager@growbro.app'],
      audit_integrity: [
        'security@growbro.app',
        'compliance-officer@growbro.app',
        'ceo@growbro.app',
      ],
    };

    return chains[category] || ['on-call@growbro.app'];
  }

  /**
   * Format alert message
   */
  private formatAlertMessage(alert: MonitoringAlert): string {
    return `
[${alert.severity.toUpperCase()}] ${alert.message}

Category: ${alert.category}
Metric: ${alert.metric_name}
Current Value: ${alert.metric_value}
Threshold: ${alert.threshold}
Time: ${alert.created_at.toISOString()}
    `.trim();
  }

  /**
   * Get severity color for Slack
   */
  private getSeverityColor(severity: MonitoringAlert['severity']): string {
    const colors = {
      info: '#36a64f',
      warning: '#ff9900',
      error: '#ff0000',
      critical: '#8b0000',
    };

    return colors[severity];
  }

  /**
   * Acknowledge alert
   */
  async acknowledgeAlert(
    alertId: string,
    escalationLevel: number,
    acknowledgedBy: string
  ): Promise<void> {
    await supabase
      .from('alert_escalations')
      .update({
        acknowledged: true,
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: acknowledgedBy,
      })
      .eq('alert_id', alertId)
      .eq('escalation_level', escalationLevel);
  }

  /**
   * Get alert history
   */
  async getAlertHistory(params: {
    category?: MonitoringAlert['category'];
    severity?: MonitoringAlert['severity'];
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<MonitoringAlert[]> {
    let query = supabase
      .from('monitoring_alerts')
      .select('*')
      .order('created_at', { ascending: false });

    if (params.category) {
      query = query.eq('category', params.category);
    }

    if (params.severity) {
      query = query.eq('severity', params.severity);
    }

    if (params.startDate) {
      query = query.gte('created_at', params.startDate.toISOString());
    }

    if (params.endDate) {
      query = query.lte('created_at', params.endDate.toISOString());
    }

    if (params.limit) {
      query = query.limit(params.limit);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch alert history: ${error.message}`);
    }

    return (data || []).map((a) => ({
      id: a.id,
      severity: a.severity,
      category: a.category,
      message: a.message,
      metric_name: a.metric_name,
      metric_value: a.metric_value,
      threshold: a.threshold,
      created_at: new Date(a.created_at),
    }));
  }
}

export const alertingService = new AlertingService();
