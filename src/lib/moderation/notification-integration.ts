/**
 * Notification Integration for Moderation System
 *
 * Integrates moderation notifications with the existing notification infrastructure
 * Handles scheduling, delivery tracking, and compliance monitoring
 *
 * Requirements:
 * - 3.5: Deliver SoR within 15 minutes
 * - 4.1: Appeal deadline notifications
 * - 5.2: SLA breach alerts
 */

import type {
  ModerationDecision,
  ModeratorAlertData,
  StatementOfReasons,
} from '@/types/moderation';

import { supabase } from '../supabase';
import { moderationNotificationService } from './moderation-notification-service';

/**
 * Integration service for moderation notifications
 * Coordinates between moderation events and notification delivery
 */
export class NotificationIntegration {
  /**
   * Handle moderation decision notification workflow
   * Sends SoR and schedules appeal deadline reminders
   */
  async handleModerationDecision(
    userId: string,
    decision: ModerationDecision,
    statement: StatementOfReasons
  ): Promise<void> {
    try {
      // Send Statement of Reasons immediately (DSA Art. 17 - 15 minute requirement)
      await moderationNotificationService.sendStatementOfReasons(
        userId,
        decision,
        statement
      );

      // Calculate and schedule appeal deadline notifications
      const appealDeadline = this.calculateAppealDeadline(decision);

      // Schedule deadline reminder (24 hours before)
      await moderationNotificationService.scheduleAppealDeadlineReminder(
        userId,
        decision.id,
        appealDeadline
      );

      // Schedule deadline notification (7 days before for 14-day deadline)
      if (this.shouldSendEarlyReminder(decision)) {
        const earlyReminderDate = new Date(
          appealDeadline.getTime() - 7 * 24 * 60 * 60 * 1000
        );

        if (earlyReminderDate > new Date()) {
          await moderationNotificationService.sendAppealDeadlineNotification(
            userId,
            decision.id,
            appealDeadline
          );
        }
      }

      // Verify SoR delivery compliance (15-minute requirement)
      await this.verifySoRDeliveryCompliance(decision.id);
    } catch (error) {
      console.error(
        '[NotificationIntegration] Failed to handle moderation decision:',
        error
      );
      // Log error but don't throw - notification failure shouldn't block decision
      await this.logIntegrationError('moderation_decision', decision.id, error);
    }
  }

  /**
   * Handle SLA monitoring alerts
   * Sends alerts to moderators at 75%, 90%, and breach thresholds
   */
  async handleSLAAlert(
    reportId: string,
    slaPercentage: number,
    assignedModeratorId?: string
  ): Promise<void> {
    try {
      // Determine alert type based on SLA percentage
      const alertType =
        slaPercentage >= 100
          ? 'sla_breach'
          : ('sla_warning' as 'sla_breach' | 'sla_warning');

      // Determine priority based on SLA percentage
      const priority = this.determinePriority(slaPercentage);

      // Get moderators to alert
      const moderatorIds = await this.getModeratorsToAlert(
        reportId,
        assignedModeratorId
      );

      // Send alerts to all relevant moderators
      for (const moderatorId of moderatorIds) {
        const alertData: ModeratorAlertData = {
          moderatorId,
          type: alertType,
          reportId,
          priority,
          slaPercentage,
        };

        if (alertType === 'sla_breach') {
          await moderationNotificationService.sendSLABreachAlert(alertData);
        } else {
          await moderationNotificationService.sendSLAWarning(alertData);
        }
      }
    } catch (error) {
      console.error(
        '[NotificationIntegration] Failed to handle SLA alert:',
        error
      );
      await this.logIntegrationError('sla_alert', reportId, error);
    }
  }

  /**
   * Handle escalation to supervisor
   */
  async handleEscalation(
    reportId: string,
    reason: string,
    supervisorId?: string
  ): Promise<void> {
    try {
      // Get supervisor to notify
      const targetSupervisorId =
        supervisorId || (await this.getAvailableSupervisor());

      if (!targetSupervisorId) {
        console.warn(
          '[NotificationIntegration] No supervisor available for escalation'
        );
        return;
      }

      await moderationNotificationService.sendEscalationAlert(
        targetSupervisorId,
        reportId,
        reason
      );
    } catch (error) {
      console.error(
        '[NotificationIntegration] Failed to handle escalation:',
        error
      );
      await this.logIntegrationError('escalation', reportId, error);
    }
  }

