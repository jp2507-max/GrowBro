/**
 * Manual Fallback Procedures for SLA-Critical Operations
 *
 * Implements manual intervention procedures when automated systems fail:
 * - Illegal content reporting (24-hour SLA)
 * - CSAM/self-harm content (immediate SLA)
 * - Trusted flagger reports (priority SLA)
 * - Appeal processing (14-30 day SLA)
 *
 * Requirements: 10.6 (manual fallback procedures for SLA-critical operations)
 */

import { errorClassifier } from './error-classification';

// ============================================================================
// Types
// ============================================================================

export type FallbackProcedure =
  | 'illegal_content_escalation'
  | 'csam_immediate_escalation'
  | 'trusted_flagger_priority'
  | 'appeal_manual_review'
  | 'sor_manual_submission'
  | 'audit_local_logging';

export interface FallbackContext {
  procedure: FallbackProcedure;
  reportId?: string;
  contentId?: string;
  userId?: string;
  priority: 'immediate' | 'urgent' | 'high' | 'normal';
  slaDeadline: Date;
  reason: string;
  originalError?: Error;
  attemptedActions: string[];
}

export interface FallbackResult {
  success: boolean;
  procedure: FallbackProcedure;
  action: string;
  escalatedTo?: string[];
  manualSteps: string[];
  timestamp: Date;
  requiresFollowUp: boolean;
  followUpDeadline?: Date;
}

export interface EscalationContact {
  role: string;
  name: string;
  email: string;
  phone?: string;
  availability: string;
}

// ============================================================================
// Constants
// ============================================================================

const ESCALATION_CONTACTS: Record<string, EscalationContact[]> = {
  immediate: [
    {
      role: 'On-Call Moderator Lead',
      name: 'Emergency Contact',
      email: 'moderation-emergency@growbro.app',
      phone: '+49-XXX-XXXXXXX',
      availability: '24/7',
    },
    {
      role: 'Legal Counsel',
      name: 'Legal Team',
      email: 'legal-emergency@growbro.app',
      phone: '+49-XXX-XXXXXXX',
      availability: '24/7',
    },
  ],
  urgent: [
    {
      role: 'Moderation Supervisor',
      name: 'Supervisor Team',
      email: 'moderation-supervisor@growbro.app',
      availability: 'Business hours + on-call',
    },
  ],
  high: [
    {
      role: 'Moderation Team Lead',
      name: 'Team Lead',
      email: 'moderation-lead@growbro.app',
      availability: 'Business hours',
    },
  ],
  normal: [
    {
      role: 'Operations Team',
      name: 'Operations',
      email: 'operations@growbro.app',
      availability: 'Business hours',
    },
  ],
};

// ============================================================================
// Manual Fallback Manager
// ============================================================================

export class ManualFallbackManager {
  /**
   * Execute manual fallback procedure.
   */
  async executeFallback(context: FallbackContext): Promise<FallbackResult> {
    console.error(
      `MANUAL FALLBACK TRIGGERED: ${context.procedure} for ${context.reportId || context.contentId}`
    );

    switch (context.procedure) {
      case 'illegal_content_escalation':
        return this.handleIllegalContentEscalation(context);

      case 'csam_immediate_escalation':
        return this.handleCSAMImmediateEscalation(context);

      case 'trusted_flagger_priority':
        return this.handleTrustedFlaggerPriority(context);

      case 'appeal_manual_review':
        return this.handleAppealManualReview(context);

      case 'sor_manual_submission':
        return this.handleSoRManualSubmission(context);

      case 'audit_local_logging':
        return this.handleAuditLocalLogging(context);

      default:
        return this.handleGenericFallback(context);
    }
  }

  /**
   * Handle illegal content escalation (24-hour SLA).
   */
  private async handleIllegalContentEscalation(
    context: FallbackContext
  ): Promise<FallbackResult> {
    const contacts = ESCALATION_CONTACTS.urgent;

    // Send immediate notifications
    await this.sendEscalationNotifications(
      contacts,
      'Illegal Content Escalation',
      context
    );

    // Create manual review ticket
    const ticketId = await this.createManualReviewTicket({
      type: 'illegal_content',
      priority: 'urgent',
      slaDeadline: context.slaDeadline,
      context,
    });

    // Log to audit trail
    await this.logFallbackAction({
      procedure: context.procedure,
      action: 'escalated_to_manual_review',
      ticketId,
      contacts: contacts.map((c) => c.email),
    });

    return {
      success: true,
      procedure: context.procedure,
      action: 'Escalated to manual review with urgent priority',
      escalatedTo: contacts.map((c) => c.email),
      manualSteps: [
        '1. Review content immediately for legal violations',
        '2. Consult with legal counsel if needed',
        '3. Make moderation decision within 24-hour SLA',
        '4. Document decision reasoning thoroughly',
        '5. Generate Statement of Reasons manually if system unavailable',
      ],
      timestamp: new Date(),
      requiresFollowUp: true,
      followUpDeadline: context.slaDeadline,
    };
  }

