/**
 * Moderation Notification Service
 *
 * Handles notifications for moderation decisions, SLA breaches, and appeals
 * Implements DSA Art. 17 (Statement of Reasons delivery) and Art. 20 (Appeal notifications)
 *
 * Requirements:
 * - 3.5: Deliver Statement of Reasons within 15 minutes
 * - 4.1: Appeal deadline notifications and status updates
 * - 5.2: SLA breach alerts for moderators
 */

import * as Notifications from 'expo-notifications';

import type {
  ModerationAction,
  ModerationDecision,
  StatementOfReasons,
} from '@/types/moderation';

import { supabase } from '../supabase';

export interface ModerationNotificationData {
  userId: string;
  type:
    | 'decision_made'
    | 'sor_delivered'
    | 'appeal_deadline'
    | 'sla_breach'
    | 'sla_warning';
  decision?: ModerationDecision;
  statementOfReasons?: StatementOfReasons;
  action?: ModerationAction;
  deadlineDate?: Date;
  reportId?: string;
  slaPercentage?: number;
}

export interface ModeratorAlertData {
  moderatorId: string;
  type: 'sla_breach' | 'sla_warning' | 'escalation_required';
  reportId: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  slaPercentage?: number;
  deadlineDate?: Date;
}

/**
 * Moderation Notification Service
 * Manages user and moderator notifications for moderation events
 */
export class ModerationNotificationService {
  /**
   * Send Statement of Reasons to user (DSA Art. 17)
   * Must be delivered within 15 minutes of decision
   */
  async sendStatementOfReasons(
    userId: string,
    decision: ModerationDecision,
    statement: StatementOfReasons
  ): Promise<void> {
    try {
      const { title, body } = this.formatSoRNotification(decision, statement);

      // Send push notification
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: {
            type: 'moderation_decision',
            decisionId: decision.id,
            statementId: statement.id,
            userId,
          },
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: null, // Send immediately
      });

      // Log delivery for audit trail
      await this.logNotificationDelivery({
        userId,
        type: 'sor_delivered',
        decision,
        statementOfReasons: statement,
      });

