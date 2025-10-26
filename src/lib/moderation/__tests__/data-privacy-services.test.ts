// @ts-nocheck
/**
 * Data Privacy Services Tests
 * Tests for GDPR compliance implementation
 */

import { beforeEach, describe, expect, it } from '@jest/globals';

import { DataMinimizationService } from '../data-minimization-service';
import { DataRetentionService } from '../data-retention-service';
import { PrivacyConsentService } from '../privacy-consent-service';
import { UserDataExportService } from '../user-data-export-service';

describe('DataMinimizationService', () => {
  let service: DataMinimizationService;

  beforeEach(() => {
    service = new DataMinimizationService();
  });

  describe('validateDataCollection', () => {
    it('should validate required fields for identity data', () => {
      const result = service.validateDataCollection('identity', [
        'user_id',
        'created_at',
      ]);

      expect(result.isValid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should detect prohibited fields', () => {
      const result = service.validateDataCollection('identity', [
        'user_id',
        'created_at',
        'ssn', // Prohibited
      ]);

      expect(result.isValid).toBe(false);
      expect(result.violations[0]).toContain('Prohibited fields detected');
    });

    it('should detect missing required fields', () => {
      const result = service.validateDataCollection('identity', [
        'display_name',
      ]);

      expect(result.isValid).toBe(false);
      expect(result.violations[0]).toContain('Missing required fields');
    });

    it('should warn about unnecessary fields', () => {
      const result = service.validateDataCollection('identity', [
        'user_id',
        'created_at',
        'unnecessary_field',
      ]);

      expect(result.isValid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('filterData', () => {
    it('should filter data to only allowed fields', () => {
      const data = {
        user_id: '123',
        created_at: new Date(),
        display_name: 'Test User',
        ssn: '123-45-6789', // Should be filtered out
        extra_field: 'value',
      };

      const filtered = service.filterData('identity', data);

      expect(filtered).toHaveProperty('user_id');
      expect(filtered).toHaveProperty('created_at');
      expect(filtered).toHaveProperty('display_name');
      expect(filtered).not.toHaveProperty('ssn');
      expect(filtered).not.toHaveProperty('extra_field');
    });
  });

  describe('shouldAnonymize', () => {
    it('should return true for behavioral data older than threshold', () => {
      const result = service.shouldAnonymize('behavioral', 100);
      expect(result).toBe(true);
    });

    it('should return false for behavioral data within threshold', () => {
      const result = service.shouldAnonymize('behavioral', 30);
      expect(result).toBe(false);
    });

    it('should return false for categories without anonymization threshold', () => {
      const result = service.shouldAnonymize('moderation', 1000);
      expect(result).toBe(false);
    });
  });

  describe('anonymizeData', () => {
    it('should anonymize identity data', () => {
      const data = {
        user_id: 'user-123',
        display_name: 'John Doe',
        created_at: new Date(),
      };

      const anonymized = service.anonymizeData('identity', data);

      expect(anonymized.user_id).not.toBe(data.user_id);
      expect(anonymized).not.toHaveProperty('display_name');
    });

    it('should mask email addresses', () => {
      const data = {
        email: 'john.doe@example.com',
      };

      const anonymized = service.anonymizeData('contact', data);

      expect(anonymized.email).toContain('@example.com');
      expect(anonymized.email).not.toBe(data.email);
      expect(anonymized.email).toContain('***');
    });

    it('should mask IP addresses', () => {
      const data = {
        ip_address: '192.168.1.100',
      };

      const anonymized = service.anonymizeData('technical', data);

      expect(anonymized.ip_address).toContain('192.168');
      expect(anonymized.ip_address).toContain('***');
    });
  });

  describe('documentLegalBasis', () => {
    it('should document legal basis for data processing', () => {
      const result = service.documentLegalBasis(
        'moderation',
        'DSA compliance reporting'
      );

      expect(result.legalBasis).toBe('legal_obligation');
      expect(result.documentation).toContain('moderation');
      expect(result.documentation).toContain('legal_obligation');
    });
  });
});

describe('DataRetentionService', () => {
  let service: DataRetentionService;

  beforeEach(() => {
    service = new DataRetentionService();
  });

  describe('calculateExpiryDate', () => {
    it('should calculate expiry date based on retention policy', () => {
      const createdAt = new Date('2023-01-01');
      const expiryDate = service.calculateExpiryDate('technical', createdAt);

      const expectedExpiry = new Date('2023-01-01');
      expectedExpiry.setDate(expectedExpiry.getDate() + 90); // 90 days for technical

      expect(expiryDate.getTime()).toBe(expectedExpiry.getTime());
    });

    it('should use different retention periods for different categories', () => {
      const createdAt = new Date('2023-01-01');

      const technicalExpiry = service.calculateExpiryDate(
        'technical',
        createdAt
      );
      const auditExpiry = service.calculateExpiryDate('audit', createdAt);

      expect(auditExpiry.getTime()).toBeGreaterThan(technicalExpiry.getTime());
    });
  });

  describe('isExpired', () => {
    it('should return true for expired data', () => {
      const oldDate = new Date();
      oldDate.setFullYear(oldDate.getFullYear() - 10); // 10 years ago

      const result = service.isExpired('technical', oldDate, false);
      expect(result).toBe(true);
    });

    it('should return false for recent data', () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 1); // Yesterday

      const result = service.isExpired('technical', recentDate, false);
      expect(result).toBe(false);
    });

    it('should account for grace period when specified', () => {
      const createdAt = new Date();
      createdAt.setDate(createdAt.getDate() - 91); // 91 days ago (just past 90-day retention)

      // Without grace period, should be expired
      const withoutGrace = service.isExpired('technical', createdAt, false);
      expect(withoutGrace).toBe(true);

      // With grace period (30 days), should not be expired yet
      const withGrace = service.isExpired('technical', createdAt, true);
      expect(withGrace).toBe(false);
    });
  });

  describe('getRetentionPolicy', () => {
    it('should return retention policy configuration', () => {
      const policy = service.getRetentionPolicy();

      expect(policy).toHaveProperty('defaultRetentionDays');
      expect(policy).toHaveProperty('gracePeriodDays');
      expect(policy).toHaveProperty('auditRetentionDays');
    });
  });

  describe('updateRetentionPolicy', () => {
    it('should update retention policy', () => {
      const originalPolicy = service.getRetentionPolicy();

      service.updateRetentionPolicy({
        gracePeriodDays: 60,
      });

      const updatedPolicy = service.getRetentionPolicy();

      expect(updatedPolicy.gracePeriodDays).toBe(60);
      expect(updatedPolicy.gracePeriodDays).not.toBe(
        originalPolicy.gracePeriodDays
      );
    });
  });
});

describe('UserDataExportService', () => {
  let service: UserDataExportService;

  beforeEach(() => {
    service = new UserDataExportService();
  });

  describe('formatDataPackage', () => {
    it('should format data package as JSON', async () => {
      const dataPackage = {
        userId: 'user-123',
        exportedAt: new Date(),
        format: 'json' as const,
        categories: {
          identity: { user_id: 'user-123', email: 'test@example.com' },
        },
        metadata: {
          version: '1.0.0',
          totalRecords: 1,
        },
      };

      const result = await service.formatDataPackage(dataPackage, 'json');

      expect(typeof result).toBe('string');
      const parsed = JSON.parse(result as string);
      expect(parsed.userId).toBe('user-123');
    });

    it('should format data package as CSV', async () => {
      const dataPackage = {
        userId: 'user-123',
        exportedAt: new Date(),
        format: 'csv' as const,
        categories: {
          identity: [{ user_id: 'user-123', email: 'test@example.com' }],
        },
        metadata: {
          version: '1.0.0',
          totalRecords: 1,
        },
      };

      const result = await service.formatDataPackage(dataPackage, 'csv');

      expect(typeof result).toBe('string');
      expect(result).toContain('User Data Export');
      expect(result).toContain('user-123');
    });

    it('should format data package as XML', async () => {
      const dataPackage = {
        userId: 'user-123',
        exportedAt: new Date(),
        format: 'xml' as const,
        categories: {
          identity: { user_id: 'user-123' },
        },
        metadata: {
          version: '1.0.0',
          totalRecords: 1,
        },
      };

      const result = await service.formatDataPackage(dataPackage, 'xml');

      expect(typeof result).toBe('string');
      expect(result).toContain('<?xml');
      expect(result).toContain('<UserDataExport>');
      expect(result).toContain('user-123');
    });

    it('should throw error for unsupported format', async () => {
      const dataPackage = {
        userId: 'user-123',
        exportedAt: new Date(),
        format: 'json' as const,
        categories: {},
        metadata: {
          version: '1.0.0',
          totalRecords: 0,
        },
      };

      await expect(
        service.formatDataPackage(dataPackage, 'pdf')
      ).rejects.toThrow('PDF export not yet implemented');
    });
  });
});

describe('PrivacyConsentService', () => {
  let service: PrivacyConsentService;

  beforeEach(() => {
    service = new PrivacyConsentService();
  });

  describe('getConsentPurposes', () => {
    it('should return list of consent purposes', () => {
      const purposes = service.getConsentPurposes();

      expect(Array.isArray(purposes)).toBe(true);
      expect(purposes.length).toBeGreaterThan(0);
      expect(purposes[0]).toHaveProperty('purpose');
      expect(purposes[0]).toHaveProperty('description');
      expect(purposes[0]).toHaveProperty('required');
    });

    it('should include GPS location consent', () => {
      const purposes = service.getConsentPurposes();

      const gpsConsent = purposes.find((p) => p.purpose === 'gps_location');
      expect(gpsConsent).toBeDefined();
      expect(gpsConsent?.required).toBe(true);
    });

    it('should include device fingerprinting consent', () => {
      const purposes = service.getConsentPurposes();

      const fingerprintConsent = purposes.find(
        (p) => p.purpose === 'device_fingerprinting'
      );
      expect(fingerprintConsent).toBeDefined();
      expect(fingerprintConsent?.required).toBe(true);
    });
  });
});

describe('GDPR Compliance Integration', () => {
  it('should enforce data minimization for moderation data', () => {
    const service = new DataMinimizationService();

    /* const moderationData = {
      report_id: 'report-123',
      decision_id: 'decision-456',
      action_type: 'remove',
      timestamp: new Date(),
      legal_basis: 'legal_obligation',
      user_ssn: '123-45-6789', // Should be prohibited
    }; */

    const validation = service.validateDataCollection('moderation', [
      'report_id',
      'decision_id',
      'action_type',
      'timestamp',
      'legal_basis',
      'user_ssn',
    ]);

    expect(validation.isValid).toBe(false);
    expect(validation.violations[0]).toContain('Prohibited fields');
  });

  it('should apply correct retention periods for different data categories', () => {
    const service = new DataRetentionService();
    const policy = service.getRetentionPolicy();

    // Audit logs should have longest retention (7 years)
    expect(policy.defaultRetentionDays.audit).toBe(2555);

    // Technical data should have shortest retention (90 days)
    expect(policy.defaultRetentionDays.technical).toBe(90);

    // Moderation data should have 5-year retention for compliance
    expect(policy.defaultRetentionDays.moderation).toBe(1825);
  });

  it('should support two-stage deletion process', () => {
    const service = new DataRetentionService();
    const policy = service.getRetentionPolicy();

    // Grace period should be configured
    expect(policy.gracePeriodDays).toBeGreaterThan(0);

    // Verify grace period is applied
    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - 91); // Just past retention

    const withoutGrace = service.isExpired('technical', createdAt, false);
    const withGrace = service.isExpired('technical', createdAt, true);

    expect(withoutGrace).toBe(true);
    expect(withGrace).toBe(false);
  });
});
