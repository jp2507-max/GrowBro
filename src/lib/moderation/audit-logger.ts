/**
 * Audit Logger - Immutable audit trail for moderation actions
 *
 * Creates comprehensive audit events with:
 * - Immutable entries for all moderation actions
 * - Cryptographic signatures (HMAC-SHA256)
 * - PII tagging and retention calculation
 * - Complete metadata tracking (who, what, when, why, evidence)
 *
 * Requirements: 3.3 (DSA Art. 17), 6.1, 6.6
 */

import crypto from 'crypto';

import type {
  AuditEvent,
  AuditEventInput,
  AuditEventType,
} from '@/types/moderation';

import { supabase } from '../supabase';

// ============================================================================
// Types
// ============================================================================

export interface AuditLogResult {
  success: boolean;
  event_id?: string;
  error?: string;
}

export interface SignatureValidationResult {
  is_valid: boolean;
  expected_signature: string;
  actual_signature: string;
  error?: string;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_RETENTION_DAYS = 365; // 12 months default
const EXTENDED_RETENTION_DAYS = 2555; // 7 years for moderation actions
const PII_RETENTION_DAYS = 30; // 30 days before anonymization

// ============================================================================
// Audit Logger
// ============================================================================

export class AuditLogger {
  /**
   * Logs an audit event with cryptographic signature
   *
   * Requirements: 3.3, 6.1, 6.6
   */
  async logEvent(input: AuditEventInput): Promise<AuditLogResult> {
    try {
      const now = new Date();
      const timestamp = now.toISOString();

      // Calculate retention period
      const retentionDays = this.getRetentionPeriod(
        input.event_type,
        input.pii_tagged || false
      );
      const retentionUntil = new Date(now);
      retentionUntil.setDate(retentionUntil.getDate() + retentionDays);

      // Build event payload
      const eventPayload = {
        event_type: input.event_type,
        actor_id: input.actor_id,
        actor_type: input.actor_type,
        target_id: input.target_id,
        target_type: input.target_type,
        action: input.action,
        metadata: input.metadata || {},
        timestamp: now,
      };

      // Generate cryptographic signature (with ISO string for signature)
      const signature = this.generateSignature({
        ...eventPayload,
        timestamp,
      });

      // Create audit event
      const auditEvent: Omit<AuditEvent, 'id' | 'created_at'> = {
        ...eventPayload,
        signature,
        pii_tagged: input.pii_tagged || false,
        retention_until: retentionUntil,
      };

      // Insert into audit database
      const { data, error } = await supabase
        .from('audit_events')
        .insert(auditEvent)
        .select()
        .single();

      if (error) {
        return {
          success: false,
          error: `Failed to log audit event: ${error.message}`,
        };
      }

      return {
        success: true,
        event_id: data.id,
      };
    } catch (error) {
      return {
        success: false,
        error: `Audit logging failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Logs a decision_made event
   *
   * Requirements: 3.3, 6.1
   */
  async logDecisionMade(params: {
    moderatorId: string;
    reportId: string;
    decisionId: string;
    action: string;
    reasoning: string;
    policyViolations: string[];
  }): Promise<AuditLogResult> {
    const {
      moderatorId,
      reportId,
      decisionId,
      action,
      reasoning,
      policyViolations,
    } = params;
    return this.logEvent({
      event_type: 'decision_made',
      actor_id: moderatorId,
      actor_type: 'moderator',
      target_id: decisionId,
      target_type: 'moderation_decision',
      action: `decision_${action}`,
      metadata: {
        report_id: reportId,
        action,
        reasoning,
        policy_violations: policyViolations,
      },
      pii_tagged: true, // Reasoning may contain PII
    });
  }

  /**
   * Logs an action_executed event
   *
   * Requirements: 3.3, 6.1
   */
  async logActionExecuted(params: {
    moderatorId: string;
    decisionId: string;
    contentId: string;
    userId: string;
    action: string;
    reasonCode: string;
  }): Promise<AuditLogResult> {
    const { moderatorId, decisionId, contentId, userId, action, reasonCode } =
      params;
    return this.logEvent({
      event_type: 'decision_made', // Using decision_made as proxy for action_executed
      actor_id: moderatorId,
      actor_type: 'moderator',
      target_id: contentId,
      target_type: 'content',
      action: `execute_${action}`,
      metadata: {
        decision_id: decisionId,
        user_id: userId,
        action,
        reason_code: reasonCode,
      },
      pii_tagged: false,
    });
  }

  /**
   * Logs an sor_submitted event
   *
   * Requirements: 3.3, 6.1
   */
  async logSoRSubmitted(
    decisionId: string,
    statementId: string,
    transparencyDbId?: string
  ): Promise<AuditLogResult> {
    return this.logEvent({
      event_type: 'sor_submitted',
      actor_id: 'system',
      actor_type: 'system',
      target_id: statementId,
      target_type: 'statement_of_reasons',
      action: 'submit_to_transparency_db',
      metadata: {
        decision_id: decisionId,
        transparency_db_id: transparencyDbId,
        submission_time: new Date().toISOString(),
      },
      pii_tagged: false, // SoR is already scrubbed
    });
  }

  /**
   * Logs an appeal_filed event
   *
   * Requirements: 6.1
   */
  async logAppealFiled(
    userId: string,
    appealId: string,
    decisionId: string
  ): Promise<AuditLogResult> {
    return this.logEvent({
      event_type: 'appeal_filed',
      actor_id: userId,
      actor_type: 'user',
      target_id: appealId,
      target_type: 'appeal',
      action: 'file_appeal',
      metadata: {
        decision_id: decisionId,
      },
      pii_tagged: false,
    });
  }

  /**
   * Validates audit event signature
   *
   * Requirements: 6.6
   */
  validateSignature(event: AuditEvent): SignatureValidationResult {
    const eventPayload = {
      event_type: event.event_type,
      actor_id: event.actor_id,
      actor_type: event.actor_type,
      target_id: event.target_id,
      target_type: event.target_type,
      action: event.action,
      metadata: event.metadata,
      timestamp: event.timestamp,
    };

    const expectedSignature = this.generateSignature(eventPayload);

    return {
      is_valid: expectedSignature === event.signature,
      expected_signature: expectedSignature,
      actual_signature: event.signature,
    };
  }

  /**
   * Generates HMAC-SHA256 signature for event payload
   *
   * Requirements: 6.6
   */
  private generateSignature(payload: any): string {
    const secret = this.getSignatureSecret();
    const hmac = crypto.createHmac('sha256', secret);

    // Create deterministic string representation
    const payloadString = JSON.stringify(payload, Object.keys(payload).sort());
    hmac.update(payloadString);

    return hmac.digest('hex');
  }

  /**
   * Gets signature secret from environment
   *
   * Requirements: 6.6
   */
  private getSignatureSecret(): string {
    // TODO: Add AUDIT_SIGNATURE_SECRET to env.js
    return 'audit-signature-secret-change-in-production';
  }

  /**
   * Determines retention period based on event type and PII presence
   *
   * Requirements: 6.1
   */
  private getRetentionPeriod(
    eventType: AuditEventType,
    piiTagged: boolean
  ): number {
    // PII-tagged events: 30 days before anonymization
    if (piiTagged) {
      return PII_RETENTION_DAYS;
    }

    // Moderation action events: 7 years for transparency metrics
    const extendedRetentionEvents: AuditEventType[] = [
      'decision_made',
      'appeal_filed',
      'sor_submitted',
    ];

    if (extendedRetentionEvents.includes(eventType)) {
      return EXTENDED_RETENTION_DAYS;
    }

    // Default: 12 months
    return DEFAULT_RETENTION_DAYS;
  }

  /**
   * Queries audit trail by target
   *
   * Requirements: 6.1
   */
  async queryAuditTrail(
    targetId: string,
    targetType?: string,
    limit: number = 100
  ): Promise<{ success: boolean; events?: AuditEvent[]; error?: string }> {
    try {
      let query = supabase
        .from('audit_events')
        .select('*')
        .eq('target_id', targetId)
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (targetType) {
        query = query.eq('target_type', targetType);
      }

      const { data, error } = await query;

      if (error) {
        return {
          success: false,
          error: `Failed to query audit trail: ${error.message}`,
        };
      }

      return {
        success: true,
        events: data as AuditEvent[],
      };
    } catch (error) {
      return {
        success: false,
        error: `Audit trail query failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Gets audit events for a specific decision
   *
   * Requirements: 6.1
   */
  async getDecisionAuditTrail(
    decisionId: string
  ): Promise<{ success: boolean; events?: AuditEvent[]; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('audit_events')
        .select('*')
        .or(
          `target_id.eq.${decisionId},metadata->>decision_id.eq.${decisionId}`
        )
        .order('timestamp', { ascending: true });

      if (error) {
        return {
          success: false,
          error: `Failed to get decision audit trail: ${error.message}`,
        };
      }

      return {
        success: true,
        events: data as AuditEvent[],
      };
    } catch (error) {
      return {
        success: false,
        error: `Decision audit trail failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}

// Export singleton instance
export const auditLogger = new AuditLogger();