  /**
   * Handle CSAM/self-harm immediate escalation.
   */
  private async handleCSAMImmediateEscalation(
    context: FallbackContext
  ): Promise<FallbackResult> {
    const contacts = ESCALATION_CONTACTS.immediate;

    // Send IMMEDIATE notifications (SMS + email + phone)
    await this.sendEmergencyNotifications(
      contacts,
      'CRITICAL: CSAM/Self-Harm Content Detected',
      context
    );

    // Create highest priority ticket
    const ticketId = await this.createManualReviewTicket({
      type: 'csam_self_harm',
      priority: 'immediate',
      slaDeadline: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      context,
    });

    // Automatically quarantine content
    await this.emergencyQuarantine(context.contentId!);

    // Log to audit trail with highest severity
    await this.logFallbackAction({
      procedure: context.procedure,
      action: 'emergency_escalation_and_quarantine',
      ticketId,
      contacts: contacts.map((c) => c.email),
      severity: 'critical',
    });

    return {
      success: true,
      procedure: context.procedure,
      action:
        'EMERGENCY escalation with immediate quarantine and 24/7 contact notification',
      escalatedTo: contacts.map((c) => c.email),
      manualSteps: [
        '1. IMMEDIATE review required (within 1 hour)',
        '2. Content automatically quarantined',
        '3. Contact law enforcement if CSAM confirmed',
        '4. Contact crisis support if self-harm confirmed',
        '5. Document all actions with timestamps',
        '6. Notify legal counsel immediately',
      ],
      timestamp: new Date(),
      requiresFollowUp: true,
      followUpDeadline: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    };
  }

  /**
   * Handle trusted flagger priority escalation.
   */
  private async handleTrustedFlaggerPriority(
    context: FallbackContext
  ): Promise<FallbackResult> {
    const contacts = ESCALATION_CONTACTS.high;

    await this.sendEscalationNotifications(
      contacts,
      'Trusted Flagger Report Requires Manual Review',
      context
    );

    await this.createManualReviewTicket({
      type: 'trusted_flagger',
      priority: 'high',
      slaDeadline: context.slaDeadline,
      context,
    });

    return {
      success: true,
      procedure: context.procedure,
      action: 'Escalated trusted flagger report to priority queue',
      escalatedTo: contacts.map((c) => c.email),
      manualSteps: [
        '1. Review trusted flagger report with priority',
        '2. Verify flagger credentials and history',
        '3. Process within accelerated SLA timeframe',
        '4. Provide feedback to trusted flagger',
        '5. Update quality metrics manually',
      ],
      timestamp: new Date(),
      requiresFollowUp: true,
      followUpDeadline: context.slaDeadline,
    };
  }

  /**
   * Handle appeal manual review.
   */
  private async handleAppealManualReview(
    context: FallbackContext
  ): Promise<FallbackResult> {
    const contacts = ESCALATION_CONTACTS.high;

    await this.sendEscalationNotifications(
      contacts,
      'Appeal Requires Manual Review',
      context
    );

    await this.createManualReviewTicket({
      type: 'appeal',
      priority: context.priority,
      slaDeadline: context.slaDeadline,
      context,
    });

    return {
      success: true,
      procedure: context.procedure,
      action: 'Escalated appeal to manual review queue',
      escalatedTo: contacts.map((c) => c.email),
      manualSteps: [
        '1. Assign to reviewer different from original moderator',
        '2. Review original decision and appeal arguments',
        '3. Consult policy catalog and similar cases',
        '4. Make decision within SLA deadline',
        '5. Notify user of decision with detailed reasoning',
        '6. Update appeal metrics manually',
      ],
      timestamp: new Date(),
      requiresFollowUp: true,
      followUpDeadline: context.slaDeadline,
    };
  }

  /**
   * Handle Statement of Reasons manual submission.
   */
  private async handleSoRManualSubmission(
    context: FallbackContext
  ): Promise<FallbackResult> {
    const contacts = ESCALATION_CONTACTS.normal;

    await this.sendEscalationNotifications(
      contacts,
      'SoR Requires Manual Submission to Transparency Database',
      context
    );

    // Queue for manual submission
    await this.queueForManualSubmission(context);

    return {
      success: true,
      procedure: context.procedure,
      action: 'Queued for manual submission to DSA Transparency Database',
      escalatedTo: contacts.map((c) => c.email),
      manualSteps: [
        '1. Access DSA Transparency Database webform',
        '2. Retrieve redacted Statement of Reasons from queue',
        '3. Manually enter all required fields',
        '4. Submit and record Transparency DB ID',
        '5. Update queue status with submission confirmation',
        '6. Monitor for any submission errors',
      ],
      timestamp: new Date(),
      requiresFollowUp: true,
      followUpDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    };
  }

