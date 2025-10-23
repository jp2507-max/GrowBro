/**
 * Age Verification Service
 *
 * Implements DSA Art. 28 (Protection of Minors) and EU Age-Verification Blueprint
 * Privacy-preserving age verification without raw ID storage
 *
 * Requirements:
 * - 8.1: Privacy-preserving age-attribute (≥18) compatible with EU blueprint/EUDI wallet
 * - 8.6: Fallback verification on suspicious signals, avoid device fingerprinting without consent
 */

import { type createClient } from '@supabase/supabase-js';
import * as Crypto from 'expo-crypto';

import type {
  AgeVerificationAuditEvent,
  CheckAgeGatingInput,
  DetectSuspiciousActivityInput,
  IssueVerificationTokenInput,
  ReusableToken,
  TokenValidationResult,
  UserAgeStatus,
  VerificationToken,
  VerifyAgeAttributeInput,
} from '@/types/age-verification';
import {
  AGE_VERIFICATION_CONSTANTS,
  calculateExpiryDate,
  isTokenUsable,
} from '@/types/age-verification';

export class AgeVerificationService {
  private supabase: ReturnType<typeof createClient>;
  private tokenSecret: string;

  constructor(
    supabase: ReturnType<typeof createClient>,
    tokenSecret: string = process.env.AGE_TOKEN_SECRET || 'default-secret'
  ) {
    this.supabase = supabase;
    this.tokenSecret = tokenSecret;
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
      await this.logAuditEvent({
        eventType: 'verification_failure',
        userId,
        verificationMethod: ageAttribute.verificationMethod,
        result: 'failure',
        failureReason: 'under_age',
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        legalBasis: 'GDPR Art. 6(1)(c) - Legal obligation (DSA Art. 28)',
      });

      throw new Error('User is under 18. Age verification failed.');
    }

    // Log successful verification attempt
    await this.logAuditEvent({
      eventType: 'verification_success',
      userId,
      verificationMethod: ageAttribute.verificationMethod,
      result: 'success',
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
      legalBasis: 'GDPR Art. 6(1)(c) - Legal obligation (DSA Art. 28)',
    });

