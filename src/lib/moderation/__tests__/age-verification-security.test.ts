// @ts-nocheck
/**
 * Age Verification Security Tests (DSA Art. 28 + EU Age-Verification Blueprint)
 * Tests token security, no raw ID persistence, replay prevention, and privacy compliance
 *
 * Requirements:
 * - Requirement 8.1: Privacy-preserving age attribute verification
 * - Requirement 8.2: One-time verification token manager
 * - Requirement 8.6: No device fingerprinting without consent
 * - Art. 28: Protection of Minors
 * - EU Age-Verification Blueprint compliance
 */

import { supabase } from '@/lib/supabase';

import { AgeVerificationService } from '../age-verification-service';

describe('Age Verification Security Tests', () => {
  let ageVerificationService: AgeVerificationService;

  beforeEach(() => {
    ageVerificationService = new AgeVerificationService(supabase);
    jest.clearAllMocks();
  });

  describe('No Raw ID Persistence (Blueprint Compliance)', () => {
    it('should not store raw ID data after verification', async () => {
      const userId = 'user-no-raw-id-123';
      const ageAttribute = {
        over18: true,
        verificationMethod: 'eudi_wallet' as const,
        attributeHash: 'hashed-attribute-data',
      };

      const token = await ageVerificationService.verifyAgeAttribute(
        userId,
        ageAttribute
      );

      expect(token.isValid).toBe(true);

      // Query database to verify no raw ID data
      const { data: userRecord } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      expect(userRecord?.rawIdData).toBeUndefined();
      expect(userRecord?.idDocument).toBeUndefined();
      expect(userRecord?.idNumber).toBeUndefined();
      expect(userRecord?.passportNumber).toBeUndefined();
      expect(userRecord?.driverLicenseNumber).toBeUndefined();
    });

    it('should only store age verification status and token hash', async () => {
      const userId = 'user-token-hash-456';
      const ageAttribute = {
        over18: true,
        verificationMethod: 'eudi_wallet' as const,
        attributeHash: 'hashed-attribute',
      };

      await ageVerificationService.verifyAgeAttribute(userId, ageAttribute);

      const { data: ageStatus } = await supabase
        .from('user_age_status')
        .select('*')
        .eq('user_id', userId)
        .single();

      expect(ageStatus).toMatchObject({
        user_id: userId,
        is_verified: true,
        verification_method: 'eudi_wallet',
        // Should have token hash, not raw token
        token_hash: expect.any(String),
      });

      // Verify no PII fields
      expect(ageStatus?.raw_id_data).toBeUndefined();
      expect(ageStatus?.personal_info).toBeUndefined();
    });

    it('should reject verification attempts with raw ID data', async () => {
      const userId = 'user-raw-id-reject';
      const invalidAttribute: any = {
        over18: true,
        verificationMethod: 'id_card',
        rawIdNumber: 'DE123456789', // Should not be accepted
        idDocument: { type: 'passport', number: 'P123456' },
      };

      await expect(
        ageVerificationService.verifyAgeAttribute(userId, invalidAttribute)
      ).rejects.toThrow(/raw ID data not allowed/i);
    });
  });

  describe('Token Security (HMAC-SHA256)', () => {
    it('should hash tokens with HMAC-SHA256', async () => {
      const userId = 'user-token-hash-789';
      const ageAttribute = {
        over18: true,
        verificationMethod: 'eudi_wallet' as const,
        attributeHash: 'test-hash',
      };

      const token = await ageVerificationService.verifyAgeAttribute(
        userId,
        ageAttribute
      );

      // Verify token structure
      expect(token.tokenId).toBeDefined();
      expect(token.tokenHash).toBeDefined();
      expect(token.tokenHash).toHaveLength(64); // SHA-256 hex = 64 chars

      // Verify token is hashed, not plaintext
      expect(token.tokenHash).not.toBe(token.tokenId);
    });

    it('should use environment-specific salt for token hashing', async () => {
      const userId = 'user-salt-test';
      const ageAttribute = {
        over18: true,
        verificationMethod: 'eudi_wallet' as const,
        attributeHash: 'test-hash',
      };

      // Mock different environments
      const originalEnv = process.env.NODE_ENV;

      process.env.NODE_ENV = 'development';
      const token1 = await ageVerificationService.verifyAgeAttribute(
        userId,
        ageAttribute
      );

      process.env.NODE_ENV = 'production';
      const token2 = await ageVerificationService.verifyAgeAttribute(
        userId,
        ageAttribute
      );

      // Same input should produce different hashes in different environments
      expect(token1.tokenHash).not.toBe(token2.tokenHash);

      process.env.NODE_ENV = originalEnv;
    });

    it('should generate cryptographically secure random tokens', async () => {
      const userId = 'user-random-token';
      const ageAttribute = {
        over18: true,
        verificationMethod: 'eudi_wallet' as const,
        attributeHash: 'test-hash',
      };

      const token1 = await ageVerificationService.verifyAgeAttribute(
        userId,
        ageAttribute
      );
      const token2 = await ageVerificationService.verifyAgeAttribute(
        userId,
        ageAttribute
      );

      // Tokens should be unique
      expect(token1.tokenId).not.toBe(token2.tokenId);
      expect(token1.tokenHash).not.toBe(token2.tokenHash);

      // Tokens should be sufficiently long (entropy)
      expect(token1.tokenId.length).toBeGreaterThanOrEqual(32);
    });
  });

  describe('Replay Attack Prevention', () => {
    it('should prevent token reuse after first validation', async () => {
      const userId = 'user-replay-prevention';
      const ageAttribute = {
        over18: true,
        verificationMethod: 'eudi_wallet' as const,
        attributeHash: 'test-hash',
      };

      const token = await ageVerificationService.verifyAgeAttribute(
        userId,
        ageAttribute
      );

      // First use should succeed
      const firstUse = await ageVerificationService.validateToken(
        token.tokenId
      );
      expect(firstUse.isValid).toBe(true);

      // Second use should fail (replay attack)
      const replayAttempt = await ageVerificationService.validateToken(
        token.tokenId
      );
      expect(replayAttempt.isValid).toBe(false);
      expect(replayAttempt.error).toBe('token_already_used');
    });

    it('should track token use count', async () => {
      const userId = 'user-use-count';
      const ageAttribute = {
        over18: true,
        verificationMethod: 'eudi_wallet' as const,
        attributeHash: 'test-hash',
      };

      const token = await ageVerificationService.verifyAgeAttribute(
        userId,
        ageAttribute
      );

      await ageVerificationService.validateToken(token.tokenId);

      const { data: tokenRecord } = await supabase
        .from('age_verification_tokens')
        .select('use_count')
        .eq('token_hash', token.tokenHash)
        .single();

      expect(tokenRecord?.use_count).toBe(1);
    });

    it('should log suspicious replay attempts', async () => {
      const userId = 'user-replay-log';
      const ageAttribute = {
        over18: true,
        verificationMethod: 'eudi_wallet' as const,
        attributeHash: 'test-hash',
      };

      const token = await ageVerificationService.verifyAgeAttribute(
        userId,
        ageAttribute
      );

      // Use token once
      await ageVerificationService.validateToken(token.tokenId);

      // Attempt replay
      await ageVerificationService.validateToken(token.tokenId);

      // Verify audit log
      const { data: auditLogs } = await supabase
        .from('age_verification_audit')
        .select('*')
        .eq('user_id', userId)
        .eq('event_type', 'token_replay_attempt');

      expect(auditLogs).toHaveLength(1);
      expect(auditLogs?.[0].metadata).toMatchObject({
        tokenHash: token.tokenHash,
        attemptedAt: expect.any(String),
      });
    });

    it('should expire tokens after configured duration', async () => {
      const userId = 'user-token-expiry';
      const ageAttribute = {
        over18: true,
        verificationMethod: 'eudi_wallet' as const,
        attributeHash: 'test-hash',
      };

      const token = await ageVerificationService.verifyAgeAttribute(
        userId,
        ageAttribute
      );

      // Mock time passage (90 days + 1 second)
      const expiryDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000 + 1000);
      jest.useFakeTimers();
      jest.setSystemTime(expiryDate);

      const validation = await ageVerificationService.validateToken(
        token.tokenId
      );

      expect(validation.isValid).toBe(false);
      expect(validation.error).toBe('token_expired');

      jest.useRealTimers();
    });
  });

  describe('Suspicious Activity Detection (ePrivacy 5(3) Compliance)', () => {
    it('should detect suspicious activity only with consent', async () => {
      const userId = 'user-suspicious-consent';

      // Without consent: should not perform device fingerprinting
      const resultNoConsent =
        await ageVerificationService.detectSuspiciousActivity(
          userId,
          {
            rapidVerificationAttempts: 5,
            multipleDevices: true,
          },
          false // No consent
        );

      expect(resultNoConsent.fingerprintingPerformed).toBe(false);
      expect(resultNoConsent.limitedDetection).toBe(true);

      // With consent: can perform device fingerprinting
      const resultWithConsent =
        await ageVerificationService.detectSuspiciousActivity(
          userId,
          {
            rapidVerificationAttempts: 5,
            multipleDevices: true,
            deviceFingerprint: 'device-fp-123',
          },
          true // Has consent
        );

      expect(resultWithConsent.fingerprintingPerformed).toBe(true);
      expect(resultWithConsent.suspiciousActivityDetected).toBe(true);
    });

    it('should not store device fingerprints without consent', async () => {
      const userId = 'user-no-fingerprint-storage';

      await ageVerificationService.detectSuspiciousActivity(
        userId,
        {
          rapidVerificationAttempts: 3,
          deviceFingerprint: 'should-not-be-stored',
        },
        false // No consent
      );

      const { data: auditLogs } = await supabase
        .from('age_verification_audit')
        .select('*')
        .eq('user_id', userId);

      // Verify no device fingerprint in audit logs
      auditLogs?.forEach((log) => {
        expect(log.metadata?.deviceFingerprint).toBeUndefined();
      });
    });

    it('should detect rapid verification attempts without fingerprinting', async () => {
      const userId = 'user-rapid-attempts';

      // Simulate 10 verification attempts in 1 hour
      for (let i = 0; i < 10; i++) {
        await ageVerificationService.verifyAgeAttribute(userId, {
          over18: true,
          verificationMethod: 'eudi_wallet',
          attributeHash: `hash-${i}`,
        });
      }

      const result = await ageVerificationService.detectSuspiciousActivity(
        userId,
        { rapidVerificationAttempts: 10 },
        false // No consent needed for this detection
      );

      expect(result.suspiciousActivityDetected).toBe(true);
      expect(result.reason).toContain('rapid_verification_attempts');
      expect(result.fingerprintingPerformed).toBe(false);
    });

    it('should require explicit consent for GPS-based location checks', async () => {
      const userId = 'user-gps-consent';

      // Without consent: should not use GPS
      await expect(
        ageVerificationService.verifyLocationBasedAge(userId, {
          useGPS: true,
          hasConsent: false,
        })
      ).rejects.toThrow(/GPS location requires explicit consent/i);

      // With consent: can use GPS
      const result = await ageVerificationService.verifyLocationBasedAge(
        userId,
        {
          useGPS: true,
          hasConsent: true,
          purpose: 'Age-restricted content access verification',
        }
      );

      expect(result.gpsUsed).toBe(true);
      expect(result.consentRecorded).toBe(true);
    });
  });

  describe('EUDI Wallet Integration (Blueprint Compliance)', () => {
    it('should accept EUDI wallet age attributes', async () => {
      const userId = 'user-eudi-wallet';
      const eudiAttribute = {
        over18: true,
        verificationMethod: 'eudi_wallet' as const,
        attributeHash: 'eudi-signed-attribute-hash',
        walletProvider: 'eu-digital-identity',
      };

      const token = await ageVerificationService.verifyAgeAttribute(
        userId,
        eudiAttribute
      );

      expect(token.isValid).toBe(true);
      expect(token.verificationMethod).toBe('eudi_wallet');
    });

    it('should validate EUDI wallet signatures', async () => {
      const userId = 'user-eudi-signature';
      const invalidAttribute = {
        over18: true,
        verificationMethod: 'eudi_wallet' as const,
        attributeHash: 'invalid-signature',
        walletProvider: 'unknown-provider',
      };

      await expect(
        ageVerificationService.verifyAgeAttribute(userId, invalidAttribute)
      ).rejects.toThrow(/invalid EUDI wallet signature/i);
    });

    it('should support multiple verification methods', async () => {
      const userId = 'user-multi-method';

      const methods = [
        'eudi_wallet',
        'id_card_attribute',
        'bank_verification',
        'mobile_id',
      ] as const;

      for (const method of methods) {
        const token = await ageVerificationService.verifyAgeAttribute(userId, {
          over18: true,
          verificationMethod: method,
          attributeHash: `hash-${method}`,
        });

        expect(token.isValid).toBe(true);
        expect(token.verificationMethod).toBe(method);
      }
    });
  });

  describe('Appeal Window Configuration', () => {
    it('should provide configurable appeal window (minimum 7 days)', async () => {
      const appealWindowDays = ageVerificationService.getAppealWindowDays();

      expect(appealWindowDays).toBeGreaterThanOrEqual(7);
    });

    it('should allow users to appeal age verification decisions', async () => {
      const userId = 'user-appeal-age';

      // Simulate failed verification
      await ageVerificationService.recordVerificationFailure(userId, {
        reason: 'Attribute verification failed',
        canAppeal: true,
      });

      const appeal = await ageVerificationService.submitAgeVerificationAppeal(
        userId,
        {
          reason: 'Verification error, I am over 18',
          evidence: ['alternative-verification-method'],
        }
      );

      expect(appeal.appealType).toBe('age_verification');
      expect(appeal.status).toBe('pending');
      expect(appeal.deadline).toBeInstanceOf(Date);

      const appealWindowMs =
        appeal.deadline.getTime() - appeal.submittedAt.getTime();
      const appealWindowDays = appealWindowMs / (1000 * 60 * 60 * 24);

      expect(appealWindowDays).toBeGreaterThanOrEqual(7);
    });
  });

  describe('Privacy-by-Design Principles', () => {
    it('should implement data minimization for age verification', async () => {
      const userId = 'user-data-minimization';
      const ageAttribute = {
        over18: true,
        verificationMethod: 'eudi_wallet' as const,
        attributeHash: 'minimal-data-hash',
      };

      await ageVerificationService.verifyAgeAttribute(userId, ageAttribute);

      const { data: storedData } = await supabase
        .from('user_age_status')
        .select('*')
        .eq('user_id', userId)
        .single();

      // Verify only essential fields are stored
      const allowedFields = [
        'id',
        'user_id',
        'is_verified',
        'verification_method',
        'token_hash',
        'verified_at',
        'expires_at',
        'created_at',
        'updated_at',
      ];

      const storedFields = Object.keys(storedData || {});
      storedFields.forEach((field) => {
        expect(allowedFields).toContain(field);
      });
    });

    it('should auto-delete expired verification tokens', async () => {
      const userId = 'user-auto-delete';
      const ageAttribute = {
        over18: true,
        verificationMethod: 'eudi_wallet' as const,
        attributeHash: 'test-hash',
      };

      const token = await ageVerificationService.verifyAgeAttribute(
        userId,
        ageAttribute
      );

      // Mock time passage (90 days + 1 day)
      jest.useFakeTimers();
      jest.setSystemTime(new Date(Date.now() + 91 * 24 * 60 * 60 * 1000));

      // Run cleanup job
      await ageVerificationService.cleanupExpiredTokens();

      const { data: tokenRecord } = await supabase
        .from('age_verification_tokens')
        .select('*')
        .eq('token_hash', token.tokenHash)
        .single();

      expect(tokenRecord).toBeNull();

      jest.useRealTimers();
    });

    it('should retain audit logs per retention policy', async () => {
      const userId = 'user-audit-retention';
      const ageAttribute = {
        over18: true,
        verificationMethod: 'eudi_wallet' as const,
        attributeHash: 'test-hash',
      };

      await ageVerificationService.verifyAgeAttribute(userId, ageAttribute);

      // Mock time passage (12 months)
      jest.useFakeTimers();
      jest.setSystemTime(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000));

      // Run cleanup job
      await ageVerificationService.cleanupOldAuditLogs();

      const { data: auditLogs } = await supabase
        .from('age_verification_audit')
        .select('*')
        .eq('user_id', userId);

      // Audit logs should be deleted after 12 months
      expect(auditLogs).toHaveLength(0);

      jest.useRealTimers();
    });
  });

  describe('Safer Defaults for Minors', () => {
    it('should assume minor status until verified', async () => {
      const userId = 'user-unverified-minor';

      const ageStatus = await ageVerificationService.getUserAgeStatus(userId);

      expect(ageStatus.isVerified).toBe(false);
      expect(ageStatus.assumedMinor).toBe(true);
      expect(ageStatus.canAccessAgeRestrictedContent).toBe(false);
    });

    it('should apply stricter content filtering for unverified users', async () => {
      const userId = 'user-strict-filtering';
      const contentId = 'age-restricted-content-123';

      const accessResult = await ageVerificationService.checkAgeGating(
        userId,
        contentId
      );

      expect(accessResult.allowed).toBe(false);
      expect(accessResult.reason).toContain('age_verification_required');
      expect(accessResult.saferDefaultsApplied).toBe(true);
    });
  });
});
