/**
 * Age Verification Types
 *
 * Implements DSA Art. 28 (Protection of Minors) and EU Age-Verification Blueprint
 * Privacy-preserving age verification without raw ID storage
 *
 * Requirements: 8.1, 8.2, 8.6
 */

import { z } from 'zod';

// ============================================================================
// Age Attribute (Privacy-Preserving)
// ============================================================================

/**
 * Privacy-preserving age attribute per EU Age-Verification Blueprint
 * Only stores boolean over-18 attribute, never birth date or raw ID
 */
export const ageAttributeSchema = z.object({
  over18: z.boolean(),
  verificationMethod: z.enum([
    'eudi_wallet', // EU Digital Identity Wallet
    'third_party_verifier', // eIDAS Trust Service Provider
    'id_attribute', // Government-issued ID attribute
    'credit_card', // Credit card age verification
    'other',
  ]),
  verificationProvider: z.string().optional(),
  assuranceLevel: z.enum(['substantial', 'high']).optional(), // eIDAS assurance levels
});

export type AgeAttribute = z.infer<typeof ageAttributeSchema>;

// ============================================================================
// Verification Token (Reusable)
// ============================================================================

/**
 * Reusable verification token issued after successful age verification
 * Prevents replay attacks through use_count tracking
 */
export const verificationTokenSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  tokenHash: z.string(),
  issuedAt: z.date(),
  expiresAt: z.date(),
  revokedAt: z.date().nullable(),
  revocationReason: z.string().nullable(),
  usedAt: z.date().nullable(),
  useCount: z.number().int().min(0),
  maxUses: z.number().int().min(1),
  verificationMethod: ageAttributeSchema.shape.verificationMethod,
  verificationProvider: z.string().nullable(),
  assuranceLevel: z.string().nullable(),
  ageAttributeVerified: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type VerificationToken = z.infer<typeof verificationTokenSchema>;

/**
 * Simplified reusable token for client use
 */
export const reusableTokenSchema = z.object({
  id: z.string().uuid(),
  isValid: z.boolean(),
  expiresAt: z.date(),
  remainingUses: z.number().int().min(0),
});

export type ReusableToken = z.infer<typeof reusableTokenSchema>;

// ============================================================================
// Token Validation Result
// ============================================================================

export const tokenValidationResultSchema = z.object({
  isValid: z.boolean(),
  error: z
    .enum([
      'token_not_found',
      'token_expired',
      'token_revoked',
      'token_already_used',
      'max_uses_exceeded',
      'invalid_token_format',
    ])
    .nullable(),
  token: verificationTokenSchema.nullable(),
});

export type TokenValidationResult = z.infer<typeof tokenValidationResultSchema>;

// ============================================================================
// Content Access Result
// ============================================================================

export const accessResultSchema = z.object({
  granted: z.boolean(),
  reason: z
    .enum([
      'age_verified',
      'content_not_restricted',
      'age_not_verified',
      'minor_protections_active',
      'verification_required',
      'content_restricted',
    ])
    .nullable(),
  requiresVerification: z.boolean(),
  contentId: z.string(),
  contentType: z.string(),
});

export type AccessResult = z.infer<typeof accessResultSchema>;

// ============================================================================
// Suspicious Activity Signals (Consent-Based)
// ============================================================================

/**
 * Privacy-preserving suspicious activity signals
 * Device fingerprinting only with ePrivacy 5(3) consent
 */
export const suspiciousSignalsSchema = z.object({
  // Time-based signals (no consent required)
  rapidAccountCreation: z.boolean().optional(),
  multipleFailedVerifications: z.boolean().optional(),
  unusualAccessPattern: z.boolean().optional(),

  // Network signals (minimal, no consent required)
  vpnDetected: z.boolean().optional(),
  proxyDetected: z.boolean().optional(),

  // Device signals (requires ePrivacy consent)
  deviceFingerprintMismatch: z.boolean().optional(),
  suspiciousUserAgent: z.boolean().optional(),
  automatedBehavior: z.boolean().optional(),

  // Consent tracking
  consentGiven: z.boolean(),
  consentTimestamp: z.date().optional(),
});

