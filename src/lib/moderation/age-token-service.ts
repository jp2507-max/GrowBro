/**
 * Age Token Service
 *
 * Handles token issuance, validation, and revocation for age verification.
 * Implements privacy-preserving token generation with HMAC-SHA256.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import HmacSHA256 from 'crypto-js/hmac-sha256';
import * as Crypto from 'expo-crypto';

import type {
  IssueVerificationTokenInput,
  ReusableToken,
  TokenValidationResult,
  VerificationToken,
} from '@/types/age-verification';
import {
  AGE_VERIFICATION_CONSTANTS,
  calculateExpiryDate,
  isTokenUsable,
} from '@/types/age-verification';
import type { DbTokenRecord } from '@/types/database-records';

import { type AgeAuditService } from './age-audit-service';

export class AgeTokenService {
  private supabase: SupabaseClient;
  private tokenSecret: string;
  private auditService: AgeAuditService;

  constructor(
    supabase: SupabaseClient,
    auditService: AgeAuditService,
    tokenSecret?: string
  ) {
    this.supabase = supabase;
    this.auditService = auditService;

    const secret = tokenSecret ?? process.env.AGE_TOKEN_SECRET;

    if (!secret) {
      if (__DEV__) {
        console.warn(
          '[AgeTokenService] No token secret configured, using insecure default'
        );
        this.tokenSecret = 'default-dev-secret';
      } else {
        throw new Error('AGE_TOKEN_SECRET must be configured in production');
      }
    } else {
      this.tokenSecret = secret;
    }
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
    const { data: token, error } = await this.supabase
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
      })
      .select()
      .single();

    if (error || !token) {
      throw new Error(
        `Failed to issue verification token: ${error?.message || 'Unknown error'}`
      );
    }

    const tokenResult = token as DbTokenRecord;

    // Log token issuance
    await this.auditService.logTokenEvent({
      eventType: 'token_issued',
      userId,
      tokenId: tokenResult.id,
      verificationMethod,
      result: 'success',
    });

    return {
      id: tokenResult.id,
      token: tokenString,
      isValid: true,
      expiresAt,
      remainingUses: maxUses,
    };
  }

  /**
   * Validate an existing verification token
   * Prevents replay attacks through use_count tracking with atomic updates
   *
   * @param token - Client-facing token string to validate
   * @returns Token validation result with error details
   */
  async validateToken(token: string): Promise<TokenValidationResult> {
    const tokenHash = await this.generateTokenHash(token);
    const { data: tokenRow, error } = await this.supabase
      .from('age_verification_tokens')
      .select('*')
      .eq('token_hash', tokenHash)
      .single();

    if (error || !tokenRow) {
      return { isValid: false, error: 'token_not_found', token: null };
    }

    const tokenData = tokenRow as DbTokenRecord;
    const verificationToken = this.mapDbTokenToType(tokenData);

    if (!isTokenUsable(verificationToken)) {
      return await this.handleInvalidToken(
        tokenData,
        tokenData.id,
        verificationToken
      );
    }

    const updateResult = await this.atomicTokenUpdate(
      tokenData.id,
      tokenData,
      verificationToken
    );
    if (!updateResult.success) {
      return await this.handleConcurrentUsage(
        tokenData,
        tokenData.id,
        verificationToken
      );
    }

    await this.auditService.logTokenEvent({
      eventType: 'token_validated',
      userId: tokenData.user_id,
      tokenId: tokenData.id,
      result: 'success',
    });

    const updatedVerificationToken = updateResult.updatedToken
      ? this.mapDbTokenToType(updateResult.updatedToken)
      : { ...verificationToken, useCount: verificationToken.useCount + 1 };

    return {
      isValid: true,
      error: null,
      token: updatedVerificationToken,
    };
  }

  /**
   * Revoke a verification token
   *
   * @param token - Client-facing token string to revoke
   * @param reason - Revocation reason
   */
  async revokeToken(token: string, reason: string): Promise<void> {
    const tokenHash = await this.generateTokenHash(token);
    const { data: tokenRow, error } = await this.supabase
      .from('age_verification_tokens')
      .update({
        revoked_at: new Date().toISOString(),
        revocation_reason: reason,
      })
      .eq('token_hash', tokenHash)
      .select()
      .single();

    if (error || !tokenRow) {
      throw new Error(
        `Failed to revoke token: ${error?.message || 'Unknown error'}`
      );
    }

    const revokedToken = tokenRow as DbTokenRecord;

    await this.auditService.logTokenEvent({
      eventType: 'token_revoked',
      userId: revokedToken.user_id,
      tokenId: revokedToken.id,
      result: 'success',
      failureReason: reason,
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
      .maybeSingle();

    if (error || !token) {
      return null;
    }

    const mapped = this.mapDbTokenToType(token as DbTokenRecord);

    if (!isTokenUsable(mapped)) {
      return null;
    }

    return mapped;
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private async handleInvalidToken(
    tokenData: DbTokenRecord,
    tokenId: string,
    verificationToken: VerificationToken
  ): Promise<TokenValidationResult> {
    const error = this.determineTokenError(verificationToken);
    await this.auditService.logTokenEvent({
      eventType: 'token_validated',
      userId: tokenData.user_id,
      tokenId,
      result: 'failure',
      failureReason: error ?? undefined,
    });
    return { isValid: false, error, token: verificationToken };
  }

  private async atomicTokenUpdate(
    tokenId: string,
    tokenData: DbTokenRecord,
    verificationToken: VerificationToken
  ): Promise<{ success: boolean; updatedToken?: DbTokenRecord }> {
    const { data, error } = await this.supabase
      .from('age_verification_tokens')
      .update({
        use_count: tokenData.use_count + 1,
        used_at:
          tokenData.use_count === 0 ? new Date().toISOString() : undefined,
      })
      .eq('id', tokenId)
      .lt('use_count', verificationToken.maxUses)
      .select()
      .single();

    return { success: !error && !!data, updatedToken: data ?? undefined };
  }

  private async handleConcurrentUsage(
    tokenData: DbTokenRecord,
    tokenId: string,
    verificationToken: VerificationToken
  ): Promise<TokenValidationResult> {
    await this.auditService.logTokenEvent({
      eventType: 'token_validated',
      userId: tokenData.user_id,
      tokenId,
      result: 'failure',
      failureReason: 'concurrent_usage_detected',
    });
    return {
      isValid: false,
      error: 'token_already_used',
      token: verificationToken,
    };
  }

  /**
   * Generate HMAC-SHA256 hash of token data
   * Uses crypto-js for standard, production-ready cryptographic operations
   */
  private async generateTokenHash(tokenData: string): Promise<string> {
    const hmac = HmacSHA256(tokenData, this.tokenSecret);
    return hmac.toString();
  }

  /**
   * Map database token to TypeScript type
   */
  private mapDbTokenToType(dbToken: DbTokenRecord): VerificationToken {
    const verificationMethod = isValidVerificationMethod(
      dbToken.verification_method
    )
      ? dbToken.verification_method
      : 'other';

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
      verificationMethod,
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

const VALID_VERIFICATION_METHODS = [
  'eudi_wallet',
  'third_party_verifier',
  'id_attribute',
  'credit_card',
  'other',
] as const;

type VerificationMethodType = (typeof VALID_VERIFICATION_METHODS)[number];

function isValidVerificationMethod(
  value: string | null | undefined
): value is VerificationMethodType {
  return (
    typeof value === 'string' &&
    VALID_VERIFICATION_METHODS.includes(value as VerificationMethodType)
  );
}
