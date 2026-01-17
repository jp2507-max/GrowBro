/**
 * Age Verification Service
 *
 * Implements DSA Art. 28 (Protection of Minors) and EU Age-Verification Blueprint
 * Privacy-preserving age verification without raw ID storage
 *
 * Requirements:
 * - 8.1: Privacy-preserving age-attribute (≥18) compatible with EU blueprint/EUDI wallet
 * - 8.6: Fallback verification on suspicious signals, avoid device fingerprinting without consent
 *
 * This service orchestrates:
 * - AgeTokenService — token issuance, validation, revocation
 * - AgeGatingService — content access checks
 * - AgeAuditService — audit event logging
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  CheckAgeGatingInput,
  DetectSuspiciousActivityInput,
  ReusableToken,
  TokenValidationResult,
  UserAgeStatus,
  VerificationToken,
  VerifyAgeAttributeInput,
} from '@/types/age-verification';
import { AGE_VERIFICATION_CONSTANTS } from '@/types/age-verification';
import type { DbUserAgeStatus } from '@/types/database-records';

import { AgeAuditService } from './age-audit-service';
import type { AgeGatingResult } from './age-gating-service';
import { AgeGatingService } from './age-gating-service';
import { AgeTokenService } from './age-token-service';

export class AgeVerificationService {
  private supabase: SupabaseClient;
  private tokenService: AgeTokenService;
  private gatingService: AgeGatingService;
  private auditService: AgeAuditService;

  constructor(supabase: SupabaseClient, tokenSecret?: string) {
    this.supabase = supabase;
    this.auditService = new AgeAuditService(supabase);
    this.tokenService = new AgeTokenService(
      supabase,
      this.auditService,
      tokenSecret
    );
    this.gatingService = new AgeGatingService(supabase, this.auditService);
  }

  /**
   * Verify age attribute and issue reusable token
   * Implements Requirement 8.1: Privacy-preserving age verification
   *
   * @param input - Age attribute verification input
   * @returns Reusable verification token
   */
  async verifyAgeAttribute(
    input: VerifyAgeAttributeInput
  ): Promise<ReusableToken> {
    const { userId, ageAttribute, ipAddress, userAgent } = input;

    // Validate age attribute
    if (!ageAttribute.over18) {
      await this.auditService.logTokenEvent({
        eventType: 'verification_failure',
        userId,
        verificationMethod: ageAttribute.verificationMethod,
        result: 'failure',
        failureReason: 'under_age',
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
      });

      throw new Error('User is under 18. Age verification failed.');
    }

    // Log successful verification attempt
    await this.auditService.logTokenEvent({
      eventType: 'verification_success',
      userId,
      verificationMethod: ageAttribute.verificationMethod,
      result: 'success',
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
    });

    // Issue verification token
    const token = await this.tokenService.issueVerificationToken({
      userId,
      verificationMethod: ageAttribute.verificationMethod,
      verificationProvider: ageAttribute.verificationProvider,
      assuranceLevel: ageAttribute.assuranceLevel,
      maxUses: AGE_VERIFICATION_CONSTANTS.MAX_TOKEN_USES,
      expiryDays: AGE_VERIFICATION_CONSTANTS.DEFAULT_TOKEN_EXPIRY_DAYS,
    });

    // Update user age status
    await this.updateUserAgeStatus(userId, true, token.id);

    return token;
  }

  /**
   * Detect suspicious activity and trigger fallback verification
   * Implements Requirement 8.6: Consent-based fallback without device fingerprinting
   *
   * @param input - Suspicious activity detection input
   */
  async detectSuspiciousActivity(
    input: DetectSuspiciousActivityInput
  ): Promise<void> {
    const { userId, signals, hasConsent } = input;

    // Filter signals based on consent (ePrivacy 5(3) compliance)
    const allowedSignals = {
      rapidAccountCreation: signals.rapidAccountCreation,
      multipleFailedVerifications: signals.multipleFailedVerifications,
      unusualAccessPattern: signals.unusualAccessPattern,
      vpnDetected: signals.vpnDetected,
      proxyDetected: signals.proxyDetected,
      // Device signals only if consent given
      deviceFingerprintMismatch: hasConsent
        ? signals.deviceFingerprintMismatch
        : undefined,
      suspiciousUserAgent: hasConsent ? signals.suspiciousUserAgent : undefined,
      automatedBehavior: hasConsent ? signals.automatedBehavior : undefined,
      consentGiven: signals.consentGiven,
      consentTimestamp: signals.consentTimestamp,
    };

    // Log suspicious activity
    await this.auditService.logSuspiciousActivityEvent({
      userId,
      suspiciousSignals: allowedSignals,
      consentGiven: hasConsent,
    });

    // Determine if additional verification is required
    const requiresAdditionalVerification =
      signals.rapidAccountCreation ||
      signals.multipleFailedVerifications ||
      (hasConsent && signals.automatedBehavior);

    if (requiresAdditionalVerification) {
      // Mark user for additional verification
      const { error } = await this.supabase.from('user_age_status').upsert({
        user_id: userId,
        is_age_verified: false,
        is_minor: true, // Safer default
        minor_protections_enabled: true,
      });

      if (error) {
        console.error(
          '[AgeVerificationService] Failed to apply safer defaults for suspicious activity:',
          error.message
        );
      }
    }
  }

  /**
   * Get user age status
   *
   * @param userId - User UUID
   * @returns User age status
   */
  async getUserAgeStatus(userId: string): Promise<UserAgeStatus | null> {
    const { data: status, error } = await this.supabase
      .from('user_age_status')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !status) {
      return null;
    }

    const statusData = status as DbUserAgeStatus;

    return {
      userId: statusData.user_id,
      isAgeVerified: statusData.is_age_verified,
      verifiedAt: statusData.verified_at
        ? new Date(statusData.verified_at)
        : null,
      activeTokenId: statusData.active_token_id,
      isMinor: statusData.is_minor,
      minorProtectionsEnabled: statusData.minor_protections_enabled,
      showAgeRestrictedContent: statusData.show_age_restricted_content,
      createdAt: new Date(statusData.created_at),
      updatedAt: new Date(statusData.updated_at),
    };
  }

  /**
   * Get appeal window days (configurable)
   *
   * @returns Number of days for appeal window
   */
  getAppealWindowDays(): number {
    return AGE_VERIFICATION_CONSTANTS.APPEAL_WINDOW_DAYS;
  }

  // ============================================================================
  // Delegated Methods (for backward compatibility)
  // ============================================================================

  /** @see AgeTokenService.issueVerificationToken */
  async issueVerificationToken(
    ...args: Parameters<AgeTokenService['issueVerificationToken']>
  ): ReturnType<AgeTokenService['issueVerificationToken']> {
    return this.tokenService.issueVerificationToken(...args);
  }

  /** @see AgeTokenService.validateToken */
  async validateToken(token: string): Promise<TokenValidationResult> {
    return this.tokenService.validateToken(token);
  }

  /** @see AgeTokenService.revokeToken */
  async revokeToken(token: string, reason: string): Promise<void> {
    return this.tokenService.revokeToken(token, reason);
  }

  /** @see AgeTokenService.getActiveToken */
  async getActiveToken(userId: string): Promise<VerificationToken | null> {
    return this.tokenService.getActiveToken(userId);
  }

  /** @see AgeGatingService.checkAgeGating */
  async checkAgeGating(input: CheckAgeGatingInput): Promise<AgeGatingResult> {
    return this.gatingService.checkAgeGating(input);
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Update user age status
   */
  private async updateUserAgeStatus(
    userId: string,
    isVerified: boolean,
    tokenId: string
  ): Promise<void> {
    const { error } = await this.supabase.from('user_age_status').upsert({
      user_id: userId,
      is_age_verified: isVerified,
      verified_at: isVerified ? new Date().toISOString() : null,
      active_token_id: tokenId,
      is_minor: !isVerified,
      minor_protections_enabled: !isVerified,
      show_age_restricted_content: isVerified,
    });

    if (error) {
      throw new Error(`Failed to update user age status: ${error.message}`);
    }
  }
}

// Re-export sub-services for direct use
export { AgeAuditService } from './age-audit-service';
export { type AgeGatingResult, AgeGatingService } from './age-gating-service';
export { AgeTokenService } from './age-token-service';