export type SuspiciousSignals = z.infer<typeof suspiciousSignalsSchema>;

// ============================================================================
// Age Verification Audit Event
// ============================================================================

export const ageVerificationAuditEventSchema = z.object({
  id: z.string().uuid(),
  eventType: z.enum([
    'verification_attempt',
    'verification_success',
    'verification_failure',
    'token_issued',
    'token_validated',
    'token_revoked',
    'token_expired',
    'suspicious_activity_detected',
    'age_gating_check',
    'consent_requested',
    'consent_granted',
    'consent_denied',
  ]),
  userId: z.string().uuid().nullable(),
  tokenId: z.string().uuid().nullable(),
  verificationMethod: ageAttributeSchema.shape.verificationMethod.nullable(),
  result: z.enum(['success', 'failure', 'pending']).nullable(),
  failureReason: z.string().nullable(),
  suspiciousSignals: suspiciousSignalsSchema.nullable(),
  consentGiven: z.boolean().nullable(),
  contentId: z.string().nullable(),
  contentType: z.string().nullable(),
  accessGranted: z.boolean().nullable(),
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
  legalBasis: z.string().nullable(),
  retentionPeriod: z.string().nullable(),
  createdAt: z.date(),
});

export type AgeVerificationAuditEvent = z.infer<
  typeof ageVerificationAuditEventSchema
>;

// ============================================================================
// User Age Status
// ============================================================================