    // Issue verification token
    const token = await this.issueVerificationToken({
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
   * Issue a new verification token
   * Implements privacy-preserving token generation with HMAC-SHA256
   *
   * @param input - Token issuance parameters
   * @returns Reusable verification token
   */
  async issueVerificationToken(
    input: IssueVerificationTokenInput
  ): Promise<ReusableToken> {
    const {
      userId,
      verificationMethod,
      verificationProvider,
      assuranceLevel,
      maxUses = AGE_VERIFICATION_CONSTANTS.MAX_TOKEN_USES,
      expiryDays = AGE_VERIFICATION_CONSTANTS.DEFAULT_TOKEN_EXPIRY_DAYS,
    } = input;

    // Generate token hash (privacy-preserving, no plaintext storage)
    const randomValue = await Crypto.getRandomBytesAsync(16);
    const randomHex = Array.from(randomValue)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const tokenString = `${userId}-${Date.now()}-${randomHex}`;
    const tokenHash = await this.generateTokenHash(tokenString);

    const expiresAt = calculateExpiryDate(expiryDays);

    // Insert token into database
    const { data: token, error } = (await this.supabase
      .from('age_verification_tokens')
      .insert({
        user_id: userId,
        verification_method: verificationMethod,
        verification_provider: verificationProvider || null,
        assurance_level: assuranceLevel || null,
        token_hash: tokenHash,
        expires_at: expiresAt.toISOString(),
        max_uses: maxUses,
        age_attribute_verified: true,
      } as any)
      .select()
      .single()) as any;

    if (error) {
      throw new Error(`Failed to issue verification token: ${error.message}`);
    }

    const tokenResult = token as any;

    // Log token issuance
    await this.logAuditEvent({
      eventType: 'token_issued',
      userId,
      tokenId: tokenResult.id,
      verificationMethod,
      result: 'success',
      legalBasis: 'GDPR Art. 6(1)(c) - Legal obligation (DSA Art. 28)',
    });

    return {
      id: tokenResult.id,
      isValid: true,
      expiresAt,
      remainingUses: maxUses,
    };
  }

  /**
   * Validate an existing verification token
   * Prevents replay attacks through use_count tracking
   *
   * ⚠️ CRITICAL SECURITY ISSUE: Race Condition Vulnerability
   * This implementation has a race condition where concurrent validations
   * can both pass the usability check and increment use_count, allowing
   * tokens to be used more times than intended (e.g., single-use tokens
   * could be used multiple times).
   *
   * Problem Flow:
   * 1. Request A fetches token (use_count = 0, max_uses = 1)
   * 2. Request B fetches token (use_count = 0, max_uses = 1)
   * 3. Both pass isTokenUsable() check (0 < 1)
   * 4. Both increment use_count to 1
   * 5. Both succeed validation when only one should
   *
   * Recommended Fix: Use atomic conditional update
   * .update({ use_count: tokenData.use_count + 1 })
   * .eq('id', tokenId)
   * .lt('use_count', token.maxUses) // Only update if still under limit
   *
   * @param tokenId - Token UUID to validate
   * @returns Token validation result with error details
   */
  async validateToken(tokenId: string): Promise<TokenValidationResult> {
    const { data: token, error } = await this.supabase
      .from('age_verification_tokens')
      .select('*')
      .eq('id', tokenId)
      .single();

    if (error || !token) {
      return { isValid: false, error: 'token_not_found', token: null };
    }

    const tokenData = token as any;
    const verificationToken = this.mapDbTokenToType(tokenData);

    if (!isTokenUsable(verificationToken)) {
      return await this.handleInvalidToken(
        tokenData,
        tokenId,
        verificationToken
      );
    }

    const updateResult = await this.atomicTokenUpdate(
      tokenId,
      tokenData,
      verificationToken
    );
    if (!updateResult.success) {
      return await this.handleConcurrentUsage(
        tokenData,
        tokenId,
        verificationToken
      );
    }

    await this.logAuditEvent({
      eventType: 'token_validated',
      userId: tokenData.user_id,
      tokenId,
      result: 'success',
      legalBasis: 'GDPR Art. 6(1)(c) - Legal obligation (DSA Art. 28)',
    });

    return {
      isValid: true,
      error: null,
      token: { ...verificationToken, useCount: verificationToken.useCount + 1 },
    };
  }

  private async handleInvalidToken(
    tokenData: any,
    tokenId: string,
    verificationToken: AgeVerificationToken
  ): Promise<TokenValidationResult> {
    const error = this.determineTokenError(verificationToken);
    await this.logAuditEvent({
      eventType: 'token_validated',
      userId: tokenData.user_id,
      tokenId,
      result: 'failure',
      failureReason: error,
      legalBasis: 'GDPR Art. 6(1)(c) - Legal obligation (DSA Art. 28)',
    });
    return { isValid: false, error, token: verificationToken };
  }

  private async atomicTokenUpdate(
    tokenId: string,
    tokenData: any,
    verificationToken: AgeVerificationToken
  ): Promise<{ success: boolean }> {
    const { data, error } = (await (
      this.supabase.from('age_verification_tokens').update as any
    )({
      use_count: tokenData.use_count + 1,
      used_at:
        tokenData.use_count === 0
          ? new Date().toISOString()
          : tokenData.used_at,
    })
      .eq('id', tokenId)
      .lt('use_count', verificationToken.maxUses)
      .select()
      .single()) as any;

    return { success: !error && !!data };
  }

  private async handleConcurrentUsage(
    tokenData: any,
    tokenId: string,
    verificationToken: AgeVerificationToken
  ): Promise<TokenValidationResult> {
    await this.logAuditEvent({
      eventType: 'token_validated',
      userId: tokenData.user_id,
      tokenId,
      result: 'failure',
      failureReason: 'concurrent_usage_detected',
      legalBasis: 'GDPR Art. 6(1)(c) - Legal obligation (DSA Art. 28)',
    });
    return {
      isValid: false,
      error: 'token_already_used',
      token: verificationToken,
    };
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
    await this.logAuditEvent({
      eventType: 'suspicious_activity_detected',
      userId,
      result: 'pending',
      suspiciousSignals: allowedSignals,
      consentGiven: hasConsent,
      legalBasis: hasConsent
        ? 'GDPR Art. 6(1)(a) - Consent'
        : 'GDPR Art. 6(1)(f) - Legitimate interest (fraud prevention)',
    });

    // Determine if additional verification is required
    const requiresAdditionalVerification =
      signals.rapidAccountCreation ||
      signals.multipleFailedVerifications ||
      (hasConsent && signals.automatedBehavior);

    if (requiresAdditionalVerification) {
      // Mark user for additional verification
      await this.supabase.from('user_age_status').upsert({
        user_id: userId,
        is_age_verified: false,
        is_minor: true, // Safer default
        minor_protections_enabled: true,
      } as any);
    }
  }

  /**
   * Check age-gating access for content
   * Implements Requirement 8.2: Age-restricted content filtering
   *
   * @param input - Age-gating check input
   * @returns Access result with gating status
   */
  async checkAgeGating(input: CheckAgeGatingInput): Promise<{
    granted: boolean;
    reason: string;
    requiresVerification: boolean;
  }> {
    const { userId, contentId, contentType } = input;

    // Check if content is age-restricted
    const { data: restriction } = await this.supabase
      .from('content_age_restrictions')
      .select('*')
      .eq('content_id', contentId)
      .eq('content_type', contentType)
      .single();

    const restrictionData = restriction as any;

    // Content not restricted
    if (!restrictionData || !restrictionData.is_age_restricted) {
      await this.logAuditEvent({
        eventType: 'age_gating_check',
        userId,
        contentId,
        contentType,
        accessGranted: true,
        legalBasis: 'GDPR Art. 6(1)(f) - Legitimate interest',
      });

      return {
        granted: true,
        reason: 'content_not_restricted',
        requiresVerification: false,
      };
    }

    // Check user age verification status
    const { data: userStatus } = await this.supabase
      .from('user_age_status')
      .select('*')
      .eq('user_id', userId)
      .single();

    const userStatusData = userStatus as any;

    // User is age-verified
    if (userStatusData?.is_age_verified) {
      await this.logAuditEvent({
        eventType: 'age_gating_check',
        userId,
        contentId,
        contentType,
        accessGranted: true,
        legalBasis: 'GDPR Art. 6(1)(c) - Legal obligation (DSA Art. 28)',
      });

      return {
        granted: true,
        reason: 'age_verified',
        requiresVerification: false,
      };
    }

    // Access denied - verification required
    await this.logAuditEvent({
      eventType: 'age_gating_check',
      userId,
      contentId,
      contentType,
      accessGranted: false,
      legalBasis: 'GDPR Art. 6(1)(c) - Legal obligation (DSA Art. 28)',
    });

    return {
      granted: false,
      reason: userStatusData?.is_minor
        ? 'minor_protections_active'
        : 'age_not_verified',
      requiresVerification: true,
    };
  }

  /**
   * Revoke a verification token
   *
   * @param tokenId - Token UUID to revoke
   * @param reason - Revocation reason
   */
  async revokeToken(tokenId: string, reason: string): Promise<void> {
    const { data: token, error } = (await (
      this.supabase.from('age_verification_tokens').update as any
    )({
      revoked_at: new Date().toISOString(),
      revocation_reason: reason,
    })
      .eq('id', tokenId)
      .select()
      .single()) as any;

    if (error) {
      throw new Error(`Failed to revoke token: ${error.message}`);
    }

    const revokedToken = token as any;

    await this.logAuditEvent({
      eventType: 'token_revoked',
      userId: revokedToken.user_id,
      tokenId,
      result: 'success',
      failureReason: reason,
      legalBasis: 'GDPR Art. 6(1)(c) - Legal obligation (DSA Art. 28)',
    });
  }

  /**
   * Get active verification token for user
   *
   * @param userId - User UUID
   * @returns Active token or null
   */
  async getActiveToken(userId: string): Promise<VerificationToken | null> {
    const { data: token, error } = await this.supabase
      .from('age_verification_tokens')
      .select('*')
      .eq('user_id', userId)
      .gt('expires_at', new Date().toISOString())
      .is('revoked_at', null)
      .order('issued_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !token) {
      return null;
    }

    return this.mapDbTokenToType(token);
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

    const statusData = status as any;

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
  // Private Helper Methods
  // ============================================================================

  /**
   * Generate HMAC-SHA256 token hash
   * Privacy-preserving, no plaintext storage
   */
  private async generateTokenHash(tokenData: string): Promise<string> {
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      tokenData + this.tokenSecret
    );
    return hash;
  }

  /**
   * Update user age status
   */
  private async updateUserAgeStatus(
    userId: string,
    isVerified: boolean,
    tokenId: string
  ): Promise<void> {
    await this.supabase.from('user_age_status').upsert({
      user_id: userId,
      is_age_verified: isVerified,
      verified_at: isVerified ? new Date().toISOString() : null,
      active_token_id: tokenId,
      is_minor: !isVerified,
      minor_protections_enabled: !isVerified,
      show_age_restricted_content: isVerified,
    } as any);
  }

  /**
   * Log audit event (append-only)
   */
  private async logAuditEvent(
    event: Partial<Omit<AgeVerificationAuditEvent, 'id' | 'createdAt'>>
  ): Promise<void> {
    await this.supabase.from('age_verification_audit').insert({
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
      retention_period:
        AGE_VERIFICATION_CONSTANTS.AUDIT_RETENTION_MONTHS + ' months',
    } as any);
  }

  /**
   * Map database token to TypeScript type
   */
  private mapDbTokenToType(dbToken: any): VerificationToken {
    return {
      id: dbToken.id,
      userId: dbToken.user_id,
      tokenHash: dbToken.token_hash,
      issuedAt: new Date(dbToken.issued_at),
      expiresAt: new Date(dbToken.expires_at),
      revokedAt: dbToken.revoked_at ? new Date(dbToken.revoked_at) : null,
      revocationReason: dbToken.revocation_reason,
      usedAt: dbToken.used_at ? new Date(dbToken.used_at) : null,
      useCount: dbToken.use_count,
      maxUses: dbToken.max_uses,
      verificationMethod: dbToken.verification_method,
      verificationProvider: dbToken.verification_provider,
      assuranceLevel: dbToken.assurance_level,
      ageAttributeVerified: dbToken.age_attribute_verified,
      createdAt: new Date(dbToken.created_at),
      updatedAt: new Date(dbToken.updated_at),
    };
  }

  /**
   * Determine token error type
   */
  private determineTokenError(
    token: VerificationToken
  ): TokenValidationResult['error'] {
    if (token.revokedAt) return 'token_revoked';
    if (new Date() > token.expiresAt) return 'token_expired';
    if (token.useCount >= token.maxUses) return 'max_uses_exceeded';
    if (token.usedAt && token.maxUses === 1) return 'token_already_used';
    return 'invalid_token_format';
  }
}