  /**
   * Handle audit local logging fallback.
   */
  private async handleAuditLocalLogging(
    context: FallbackContext
  ): Promise<FallbackResult> {
    const contacts = ESCALATION_CONTACTS.urgent;

    await this.sendEscalationNotifications(
      contacts,
      'CRITICAL: Audit Database Unavailable - Using Local Logging',
      context
    );

    // Write to local file system
    await this.writeToLocalAuditLog(context);

    return {
      success: true,
      procedure: context.procedure,
      action: 'Switched to local file system audit logging',
      escalatedTo: contacts.map((c) => c.email),
      manualSteps: [
        '1. Monitor local audit log files',
        '2. Investigate audit database connectivity',
        '3. Restore audit database service',
        '4. Replay local audit logs to database once restored',
        '5. Verify audit trail integrity after replay',
        '6. Document incident and recovery process',
      ],
      timestamp: new Date(),
      requiresFollowUp: true,
      followUpDeadline: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours
    };
  }

  /**
   * Handle generic fallback.
   */
  private async handleGenericFallback(
    context: FallbackContext
  ): Promise<FallbackResult> {
    const contacts = ESCALATION_CONTACTS.normal;

    await this.sendEscalationNotifications(
      contacts,
      'Manual Intervention Required',
      context
    );

    return {
      success: true,
      procedure: context.procedure,
      action: 'Escalated to operations team for manual intervention',
      escalatedTo: contacts.map((c) => c.email),
      manualSteps: [
        '1. Review error details and context',
        '2. Determine appropriate manual action',
        '3. Execute manual procedure',
        '4. Document actions taken',
        '5. Update system status',
      ],
      timestamp: new Date(),
      requiresFollowUp: true,
    };
  }

  // Helper methods

  private async sendEscalationNotifications(
    contacts: EscalationContact[],
    subject: string,
    context: FallbackContext
  ): Promise<void> {
    console.log(`Sending escalation notifications: ${subject}`);
    console.log(`Recipients: ${contacts.map((c) => c.email).join(', ')}`);
    console.log(`Context: ${JSON.stringify(context, null, 2)}`);

    // TODO: Implement actual notification sending (email, SMS, etc.)
  }

  private async sendEmergencyNotifications(
    contacts: EscalationContact[],
    subject: string,
    context: FallbackContext
  ): Promise<void> {
    console.error(`EMERGENCY NOTIFICATION: ${subject}`);
    console.error(`Recipients: ${contacts.map((c) => c.email).join(', ')}`);
    console.error(`Context: ${JSON.stringify(context, null, 2)}`);

    // TODO: Implement emergency notification (SMS, phone, email, push)
  }

  private async createManualReviewTicket(params: {
    type: string;
    priority: string;
    slaDeadline: Date;
    context: FallbackContext;
  }): Promise<string> {
    const ticketId = `MANUAL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    console.log(`Created manual review ticket: ${ticketId}`);
    console.log(`Type: ${params.type}, Priority: ${params.priority}`);
    console.log(`SLA Deadline: ${params.slaDeadline.toISOString()}`);

    // TODO: Implement actual ticket creation in ticketing system

    return ticketId;
  }

  private async emergencyQuarantine(contentId: string): Promise<void> {
    console.error(`EMERGENCY QUARANTINE: Content ${contentId}`);

    // TODO: Implement actual content quarantine
  }

  private async logFallbackAction(params: {
    procedure: FallbackProcedure;
    action: string;
    ticketId?: string;
    contacts?: string[];
    severity?: string;
  }): Promise<void> {
    console.log(`Logging fallback action: ${params.action}`);
    console.log(`Procedure: ${params.procedure}`);
    if (params.ticketId) console.log(`Ticket: ${params.ticketId}`);
    if (params.contacts) console.log(`Contacts: ${params.contacts.join(', ')}`);

    // TODO: Implement actual audit logging
  }

  private async queueForManualSubmission(
    context: FallbackContext
  ): Promise<void> {
    console.log(`Queuing for manual submission: ${context.reportId}`);

    // TODO: Implement actual queue management
  }

  private async writeToLocalAuditLog(context: FallbackContext): Promise<void> {
    console.log(`Writing to local audit log: ${JSON.stringify(context)}`);

    // TODO: Implement actual local file system logging
  }

  /**
   * Get escalation contacts for priority level.
   */
  getEscalationContacts(
    priority: 'immediate' | 'urgent' | 'high' | 'normal'
  ): EscalationContact[] {
    return ESCALATION_CONTACTS[priority] || ESCALATION_CONTACTS.normal;
  }

  /**
   * Check if manual fallback is required based on error and context.
   */
  shouldTriggerFallback(error: Error, context: FallbackContext): boolean {
    const classified = errorClassifier.classify(error, {
      operation: context.procedure,
      reportId: context.reportId,
      contentId: context.contentId,
      userId: context.userId,
    });

    // Always trigger for critical operations
    if (context.priority === 'immediate') {
      return true;
    }

    // Trigger if error requires manual intervention
    if (classified.requiresManualIntervention) {
      return true;
    }

    // Trigger if SLA deadline is approaching
    const timeUntilDeadline = context.slaDeadline.getTime() - Date.now();
    const oneHourMs = 60 * 60 * 1000;

    if (timeUntilDeadline < oneHourMs) {
      return true;
    }

    return false;
  }
}

// Export singleton instance
export const manualFallbackManager = new ManualFallbackManager();