  /**
   * Verify SoR delivery compliance (15-minute requirement)
   */
  private async verifySoRDeliveryCompliance(decisionId: string): Promise<void> {
    try {
      // Wait a short time to allow notification to be logged
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const { data, error } = await supabase.rpc(
        'check_sor_delivery_compliance',
        {
          p_decision_id: decisionId,
        }
      );

      if (error) {
        console.error(
          '[NotificationIntegration] Failed to verify SoR delivery:',
          error
        );
        return;
      }

      if (data && data.length > 0) {
        const compliance = data[0];

        if (!compliance.is_compliant) {
          console.warn(
            `[NotificationIntegration] SoR delivery exceeded 15-minute requirement: ${compliance.delivery_time_minutes} minutes`
          );

          // Log compliance violation
          await this.logComplianceViolation(
            decisionId,
            'sor_delivery_timeout',
            compliance.delivery_time_minutes
          );
        }
      }
    } catch (error) {
      console.error(
        '[NotificationIntegration] Error verifying SoR compliance:',
        error
      );
    }
  }

  /**
   * Calculate appeal deadline based on decision action
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
   * Check if early reminder should be sent (for longer deadlines)
   */
  private shouldSendEarlyReminder(decision: ModerationDecision): boolean {
    // Send early reminder for serious actions with 30-day deadlines
    return (
      decision.action === 'suspend_user' || decision.action === 'shadow_ban'
    );
  }

  /**
   * Determine alert priority based on SLA percentage
   */
  private determinePriority(
    slaPercentage: number
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (slaPercentage >= 100) return 'critical';
    if (slaPercentage >= 90) return 'high';
    if (slaPercentage >= 75) return 'medium';
    return 'low';
  }

  /**
   * Get moderators to alert for SLA issues
   */
  private async getModeratorsToAlert(
    reportId: string,
    assignedModeratorId?: string
  ): Promise<string[]> {
    const moderators: string[] = [];

    // Always alert assigned moderator if exists
    if (assignedModeratorId) {
      moderators.push(assignedModeratorId);
    }

    // Get supervisors for critical alerts
    const { data: supervisors } = await supabase
      .from('moderator_sessions')
      .select('moderator_id')
      .eq('role', 'supervisor')
      .eq('is_active', true);

    if (supervisors) {
      moderators.push(...supervisors.map((s) => s.moderator_id));
    }

    return [...new Set(moderators)]; // Remove duplicates
  }

  /**
   * Get available supervisor for escalation
   */
  private async getAvailableSupervisor(): Promise<string | null> {
    const { data } = await supabase
      .from('moderator_sessions')
      .select('moderator_id')
      .eq('role', 'supervisor')
      .eq('is_active', true)
      .order('last_activity_at', { ascending: false })
      .limit(1)
      .single();

    return data?.moderator_id || null;
  }

  /**
   * Log integration error for debugging
   */
  private async logIntegrationError(
    context: string,
    entityId: string,
    error: any
  ): Promise<void> {
    try {
      await supabase.from('notification_integration_errors').insert({
        context,
        entity_id: entityId,
        error_message: error?.message || 'Unknown error',
        error_stack: error?.stack,
        created_at: new Date().toISOString(),
      });
    } catch (logError) {
      console.error(
        '[NotificationIntegration] Failed to log integration error:',
        logError
      );
    }
  }

  /**
   * Log compliance violation
   */
  private async logComplianceViolation(
    decisionId: string,
    violationType: string,
    deliveryTimeMinutes: number
  ): Promise<void> {
    try {
      await supabase.from('compliance_violations').insert({
        decision_id: decisionId,
        violation_type: violationType,
        delivery_time_minutes: deliveryTimeMinutes,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error(
        '[NotificationIntegration] Failed to log compliance violation:',
        error
      );
    }
  }
}

/**
 * Singleton instance
 */
export const notificationIntegration = new NotificationIntegration();
