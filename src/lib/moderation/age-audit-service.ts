/**
 * Age Audit Service
 *
 * Handles append-only audit event logging for age verification.
 * Implements GDPR compliance with proper legal basis tracking.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  AgeVerificationAuditEvent,
  SuspiciousSignals,
} from '@/types/age-verification';
import { AGE_VERIFICATION_CONSTANTS } from '@/types/age-verification';

type VerificationMethod =
  | 'eudi_wallet'
  | 'third_party_verifier'
  | 'id_attribute'
  | 'credit_card'
  | 'other';

export class AgeAuditService {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Log audit event (append-only)
   * All age verification events are logged for compliance.
   *
   * @param event - Partial audit event data
   */
  async logAuditEvent(
    event: Partial<Omit<AgeVerificationAuditEvent, 'id' | 'createdAt'>>
  ): Promise<void> {
    const retentionPeriod = `${AGE_VERIFICATION_CONSTANTS.AUDIT_RETENTION_MONTHS} months`;
    const auditPayload = {
      event_type: event.eventType,
      user_id: event.userId || null,
      token_id: event.tokenId || null,
      verification_method: event.verificationMethod || null,
      result: event.result || null,
      failure_reason: event.failureReason || null,
      suspicious_signals: event.suspiciousSignals || null,
      consent_given: event.consentGiven || null,
      content_id: event.contentId || null,
      content_type: event.contentType || null,
      access_granted: event.accessGranted || null,
      ip_address: event.ipAddress || null,
      user_agent: event.userAgent || null,
      legal_basis: event.legalBasis || null,
      retention_period: retentionPeriod,
    };

    const maxAttempts = 2;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const { error } = await this.supabase
        .from('age_verification_audit')
        .insert(auditPayload);

      if (!error) {
        return;
      }

      console.error('[AgeAuditService] Failed to log audit event', {
        attempt,
        error: error.message,
        auditPayload,
        retentionMonths: AGE_VERIFICATION_CONSTANTS.AUDIT_RETENTION_MONTHS,
      });

      if (attempt === maxAttempts) {
        throw new Error(
          `[AgeAuditService] Failed to persist audit event after ${maxAttempts} attempts: ${error.message}`
        );
      }

      await new Promise((resolve) => setTimeout(resolve, attempt * 100));
    }
  }

  /**
   * Log age gating access check event
   */
  async logAgeGatingEvent(opts: {
    userId: string;
    contentId: string;
    contentType: string;
    accessGranted: boolean;
    failureReason?: string;
  }): Promise<void> {
    await this.logAuditEvent({
      eventType: 'age_gating_check',
      userId: opts.userId,
      contentId: opts.contentId,
      contentType: opts.contentType,
      accessGranted: opts.accessGranted,
      failureReason: opts.failureReason,
      legalBasis: opts.accessGranted
        ? 'GDPR Art. 6(1)(f) - Legitimate interest'
        : 'GDPR Art. 6(1)(c) - Legal obligation (DSA Art. 28)',
    });
  }

  /**
   * Log token-related event
   */
  async logTokenEvent(opts: {
    eventType:
      | 'token_issued'
      | 'token_validated'
      | 'token_revoked'
      | 'verification_success'
      | 'verification_failure';
    userId: string;
    tokenId?: string;
    verificationMethod?: VerificationMethod;
    result: 'success' | 'failure' | 'pending';
    failureReason?: string;
    ipAddress?: string | null;
    userAgent?: string | null;
  }): Promise<void> {
    await this.logAuditEvent({
      eventType: opts.eventType,
      userId: opts.userId,
      tokenId: opts.tokenId,
      verificationMethod: opts.verificationMethod,
      result: opts.result,
      failureReason: opts.failureReason,
      ipAddress: opts.ipAddress,
      userAgent: opts.userAgent,
      legalBasis: 'GDPR Art. 6(1)(c) - Legal obligation (DSA Art. 28)',
    });
  }

  /**
   * Log suspicious activity detection event
   */
  async logSuspiciousActivityEvent(opts: {
    userId: string;
    suspiciousSignals: Partial<SuspiciousSignals>;
    consentGiven: boolean;
  }): Promise<void> {
    await this.logAuditEvent({
      eventType: 'suspicious_activity_detected',
      userId: opts.userId,
      result: 'pending',
      suspiciousSignals: {
        ...opts.suspiciousSignals,
        consentGiven: opts.consentGiven,
      },
      consentGiven: opts.consentGiven,
      legalBasis: opts.consentGiven
        ? 'GDPR Art. 6(1)(a) - Consent'
        : 'GDPR Art. 6(1)(f) - Legitimate interest (fraud prevention)',
    });
  }
}