export const userAgeStatusSchema = z.object({
  userId: z.string().uuid(),
  isAgeVerified: z.boolean(),
  verifiedAt: z.date().nullable(),
  activeTokenId: z.string().uuid().nullable(),
  isMinor: z.boolean(),
  minorProtectionsEnabled: z.boolean(),
  showAgeRestrictedContent: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type UserAgeStatus = z.infer<typeof userAgeStatusSchema>;

// ============================================================================
// Content Age Restriction
// ============================================================================

export const contentAgeRestrictionSchema = z.object({
  id: z.string().uuid(),
  contentId: z.string(),
  contentType: z.enum(['post', 'comment', 'image', 'profile', 'other']),
  isAgeRestricted: z.boolean(),
  minAge: z.number().int().min(0).max(100),
  flaggedBySystem: z.boolean(),
  flaggedByAuthor: z.boolean(),
  flaggedByModerator: z.boolean(),
  moderatorId: z.string().uuid().nullable(),
  restrictionReason: z.string().nullable(),
  keywordsDetected: z.array(z.string()).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type ContentAgeRestriction = z.infer<typeof contentAgeRestrictionSchema>;

// ============================================================================
// Service Input Types
// ============================================================================

export const verifyAgeAttributeInputSchema = z.object({
  userId: z.string().uuid(),
  ageAttribute: ageAttributeSchema,
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
});

export type VerifyAgeAttributeInput = z.infer<
  typeof verifyAgeAttributeInputSchema
>;

export const issueVerificationTokenInputSchema = z.object({
  userId: z.string().uuid(),
  verificationMethod: ageAttributeSchema.shape.verificationMethod,
  verificationProvider: z.string().optional(),
  assuranceLevel: z.string().optional(),
  maxUses: z.number().int().min(1).default(1),
  expiryDays: z.number().int().min(1).max(365).default(90),
});

export type IssueVerificationTokenInput = z.infer<
  typeof issueVerificationTokenInputSchema
>;

export const checkAgeGatingInputSchema = z.object({
  userId: z.string().uuid(),
  contentId: z.string(),
  contentType: z.enum(['post', 'comment', 'image', 'profile', 'other']),
});

export type CheckAgeGatingInput = z.infer<typeof checkAgeGatingInputSchema>;

export const detectSuspiciousActivityInputSchema = z.object({
  userId: z.string().uuid(),
  signals: suspiciousSignalsSchema,
  hasConsent: z.boolean(),
});

export type DetectSuspiciousActivityInput = z.infer<
  typeof detectSuspiciousActivityInputSchema
>;

export const flagAgeRestrictedContentInputSchema = z.object({
  contentId: z.string(),
  contentType: z.enum(['post', 'comment', 'image', 'profile', 'other']),
  flaggedBySystem: z.boolean().default(false),
  flaggedByAuthor: z.boolean().default(false),
  flaggedByModerator: z.boolean().default(false),
  moderatorId: z.string().uuid().optional(),
  restrictionReason: z.string().optional(),
  keywordsDetected: z.array(z.string()).optional(),
  minAge: z.number().int().min(0).max(100).default(18),
});

export type FlagAgeRestrictedContentInput = z.infer<
  typeof flagAgeRestrictedContentInputSchema
>;

// ============================================================================
// Type Guards
// ============================================================================

export function isValidAgeAttribute(value: unknown): value is AgeAttribute {
  return ageAttributeSchema.safeParse(value).success;
}

export function isValidVerificationToken(
  value: unknown
): value is VerificationToken {
  return verificationTokenSchema.safeParse(value).success;
}

export function isValidSuspiciousSignals(
  value: unknown
): value is SuspiciousSignals {
  return suspiciousSignalsSchema.safeParse(value).success;
}

export function isTokenExpired(token: VerificationToken): boolean {
  return new Date() > token.expiresAt;
}

export function isTokenRevoked(token: VerificationToken): boolean {
  return token.revokedAt !== null;
}

export function isTokenUsable(token: VerificationToken): boolean {
  return (
    !isTokenExpired(token) &&
    !isTokenRevoked(token) &&
    token.useCount < token.maxUses
  );
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate token expiry date from days
 */
export function calculateExpiryDate(expiryDays: number): Date {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + expiryDays);
  return expiry;
}

/**
 * Calculate remaining uses for a token
 */
export function calculateRemainingUses(token: VerificationToken): number {
  return Math.max(0, token.maxUses - token.useCount);
}

/**
 * Check if user requires age verification for content access
 */
export function requiresAgeVerification(
  userStatus: UserAgeStatus,
  contentRestriction: ContentAgeRestriction | null
): boolean {
  // No restriction, no verification needed
  if (!contentRestriction || !contentRestriction.isAgeRestricted) {
    return false;
  }

  // User already verified
  if (userStatus.isAgeVerified) {
    return false;
  }

  // Requires verification
  return true;
}

/**
 * Apply safer defaults for minors
 */
export function applySaferDefaults(
  userStatus: UserAgeStatus
): Partial<UserAgeStatus> {
  if (userStatus.isMinor || !userStatus.isAgeVerified) {
    return {
      minorProtectionsEnabled: true,
      showAgeRestrictedContent: false,
    };
  }

  return {};
}

// ============================================================================
// Constants
// ============================================================================

export const AGE_VERIFICATION_CONSTANTS = {
  DEFAULT_TOKEN_EXPIRY_DAYS: 90,
  MAX_TOKEN_USES: 1, // Single-use by default
  MINIMUM_AGE: 18,
  APPEAL_WINDOW_DAYS: 7, // Minimum appeal window per requirement 4.9
  AUDIT_RETENTION_MONTHS: 12, // Per requirement 6.7
  TOKEN_CLEANUP_DAYS: 30, // Cleanup expired tokens after 30 days
} as const;

export const AGE_RESTRICTED_KEYWORDS = [
  'cannabis',
  'marijuana',
  'thc',
  'cbd',
  'cultivation',
  'grow',
  'harvest',
  'medical cannabis',
  'recreational cannabis',
] as const;

export type AgeRestrictedKeyword = (typeof AGE_RESTRICTED_KEYWORDS)[number];
