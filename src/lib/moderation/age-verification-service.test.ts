/**
 * Age Verification Service Tests
 *
 * Tests token security, replay prevention, no raw ID storage,
 * and privacy-preserving verification
 *
 * Requirements: 8.1, 8.6
 */

import { createClient } from '@supabase/supabase-js';

import type {
  AgeAttribute,
  DetectSuspiciousActivityInput,
  VerifyAgeAttributeInput,
} from '@/types/age-verification';

import { AgeVerificationService } from './age-verification-service';

// Mock Supabase client
jest.mock('@supabase/supabase-js');

// Mock expo-crypto
jest.mock('expo-crypto', () => ({
  digestStringAsync: jest.fn().mockResolvedValue('mocked-hash-value'),
  getRandomBytesAsync: jest.fn().mockResolvedValue(new Uint8Array(16).fill(1)),
  CryptoDigestAlgorithm: {
    SHA256: 'SHA256',
  },
}));

describe('AgeVerificationService', () => {
  let service: AgeVerificationService;
  let mockSupabase: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock query builder that works with (as any) casting
    const createMockQueryBuilder = () => {
      const builder = {
        insert: jest.fn(),
        update: jest.fn(),
        select: jest.fn(),
        eq: jest.fn(),
        lt: jest.fn(),
        single: jest.fn(),
        upsert: jest.fn(),
        gt: jest.fn(),
        is: jest.fn(),
        order: jest.fn(),
        limit: jest.fn(),
        in: jest.fn(),
      };

      // Make all methods return the builder for chaining, except single
      Object.keys(builder).forEach((key) => {
        if (key !== 'single') {
          builder[key as keyof typeof builder].mockReturnValue(builder);
        }
      });

      return builder;
    };

    const mockQueryBuilder = createMockQueryBuilder();

    mockSupabase = {
      from: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    // Store references for assertions
    Object.assign(mockSupabase, mockQueryBuilder);

    (createClient as jest.Mock).mockReturnValue(mockSupabase);

    service = new AgeVerificationService(
      mockSupabase,
      'test-secret-key-for-hmac'
    );
  });

  describe('verifyAgeAttribute', () => {
    it('should successfully verify age attribute and issue token', async () => {
      const userId = 'user-123';
      const ageAttribute: AgeAttribute = {
        over18: true,
        verificationMethod: 'eudi_wallet',
        verificationProvider: 'EU Trust Service Provider',
        assuranceLevel: 'high',
      };

      const input: VerifyAgeAttributeInput = {
        userId,
        ageAttribute,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      };

      // Mock successful token insertion
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'token-123',
          user_id: userId,
          token_hash: 'hashed-token',
          expires_at: new Date(
            Date.now() + 90 * 24 * 60 * 60 * 1000
          ).toISOString(),
          max_uses: 1,
          issued_at: new Date().toISOString(),
        },
        error: null,
      });

      // Mock audit log insertion
      mockSupabase.insert.mockResolvedValue({ error: null });

      // Mock user status upsert
      mockSupabase.upsert.mockResolvedValue({ error: null });

      const result = await service.verifyAgeAttribute(input);

      expect(result.isValid).toBe(true);
      expect(result.id).toBe('token-123');
      expect(mockSupabase.from).toHaveBeenCalledWith('age_verification_audit');
      expect(mockSupabase.from).toHaveBeenCalledWith('age_verification_tokens');
      expect(mockSupabase.from).toHaveBeenCalledWith('user_age_status');
    });

    it('should reject under-age users and log failure', async () => {
      const userId = 'user-123';
      const ageAttribute: AgeAttribute = {
        over18: false,
        verificationMethod: 'id_attribute',
      };

      const input: VerifyAgeAttributeInput = {
        userId,
        ageAttribute,
      };

      // Mock audit log insertion
      mockSupabase.insert.mockResolvedValue({ error: null });

      await expect(service.verifyAgeAttribute(input)).rejects.toThrow(
        'User is under 18'
      );

      // Verify failure was logged
      expect(mockSupabase.from).toHaveBeenCalledWith('age_verification_audit');
      expect(mockSupabase.insert).toHaveBeenCalled();
    });

    it('should not store raw ID data during verification', async () => {
      const userId = 'user-123';
      const ageAttribute: AgeAttribute = {
        over18: true,
        verificationMethod: 'eudi_wallet',
      };

      const input: VerifyAgeAttributeInput = {
        userId,
        ageAttribute,
      };

      // Mock successful token insertion
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'token-123',
          user_id: userId,
          token_hash: 'hashed-token',
          expires_at: new Date(
            Date.now() + 90 * 24 * 60 * 60 * 1000
          ).toISOString(),
          max_uses: 1,
        },
        error: null,
      });

      mockSupabase.insert.mockResolvedValue({ error: null });
      mockSupabase.upsert.mockResolvedValue({ error: null });

      await service.verifyAgeAttribute(input);

      // Verify no raw ID fields in insert calls
      const insertCalls = mockSupabase.insert.mock.calls;
      insertCalls.forEach((call: any) => {
        const data = call[0];
        expect(data).not.toHaveProperty('raw_id');
        expect(data).not.toHaveProperty('id_document');
        expect(data).not.toHaveProperty('birth_date');
        expect(data).not.toHaveProperty('biometric_data');
      });
    });
  });

  describe('validateToken', () => {
    it('should validate a valid token and increment use count', async () => {
      const token = 'user-123-1234567890abcdef';
      const tokenId = 'token-123';
      const userId = 'user-123';

      // Mock token fetch by hash
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: tokenId,
          user_id: userId,
          token_hash: 'hashed-token',
          issued_at: new Date().toISOString(),
          expires_at: new Date(
            Date.now() + 90 * 24 * 60 * 60 * 1000
          ).toISOString(),
          revoked_at: null,
          used_at: null,
          use_count: 0,
          max_uses: 1,
          verification_method: 'eudi_wallet',
          age_attribute_verified: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        error: null,
      });

      // Mock the conditional update to succeed (token available)
      const mockQueryBuilder = mockSupabase.from();
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: {
          id: tokenId,
          user_id: userId,
          use_count: 1,
          // ... other updated fields
        },
        error: null,
      });

      // Mock audit log
      mockSupabase.insert.mockResolvedValue({ error: null });

      const result = await service.validateToken(token);

      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
      expect(mockQueryBuilder.lt).toHaveBeenCalledWith('use_count', 1); // Conditional check
      expect(mockQueryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          use_count: 1,
        })
      );
    });

    it('should prevent replay attacks on single-use tokens', async () => {
      const token = 'user-123-1234567890abcdef';
      const tokenId = 'token-123';
      const userId = 'user-123';

      // Mock already-used token
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: tokenId,
          user_id: userId,
          token_hash: 'hashed-token',
          issued_at: new Date().toISOString(),
          expires_at: new Date(
            Date.now() + 90 * 24 * 60 * 60 * 1000
          ).toISOString(),
          revoked_at: null,
          used_at: new Date().toISOString(),
          use_count: 1,
          max_uses: 1,
          verification_method: 'eudi_wallet',
          age_attribute_verified: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        error: null,
      });

      // Mock audit log
      mockSupabase.insert.mockResolvedValue({ error: null });

      const result = await service.validateToken(token);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('max_uses_exceeded');
      expect(mockSupabase.update).not.toHaveBeenCalled();
    });

    it('should reject expired tokens', async () => {
      const token = 'user-123-1234567890abcdef';
      const tokenId = 'token-123';
      const userId = 'user-123';

      // Mock expired token
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: tokenId,
          user_id: userId,
          token_hash: 'hashed-token',
          issued_at: new Date(
            Date.now() - 100 * 24 * 60 * 60 * 1000
          ).toISOString(),
          expires_at: new Date(
            Date.now() - 10 * 24 * 60 * 60 * 1000
          ).toISOString(),
          revoked_at: null,
          used_at: null,
          use_count: 0,
          max_uses: 1,
          verification_method: 'eudi_wallet',
          age_attribute_verified: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        error: null,
      });

      // Mock audit log
      mockSupabase.insert.mockResolvedValue({ error: null });

      const result = await service.validateToken(token);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('token_expired');
    });

    it('should reject revoked tokens', async () => {
      const token = 'user-123-1234567890abcdef';
      const tokenId = 'token-123';
      const userId = 'user-123';

      // Mock revoked token
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: tokenId,
          user_id: userId,
          token_hash: 'hashed-token',
          issued_at: new Date().toISOString(),
          expires_at: new Date(
            Date.now() + 90 * 24 * 60 * 60 * 1000
          ).toISOString(),
          revoked_at: new Date().toISOString(),
          revocation_reason: 'security_incident',
          used_at: null,
          use_count: 0,
          max_uses: 1,
          verification_method: 'eudi_wallet',
          age_attribute_verified: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        error: null,
      });

      // Mock audit log
      mockSupabase.insert.mockResolvedValue({ error: null });

      const result = await service.validateToken(token);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('token_revoked');
    });
  });

  describe('detectSuspiciousActivity', () => {
    it('should log suspicious activity without device signals when consent not given', async () => {
      const userId = 'user-123';
      const input: DetectSuspiciousActivityInput = {
        userId,
        signals: {
          rapidAccountCreation: true,
          multipleFailedVerifications: false,
          vpnDetected: true,
          deviceFingerprintMismatch: true, // Should be ignored without consent
          consentGiven: false,
        },
        hasConsent: false,
      };

      // Mock audit log
      mockSupabase.insert.mockResolvedValue({ error: null });

      // Mock user status upsert
      mockSupabase.upsert.mockResolvedValue({ error: null });

      await service.detectSuspiciousActivity(input);

      // Verify audit log was called
      expect(mockSupabase.from).toHaveBeenCalledWith('age_verification_audit');
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'suspicious_activity_detected',
          suspicious_signals: expect.objectContaining({
            rapidAccountCreation: true,
            vpnDetected: true,
            consentGiven: false,
          }),
          result: 'pending',
          user_id: 'user-123',
        })
      );
    });

    it('should include device signals when ePrivacy consent given', async () => {
      const userId = 'user-123';
      const input: DetectSuspiciousActivityInput = {
        userId,
        signals: {
          rapidAccountCreation: false,
          deviceFingerprintMismatch: true,
          suspiciousUserAgent: true,
          automatedBehavior: true,
          consentGiven: true,
          consentTimestamp: new Date(),
        },
        hasConsent: true,
      };

      // Mock audit log
      mockSupabase.insert.mockResolvedValue({ error: null });

      await service.detectSuspiciousActivity(input);

      // Verify device signals included
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          suspicious_signals: expect.objectContaining({
            deviceFingerprintMismatch: true,
            suspiciousUserAgent: true,
            automatedBehavior: true,
          }),
          consent_given: true,
        })
      );
    });

    it('should trigger additional verification for high-risk signals', async () => {
      const userId = 'user-123';
      const input: DetectSuspiciousActivityInput = {
        userId,
        signals: {
          rapidAccountCreation: true,
          multipleFailedVerifications: true,
          consentGiven: false,
        },
        hasConsent: false,
      };

      // Mock audit log
      mockSupabase.insert.mockResolvedValue({ error: null });

      // Mock user status upsert
      mockSupabase.upsert.mockResolvedValue({ error: null });

      await service.detectSuspiciousActivity(input);

      // Verify user marked for additional verification
      expect(mockSupabase.from).toHaveBeenCalledWith('user_age_status');
      expect(mockSupabase.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: userId,
          is_age_verified: false,
          is_minor: true, // Safer default
          minor_protections_enabled: true,
        })
      );
    });
  });

  describe('checkAgeGating', () => {
    it('should grant access to non-restricted content', async () => {
      const userId = 'user-123';
      const contentId = 'post-456';
      const contentType = 'post';

      // Mock no restriction found
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' }, // Not found
      });

      // Mock audit log
      mockSupabase.insert.mockResolvedValue({ error: null });

      const result = await service.checkAgeGating({
        userId,
        contentId,
        contentType,
      });

      expect(result.granted).toBe(true);
      expect(result.reason).toBe('content_not_restricted');
      expect(result.requiresVerification).toBe(false);
    });

    it('should grant access to verified users', async () => {
      const userId = 'user-123';
      const contentId = 'post-456';
      const contentType = 'post';

      // Mock restriction found
      mockSupabase.single
        .mockResolvedValueOnce({
          data: {
            content_id: contentId,
            content_type: contentType,
            is_age_restricted: true,
            min_age: 18,
          },
          error: null,
        })
        // Mock verified user status
        .mockResolvedValueOnce({
          data: {
            user_id: userId,
            is_age_verified: true,
            is_minor: false,
          },
          error: null,
        });

      // Mock audit log
      mockSupabase.insert.mockResolvedValue({ error: null });

      const result = await service.checkAgeGating({
        userId,
        contentId,
        contentType,
      });

      expect(result.granted).toBe(true);
      expect(result.reason).toBe('age_verified');
      expect(result.requiresVerification).toBe(false);
    });

    it('should deny access to unverified users', async () => {
      const userId = 'user-123';
      const contentId = 'post-456';
      const contentType = 'post';

      // Mock restriction found
      mockSupabase.single
        .mockResolvedValueOnce({
          data: {
            content_id: contentId,
            content_type: contentType,
            is_age_restricted: true,
            min_age: 18,
          },
          error: null,
        })
        // Mock unverified user status
        .mockResolvedValueOnce({
          data: {
            user_id: userId,
            is_age_verified: false,
            is_minor: true,
          },
          error: null,
        });

      // Mock audit log
      mockSupabase.insert.mockResolvedValue({ error: null });

      const result = await service.checkAgeGating({
        userId,
        contentId,
        contentType,
      });

      expect(result.granted).toBe(false);
      expect(result.reason).toBe('minor_protections_active');
      expect(result.requiresVerification).toBe(true);
    });
  });

  describe('revokeToken', () => {
    it('should revoke a token and log the event', async () => {
      const token = 'user-123-1234567890abcdef';
      const tokenId = 'token-123';
      const userId = 'user-123';
      const reason = 'security_incident';

      // Mock token update
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: tokenId,
          user_id: userId,
        },
        error: null,
      });

      // Mock audit log
      mockSupabase.insert.mockResolvedValue({ error: null });

      await service.revokeToken(token, reason);

      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          revoked_at: expect.any(String),
          revocation_reason: reason,
        })
      );
      expect(mockSupabase.from).toHaveBeenCalledWith('age_verification_audit');
    });
  });

  describe('getAppealWindowDays', () => {
    it('should return minimum 7 days per requirement 4.9', () => {
      const days = service.getAppealWindowDays();
      expect(days).toBeGreaterThanOrEqual(7);
    });
  });
});