      // Also send via email for important decisions
      if (this.requiresEmailNotification(decision.action)) {
        await this.sendEmailNotification(userId, decision, statement);
      }
    } catch (error) {
      console.error(
        '[ModerationNotifications] Failed to send SoR notification:',
        error
      );
      // Log failure but don't throw - notification failure shouldn't block decision
      await this.logNotificationFailure(userId, 'sor_delivered', error);
    }
  }

  /**
   * Send moderation decision notification to user
   */
  async sendDecisionNotification(
    userId: string,
    decision: ModerationDecision
  ): Promise<void> {
    try {
      const { title, body } = this.formatDecisionNotification(decision);

      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: {
            type: 'moderation_decision',
            decisionId: decision.id,
            userId,
            action: decision.action,
          },
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: null,
      });

      await this.logNotificationDelivery({
        userId,
        type: 'decision_made',
        decision,
      });
    } catch (error) {
      console.error(
        '[ModerationNotifications] Failed to send decision notification:',
        error
      );
      await this.logNotificationFailure(userId, 'decision_made', error);
    }
  }

  /**
   * Send appeal deadline notification to user
   */
  async sendAppealDeadlineNotification(
    userId: string,
    decisionId: string,
    deadlineDate: Date
  ): Promise<void> {
    try {
      const daysRemaining = Math.ceil(
        (deadlineDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );

      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Appeal Deadline Approaching',
          body: `You have ${daysRemaining} days remaining to appeal this moderation decision.`,
          data: {
            type: 'appeal_deadline',
            decisionId,
            userId,
            deadlineDate: deadlineDate.toISOString(),
          },
          sound: true,
          priority: Notifications.AndroidNotificationPriority.DEFAULT,
        },
        trigger: null,
      });

      await this.logNotificationDelivery({
        userId,
        type: 'appeal_deadline',
        deadlineDate,
      });
    } catch (error) {
      console.error(
        '[ModerationNotifications] Failed to send appeal deadline notification:',
        error
      );
      await this.logNotificationFailure(userId, 'appeal_deadline', error);
    }
  }

  /**
   * Schedule appeal deadline reminder
   * Sends notification 24 hours before deadline
   */
  async scheduleAppealDeadlineReminder(
    userId: string,
    decisionId: string,
    deadlineDate: Date
  ): Promise<void> {
    try {
      const reminderDate = new Date(
        deadlineDate.getTime() - 24 * 60 * 60 * 1000
      );

      if (reminderDate < new Date()) {
        return; // Deadline is less than 24 hours away
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Appeal Deadline Tomorrow',
          body: 'Your appeal deadline is tomorrow. Submit your appeal to contest this decision.',
          data: {
            type: 'appeal_deadline_reminder',
            decisionId,
            userId,
          },
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: reminderDate,
        },
      });
    } catch (error) {
      console.error(
        '[ModerationNotifications] Failed to schedule appeal reminder:',
        error
      );
    }
  }

  /**
   * Send SLA breach alert to moderators
   */
  async sendSLABreachAlert(data: ModeratorAlertData): Promise<void> {
    try {
      const { title, body } = this.formatModeratorAlert(data);

      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: {
            type: 'moderator_alert',
            alertType: data.type,
            reportId: data.reportId,
            moderatorId: data.moderatorId,
            priority: data.priority,
          },
          sound: true,
          priority:
            data.priority === 'critical'
              ? Notifications.AndroidNotificationPriority.MAX
              : Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: null,
      });

      // Log alert for audit
      await this.logModeratorAlert(data);
    } catch (error) {
      console.error(
        '[ModerationNotifications] Failed to send SLA breach alert:',
        error
      );
    }
  }

  /**
   * Send SLA warning to moderators (75% or 90% threshold)
   */
  async sendSLAWarning(data: ModeratorAlertData): Promise<void> {
    try {
      const { title, body } = this.formatModeratorAlert(data);

      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: {
            type: 'moderator_alert',
            alertType: data.type,
            reportId: data.reportId,
            moderatorId: data.moderatorId,
            slaPercentage: data.slaPercentage,
          },
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: null,
      });

      await this.logModeratorAlert(data);
    } catch (error) {
      console.error(
        '[ModerationNotifications] Failed to send SLA warning:',
        error
      );
    }
  }

  /**
   * Send escalation required alert to supervisors
   */
  async sendEscalationAlert(
    supervisorId: string,
    reportId: string,
    reason: string
  ): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Escalation Required',
          body: `Report ${reportId} requires supervisor review: ${reason}`,
          data: {
            type: 'moderator_alert',
            alertType: 'escalation_required',
            reportId,
            moderatorId: supervisorId,
            priority: 'high',
          },
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: null,
      });

      await this.logModeratorAlert({
        moderatorId: supervisorId,
        type: 'escalation_required',
        reportId,
        priority: 'high',
      });
    } catch (error) {
      console.error(
        '[ModerationNotifications] Failed to send escalation alert:',
        error
      );
    }
  }

  /**
   * Format Statement of Reasons notification content
   */
  private formatSoRNotification(
    decision: ModerationDecision,
    _statement: StatementOfReasons
  ): { title: string; body: string } {
    const actionText = this.getActionText(decision.action);

    return {
      title: 'Moderation Decision',
      body: `Your content has been ${actionText}. Tap to view the full Statement of Reasons and appeal options.`,
    };
  }

  /**
   * Format decision notification content
   */
  private formatDecisionNotification(decision: ModerationDecision): {
    title: string;
    body: string;
  } {
    const actionText = this.getActionText(decision.action);

    return {
      title: 'Content Moderation Update',
      body: `Action taken: ${actionText}. You can appeal this decision within 14 days.`,
    };
  }

  /**
   * Format moderator alert content
   */
  private formatModeratorAlert(data: ModeratorAlertData): {
    title: string;
    body: string;
  } {
    switch (data.type) {
      case 'sla_breach':
        return {
          title: 'SLA Breach',
          body: `Report ${data.reportId} has exceeded its SLA deadline. Immediate action required.`,
        };

      case 'sla_warning':
        return {
          title: `SLA Warning (${data.slaPercentage}%)`,
          body: `Report ${data.reportId} is approaching its SLA deadline. Review required.`,
        };

      case 'escalation_required':
        return {
          title: 'Escalation Required',
          body: `Report ${data.reportId} requires supervisor review.`,
        };

      default:
        return {
          title: 'Moderator Alert',
          body: `Report ${data.reportId} requires attention.`,
        };
    }
  }

  /**
   * Get human-readable action text
   */
  private getActionText(action: ModerationAction): string {
    const actionMap: Record<ModerationAction, string> = {
      no_action: 'reviewed with no action taken',
      quarantine: 'quarantined',
      geo_block: 'geo-blocked',
      remove: 'removed',
      suspend_user: 'resulted in account suspension',
      rate_limit: 'rate-limited',
      shadow_ban: 'shadow-banned',
    };

    return actionMap[action] || 'moderated';
  }

  /**
   * Check if decision requires email notification
   */
  private requiresEmailNotification(action: ModerationAction): boolean {
    // Send email for serious actions
    return ['remove', 'suspend_user', 'shadow_ban'].includes(action);
  }

  /**
   * Send email notification via Supabase Edge Function
   */
  private async sendEmailNotification(
    userId: string,
    decision: ModerationDecision,
    statement: StatementOfReasons
  ): Promise<void> {
    try {
      await supabase.functions.invoke('send-moderation-email', {
        body: {
          userId,
          decisionId: decision.id,
          statementId: statement.id,
          action: decision.action,
          appealDeadline: this.calculateAppealDeadline(decision),
        },
      });
    } catch (error) {
      console.error(
        '[ModerationNotifications] Failed to send email notification:',
        error
      );
      // Don't throw - email failure shouldn't block push notification
    }
  }

  /**
   * Calculate appeal deadline based on action type
   */
  private calculateAppealDeadline(decision: ModerationDecision): Date {
    const now = new Date();
    const daysToAdd =
      decision.action === 'suspend_user' || decision.action === 'shadow_ban'
        ? 30
        : 14;

    return new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
  }

  /**
   * Log notification delivery for audit trail
   */
  private async logNotificationDelivery(
    data: ModerationNotificationData
  ): Promise<void> {
    try {
      await supabase.from('notification_delivery_log').insert({
        user_id: data.userId,
        notification_type: data.type,
        decision_id: data.decision?.id,
        statement_id: data.statementOfReasons?.id,
        delivered_at: new Date().toISOString(),
        status: 'delivered',
      });
    } catch (error) {
      console.error(
        '[ModerationNotifications] Failed to log notification delivery:',
        error
      );
    }
  }

  /**
   * Log notification failure for audit trail
   */
  private async logNotificationFailure(
    userId: string,
    type: string,
    error: any
  ): Promise<void> {
    try {
      await supabase.from('notification_delivery_log').insert({
        user_id: userId,
        notification_type: type,
        delivered_at: new Date().toISOString(),
        status: 'failed',
        error_message: error?.message || 'Unknown error',
      });
    } catch (logError) {
      console.error(
        '[ModerationNotifications] Failed to log notification failure:',
        logError
      );
    }
  }

  /**
   * Log moderator alert for audit trail
   */
  private async logModeratorAlert(data: ModeratorAlertData): Promise<void> {
    try {
      await supabase.from('moderator_alert_log').insert({
        moderator_id: data.moderatorId,
        alert_type: data.type,
        report_id: data.reportId,
        priority: data.priority,
        sla_percentage: data.slaPercentage,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error(
        '[ModerationNotifications] Failed to log moderator alert:',
        error
      );
    }
  }
}

/**
 * Singleton instance
 */
export const moderationNotificationService =
  new ModerationNotificationService();
