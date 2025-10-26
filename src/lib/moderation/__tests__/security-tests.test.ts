// @ts-nocheck
/**
 * Security Tests for Moderation System
 * Tests authentication, authorization, audit integrity, and security controls
 *
 * Requirements:
 * - Requirement 6.1: Immutable audit entries with cryptographic signatures
 * - Requirement 6.2: Chain of custody with access logging
 * - Requirement 6.6: Prevent tampering through integrity verification
 * - Requirement 10.1: Role-based access control
 */

import { supabase } from '@/lib/supabase';

import { AppealsService } from '../appeals-service';
import { AuditService } from '../audit-service';
import { ModerationService } from '../moderation-service';

describe('Security Tests', () => {
  let auditService: AuditService;
  let moderationService: ModerationService;

  beforeEach(() => {
    auditService = new AuditService(supabase);
    moderationService = new ModerationService(supabase, auditService);
    appealsService = new AppealsService(supabase, auditService);
    jest.clearAllMocks();
  });

  describe('Authentication & Authorization', () => {
    it('should prevent unauthorized access to moderation queues', async () => {
      const regularUser = {
        id: 'user-regular-123',
        role: 'user',
        mod_role: null,
      };

      await expect(
        moderationService.getModeratorQueue('mod-queue-1', {}, regularUser)
      ).rejects.toThrow(/insufficient permissions|unauthorized/i);
    });

    it('should allow moderators to access moderation queues', async () => {
      const moderator = {
        id: 'user-mod-456',
        role: 'user',
        mod_role: 'moderator',
      };

      const queue = await moderationService.getModeratorQueue(
        'mod-queue-1',
        {},
        moderator
      );

      expect(queue).toBeDefined();
      expect(queue.items).toBeInstanceOf(Array);
    });

    it('should allow admins to access all moderation functions', async () => {
      const admin = {
        id: 'user-admin-789',
        role: 'user',
        mod_role: 'admin',
      };

      const queue = await moderationService.getModeratorQueue(
        'mod-queue-1',
        {},
        admin
      );
      const reports = await moderationService.getAllReports(admin);
      const decisions = await moderationService.getAllDecisions(admin);

      expect(queue).toBeDefined();
      expect(reports).toBeDefined();
      expect(decisions).toBeDefined();
    });

    it('should enforce role-based access control via JWT claims', async () => {
      const mockJWT = {
        sub: 'user-123',
        role: 'user',
        mod_role: 'moderator',
      };

      const hasAccess = await moderationService.checkModeratorAccess(mockJWT);

      expect(hasAccess).toBe(true);
    });

    it('should prevent privilege escalation', async () => {
      const regularUser = {
        id: 'user-escalation-123',
        role: 'user',
        mod_role: null,
      };

      // Attempt to claim moderator role
      await expect(
        moderationService.claimReport('report-123', regularUser.id, regularUser)
      ).rejects.toThrow(/insufficient permissions/i);
    });

    it('should validate moderator credentials on every request', async () => {
      const expiredToken = {
        id: 'user-expired-456',
        role: 'user',
        mod_role: 'moderator',
        exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
      };

      await expect(
        moderationService.getModeratorQueue('mod-queue-1', {}, expiredToken)
      ).rejects.toThrow(/token expired|unauthorized/i);
    });

    it('should log all authentication attempts', async () => {
      const user = {
        id: 'user-auth-log-789',
        role: 'user',
        mod_role: 'moderator',
      };

      const auditLogSpy = jest.spyOn(auditService, 'logEvent');

      await moderationService.getModeratorQueue('mod-queue-1', {}, user);

      expect(auditLogSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'moderator_access',
          actorId: user.id,
          metadata: expect.objectContaining({
            mod_role: 'moderator',
          }),
        })
      );
    });
  });

  describe('Audit Trail Integrity', () => {
    it('should create immutable audit events with cryptographic signatures', async () => {
      const event = {
        eventType: 'decision_made',
        actorId: 'mod-123',
        targetId: 'report-456',
        action: 'remove_content',
        metadata: {
          reason: 'Policy violation',
          policyViolations: ['spam'],
        },
      };

      const auditEvent = await auditService.logEvent(event);

      expect(auditEvent.signature).toBeDefined();
      expect(auditEvent.signature.length).toBeGreaterThan(0);
      expect(auditEvent.id).toBeDefined();
    });

    it('should detect tampering with audit events', async () => {
      const event = await auditService.logEvent({
        eventType: 'test_event',
        actorId: 'actor-123',
        targetId: 'target-456',
        action: 'test_action',
        metadata: { original: 'data' },
      });

      // Attempt to tamper with event
      await supabase
        .from('audit_events')
        .update({ metadata: { tampered: 'data' } })
        .eq('id', event.id);

      const integrity = await auditService.verifyIntegrity(event.id);

      expect(integrity.isValid).toBe(false);
      expect(integrity.tampered).toBe(true);
    });

    it('should maintain chain of custody for audit trail access', async () => {
      await auditService.logEvent({
        eventType: 'sensitive_action',
        actorId: 'actor-789',
        targetId: 'target-123',
        action: 'access_pii',
        metadata: {},
      });

      const auditLogSpy = jest.spyOn(auditService, 'logEvent');

      await auditService.queryAuditTrail({
        targetId: 'target-123',
        accessedBy: 'auditor-456',
      });

      expect(auditLogSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'audit_trail_accessed',
          actorId: 'auditor-456',
          targetId: 'target-123',
        })
      );
    });

    it('should prevent deletion of audit events', async () => {
      const event = await auditService.logEvent({
        eventType: 'test_event',
        actorId: 'actor-123',
        targetId: 'target-456',
        action: 'test_action',
        metadata: {},
      });

      // Attempt to delete audit event
      await expect(
        supabase.from('audit_events').delete().eq('id', event.id)
      ).rejects.toThrow(/cannot delete audit events|operation not permitted/i);
    });

    it('should prevent modification of audit events', async () => {
      const event = await auditService.logEvent({
        eventType: 'test_event',
        actorId: 'actor-123',
        targetId: 'target-456',
        action: 'test_action',
        metadata: { original: 'data' },
      });

      // Attempt to update audit event
      await expect(
        supabase
          .from('audit_events')
          .update({ metadata: { modified: 'data' } })
          .eq('id', event.id)
      ).rejects.toThrow(/cannot update audit events|operation not permitted/i);
    });

    it('should verify partition checksums for integrity', async () => {
      const partition = '2025-01';

      // Create multiple events in partition
      for (let i = 0; i < 5; i++) {
        await auditService.logEvent({
          eventType: 'test_event',
          actorId: `actor-${i}`,
          targetId: `target-${i}`,
          action: 'test_action',
          metadata: {},
        });
      }

      // Generate partition checksum
      const checksum = await auditService.generatePartitionChecksum(partition);

      expect(checksum.partition).toBe(partition);
      expect(checksum.checksum).toBeDefined();
      expect(checksum.eventCount).toBe(5);

      // Verify partition integrity
      const integrity = await auditService.verifyPartitionIntegrity(partition);

      expect(integrity.isValid).toBe(true);
      expect(integrity.checksumMatch).toBe(true);
    });

    it('should detect partition tampering', async () => {
      const partition = '2025-01';

      // Create events
      for (let i = 0; i < 3; i++) {
        await auditService.logEvent({
          eventType: 'test_event',
          actorId: `actor-${i}`,
          targetId: `target-${i}`,
          action: 'test_action',
          metadata: {},
        });
      }

      // Generate checksum
      await auditService.generatePartitionChecksum(partition);

      // Tamper with partition (add event without updating checksum)
      await supabase.from('audit_events').insert({
        event_type: 'tampered_event',
        actor_id: 'tamper-actor',
        target_id: 'tamper-target',
        action: 'tamper_action',
        metadata: {},
        partition,
      });

      // Verify integrity
      const integrity = await auditService.verifyPartitionIntegrity(partition);

      expect(integrity.isValid).toBe(false);
      expect(integrity.reason).toContain('checksum mismatch');
    });
  });

  describe('Data Access Controls', () => {
    it('should enforce row-level security on sensitive data', async () => {
      /* const regularUser = {
        id: 'user-rls-123',
        role: 'user',
        mod_role: null,
      }; */

      // Attempt to access moderation decisions
      await expect(
        supabase
          .from('moderation_decisions')
          .select('*')
          .eq('moderator_id', 'mod-456')
      ).rejects.toThrow(/permission denied|access denied/i);
    });

    it('should allow moderators to access only their assigned reports', async () => {
      const moderator = {
        id: 'mod-assigned-789',
        role: 'user',
        mod_role: 'moderator',
      };

      const { data: reports } = await supabase
        .from('content_reports')
        .select('*')
        .eq('assigned_moderator_id', moderator.id);

      expect(reports).toBeDefined();
      expect(
        reports?.every((r) => r.assigned_moderator_id === moderator.id)
      ).toBe(true);
    });

    it('should prevent cross-moderator data access', async () => {
      const moderator1 = {
        id: 'mod-cross-111',
        role: 'user',
        mod_role: 'moderator',
      };

      const moderator2 = {
        id: 'mod-cross-222',
        role: 'user',
        mod_role: 'moderator',
      };

      // Moderator 1 claims report
      await moderationService.claimReport(
        'report-cross-123',
        moderator1.id,
        moderator1
      );

      // Moderator 2 attempts to access
      await expect(
        moderationService.getReportDetails('report-cross-123', moderator2)
      ).rejects.toThrow(/not assigned|access denied/i);
    });

    it('should log all data access attempts', async () => {
      const _moderator = {
        id: 'mod-access-log-456',
        role: 'user',
        mod_role: 'moderator',
      };

      const auditLogSpy = jest.spyOn(auditService, 'logEvent');

      await moderationService.getReportDetails('report-789', _moderator);

      expect(auditLogSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'data_accessed',
          actorId: _moderator.id,
          targetId: 'report-789',
          metadata: expect.objectContaining({
            dataType: 'content_report',
          }),
        })
      );
    });
  });

  describe('Input Validation & Injection Prevention', () => {
    it('should prevent SQL injection in report queries', async () => {
      const maliciousInput = "'; DROP TABLE content_reports; --";

      await expect(
        moderationService.searchReports({
          query: maliciousInput,
        })
      ).rejects.toThrow(/invalid input|validation error/i);
    });

    it('should sanitize user input in reports', async () => {
      const maliciousExplanation = '<script>alert("XSS")</script>';

      const report = await moderationService.submitReport({
        contentId: 'post-xss-123',
        reporterId: 'reporter-456',
        reportType: 'policy_violation',
        explanation: maliciousExplanation,
        contentLocator: 'https://example.com/post/123',
        reporterContact: { email: 'reporter@example.com' },
        goodFaithDeclaration: true,
        contentHash: 'xss-hash',
      });

      expect(report.explanation).not.toContain('<script>');
      expect(report.explanation).not.toContain('alert');
    });

    it('should validate content locator URLs', async () => {
      const invalidUrl = 'javascript:alert("XSS")';

      await expect(
        moderationService.submitReport({
          contentId: 'post-url-123',
          reporterId: 'reporter-789',
          reportType: 'policy_violation',
          explanation: 'Test',
          contentLocator: invalidUrl,
          reporterContact: { email: 'reporter@example.com' },
          goodFaithDeclaration: true,
          contentHash: 'url-hash',
        })
      ).rejects.toThrow(/invalid URL|validation error/i);
    });

    it('should enforce maximum input lengths', async () => {
      const tooLongExplanation = 'a'.repeat(10001); // Exceeds 10,000 char limit

      await expect(
        moderationService.submitReport({
          contentId: 'post-length-123',
          reporterId: 'reporter-456',
          reportType: 'policy_violation',
          explanation: tooLongExplanation,
          contentLocator: 'https://example.com/post/123',
          reporterContact: { email: 'reporter@example.com' },
          goodFaithDeclaration: true,
          contentHash: 'length-hash',
        })
      ).rejects.toThrow(/exceeds maximum length|validation error/i);
    });
  });

  describe('Rate Limiting & Abuse Prevention', () => {
    it('should rate limit report submissions', async () => {
      const userId = 'user-rate-limit-123';

      // Submit 10 reports rapidly
      const submissions = Array.from({ length: 10 }, (_, i) =>
        moderationService.submitReport({
          contentId: `post-${i}`,
          reporterId: userId,
          reportType: 'policy_violation',
          explanation: 'Test report',
          contentLocator: `https://example.com/post/${i}`,
          reporterContact: { email: 'reporter@example.com' },
          goodFaithDeclaration: true,
          contentHash: `hash-${i}`,
        })
      );

      await expect(Promise.all(submissions)).rejects.toThrow(
        /rate limit exceeded|too many requests/i
      );
    });

    it('should detect and prevent duplicate report spam', async () => {
      const userId = 'user-duplicate-spam';

      await moderationService.submitReport({
        contentId: 'post-duplicate-123',
        reporterId: userId,
        reportType: 'policy_violation',
        explanation: 'Spam content',
        contentLocator: 'https://example.com/post/duplicate',
        reporterContact: { email: 'reporter@example.com' },
        goodFaithDeclaration: true,
        contentHash: 'duplicate-hash',
      });

      // Attempt duplicate submission
      await expect(
        moderationService.submitReport({
          contentId: 'post-duplicate-123',
          reporterId: userId,
          reportType: 'policy_violation',
          explanation: 'Spam content',
          contentLocator: 'https://example.com/post/duplicate',
          reporterContact: { email: 'reporter@example.com' },
          goodFaithDeclaration: true,
          contentHash: 'duplicate-hash',
        })
      ).rejects.toThrow(/duplicate report|already reported/i);
    });

    it('should implement CAPTCHA for suspicious activity', async () => {
      const userId = 'user-captcha-456';

      // Simulate suspicious activity (rapid submissions)
      for (let i = 0; i < 5; i++) {
        await moderationService.submitReport({
          contentId: `post-${i}`,
          reporterId: userId,
          reportType: 'policy_violation',
          explanation: 'Test',
          contentLocator: `https://example.com/post/${i}`,
          reporterContact: { email: 'reporter@example.com' },
          goodFaithDeclaration: true,
          contentHash: `hash-${i}`,
        });
      }

      // Next submission should require CAPTCHA
      const nextSubmission = moderationService.submitReport({
        contentId: 'post-captcha',
        reporterId: userId,
        reportType: 'policy_violation',
        explanation: 'Test',
        contentLocator: 'https://example.com/post/captcha',
        reporterContact: { email: 'reporter@example.com' },
        goodFaithDeclaration: true,
        contentHash: 'captcha-hash',
      });

      await expect(nextSubmission).rejects.toThrow(/CAPTCHA required/i);
    });
  });

  describe('Encryption & Data Protection', () => {
    it('should encrypt sensitive data at rest', async () => {
      const report = await moderationService.submitReport({
        contentId: 'post-encrypt-123',
        reporterId: 'reporter-789',
        reportType: 'illegal',
        jurisdiction: 'DE',
        legalReference: 'DE StGB §86a',
        explanation: 'Sensitive content details',
        contentLocator: 'https://example.com/post/encrypt',
        reporterContact: { email: 'sensitive@example.com' },
        goodFaithDeclaration: true,
        contentHash: 'encrypt-hash',
      });

      // Query raw database to verify encryption
      const { data: rawReport } = await supabase
        .from('content_reports')
        .select('reporter_contact')
        .eq('id', report.id)
        .single();

      // Reporter contact should be encrypted
      expect(rawReport?.reporter_contact).not.toContain(
        'sensitive@example.com'
      );
    });

    it('should use secure hashing for content snapshots', async () => {
      const content = 'Test content for hashing';

      const hash = await moderationService.hashContent(content);

      expect(hash).toBeDefined();
      expect(hash.length).toBe(64); // SHA-256 hex = 64 chars
      expect(hash).not.toBe(content);
    });

    it('should protect API keys and secrets', async () => {
      const config = await moderationService.getConfiguration();

      expect(config.dsaApiKey).toBeUndefined(); // Should not expose secrets
      expect(config.databasePassword).toBeUndefined();
    });
  });

  describe('Session Management', () => {
    it('should invalidate sessions after timeout', async () => {
      const moderator = {
        id: 'mod-session-123',
        role: 'user',
        mod_role: 'moderator',
        sessionId: 'session-456',
      };

      // Claim report
      await moderationService.claimReport(
        'report-789',
        moderator.id,
        moderator
      );

      // Mock time passage (4 hours - session timeout)
      jest.useFakeTimers();
      jest.setSystemTime(new Date(Date.now() + 4 * 60 * 60 * 1000 + 1000));

      // Attempt to access with expired session
      await expect(
        moderationService.makeDecision(
          {
            reportId: 'report-789',
            moderatorId: moderator.id,
            action: 'remove',
            policyViolations: ['spam'],
            reasoning: 'Test',
          },
          moderator
        )
      ).rejects.toThrow(/session expired|unauthorized/i);

      jest.useRealTimers();
    });

    it('should release claimed reports on session expiry', async () => {
      const moderator = {
        id: 'mod-release-456',
        role: 'user',
        mod_role: 'moderator',
        sessionId: 'session-789',
      };

      await moderationService.claimReport(
        'report-release-123',
        moderator.id,
        moderator
      );

      // Mock session expiry
      jest.useFakeTimers();
      jest.setSystemTime(new Date(Date.now() + 4 * 60 * 60 * 1000 + 1000));

      // Run session cleanup
      await moderationService.cleanupExpiredSessions();

      // Report should be released
      const report =
        await moderationService.getReportDetails('report-release-123');

      expect(report.assignedModeratorId).toBeNull();
      expect(report.status).toBe('pending');

      jest.useRealTimers();
    });
  });
});
