// @ts-nocheck
/**
 * Misuse Detection Tests (DSA Art. 23)
 * Tests repeat infringer detection, graduated enforcement, and manifestly unfounded reporter tracking
 *
 * Requirements:
 * - Requirement 12.1: Track violation patterns and escalate enforcement
 * - Requirement 12.2: Apply graduated measures with clear thresholds
 * - Requirement 12.3: Log all actions with immutable audit trails
 * - Requirement 12.4: Provide appeal paths for repeat offender status
 * - Art. 23: Measures against misuse
 */

import { AuditService } from '../audit-service';
import { ModerationService } from '../moderation-service';
import { RepeatOffenderService } from '../repeat-offender-service';

describe('Repeat Infringer Detection (Art. 23)', () => {
  let repeatOffenderService: RepeatOffenderService;
  let moderationService: ModerationService;
  let auditService: AuditService;

  beforeEach(() => {
    auditService = new AuditService({} as any);
    repeatOffenderService = new RepeatOffenderService({} as any, auditService);
    moderationService = new ModerationService(
      {} as any,
      auditService,
      repeatOffenderService
    );

    jest.clearAllMocks();
  });

  describe('Violation Tracking', () => {
    it('should track multiple violations by user', async () => {
      const userId = 'user-repeat-123';

      // Record 3 violations
      await repeatOffenderService.recordViolation(userId, 'hate_speech');
      await repeatOffenderService.recordViolation(userId, 'hate_speech');
      await repeatOffenderService.recordViolation(userId, 'harassment');

      const record =
        await repeatOffenderService.getRepeatOffenderRecord(userId);

      expect(record.violationCount).toBe(3);
      expect(record.violationsByType).toMatchObject({
        hate_speech: 2,
        harassment: 1,
      });
    });

    it('should distinguish between different violation types', async () => {
      const userId = 'user-multi-violation';

      await repeatOffenderService.recordViolation(userId, 'spam');
      await repeatOffenderService.recordViolation(userId, 'misinformation');
      await repeatOffenderService.recordViolation(userId, 'spam');

      const record =
        await repeatOffenderService.getRepeatOffenderRecord(userId);

      expect(record.violationsByType.spam).toBe(2);
      expect(record.violationsByType.misinformation).toBe(1);
    });

    it('should track violation timestamps for pattern analysis', async () => {
      const userId = 'user-pattern-123';

      const violation1 = await repeatOffenderService.recordViolation(
        userId,
        'hate_speech'
      );
      await new Promise((resolve) => setTimeout(resolve, 100));
      const violation2 = await repeatOffenderService.recordViolation(
        userId,
        'hate_speech'
      );

      expect(violation2.timestamp.getTime()).toBeGreaterThan(
        violation1.timestamp.getTime()
      );
    });
  });

  describe('Graduated Enforcement (Requirement 12.2)', () => {
    it('should escalate from warning to temporary suspension', async () => {
      const userId = 'user-escalation-123';

      // First violation: warning
      await repeatOffenderService.recordViolation(userId, 'spam');
      let record = await repeatOffenderService.getRepeatOffenderRecord(userId);
      expect(record.escalationLevel).toBe('warning');

      // Second violation: still warning
      await repeatOffenderService.recordViolation(userId, 'spam');
      record = await repeatOffenderService.getRepeatOffenderRecord(userId);
      expect(record.escalationLevel).toBe('warning');

      // Third violation: temporary suspension
      await repeatOffenderService.recordViolation(userId, 'spam');
      record = await repeatOffenderService.getRepeatOffenderRecord(userId);
      expect(record.escalationLevel).toBe('temporary_suspension');
      expect(record.suspensionHistory).toHaveLength(1);
    });

    it('should escalate to permanent ban after multiple suspensions', async () => {
      const userId = 'user-permanent-ban';

      // Simulate 6 violations to trigger permanent ban
      for (let i = 0; i < 6; i++) {
        await repeatOffenderService.recordViolation(userId, 'hate_speech');
      }

      const record =
        await repeatOffenderService.getRepeatOffenderRecord(userId);

      expect(record.escalationLevel).toBe('permanent_ban');
      expect(record.status).toBe('banned');
    });

    it('should apply different thresholds for severe violations', async () => {
      const userId = 'user-severe-violation';

      // Severe violations (e.g., CSAM, terrorism) should escalate faster
      await repeatOffenderService.recordViolation(userId, 'csam');

      const record =
        await repeatOffenderService.getRepeatOffenderRecord(userId);

      // Should immediately suspend for severe violations
      expect(record.escalationLevel).toBe('temporary_suspension');
    });

    it('should include suspension duration in enforcement action', async () => {
      const userId = 'user-suspension-duration';

      // Trigger temporary suspension
      for (let i = 0; i < 3; i++) {
        await repeatOffenderService.recordViolation(userId, 'spam');
      }

      const record =
        await repeatOffenderService.getRepeatOffenderRecord(userId);
      const latestSuspension =
        record.suspensionHistory[record.suspensionHistory.length - 1];

      expect(latestSuspension.duration).toBeDefined();
      expect(latestSuspension.expiresAt).toBeInstanceOf(Date);
      expect(latestSuspension.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('Manifestly Unfounded Reporter Tracking', () => {
    it('should track false reports by reporter', async () => {
      const reporterId = 'reporter-false-123';

      // Submit 5 false reports
      for (let i = 0; i < 5; i++) {
        const report = await moderationService.submitReport({
          contentId: `content-${i}`,
          reporterId,
          reportType: 'policy_violation',
          explanation: 'False claim',
          contentLocator: `https://example.com/content/${i}`,
          reporterContact: { email: 'reporter@example.com' },
          goodFaithDeclaration: true,
          contentHash: `hash-${i}`,
        });

        // Moderator marks as manifestly unfounded
        await moderationService.makeDecision({
          reportId: report.id,
          moderatorId: 'mod-123',
          action: 'no_action',
          reasoning: 'Manifestly unfounded - no policy violation',
          policyViolations: [],
          manifestlyUnfounded: true,
        });
      }

      const reporterStatus =
        await repeatOffenderService.getReporterStatus(reporterId);

      expect(reporterStatus.manifestlyUnfoundedCount).toBe(5);
    });

    it('should suspend reporter after threshold of false reports', async () => {
      const reporterId = 'reporter-suspend-456';

      // Submit 10 false reports (threshold)
      for (let i = 0; i < 10; i++) {
        const report = await moderationService.submitReport({
          contentId: `content-${i}`,
          reporterId,
          reportType: 'policy_violation',
          explanation: 'False claim',
          contentLocator: `https://example.com/content/${i}`,
          reporterContact: { email: 'reporter@example.com' },
          goodFaithDeclaration: true,
          contentHash: `hash-${i}`,
        });

        await moderationService.makeDecision({
          reportId: report.id,
          moderatorId: 'mod-123',
          action: 'no_action',
          reasoning: 'Manifestly unfounded',
          policyViolations: [],
          manifestlyUnfounded: true,
        });
      }

      const reporterStatus =
        await repeatOffenderService.getReporterStatus(reporterId);

      expect(reporterStatus.status).toBe('suspended');
      expect(reporterStatus.suspensionReason).toContain('manifestly unfounded');
    });

    it('should calculate false report rate', async () => {
      const reporterId = 'reporter-rate-789';

      // Submit 10 reports: 3 valid, 7 false
      for (let i = 0; i < 10; i++) {
        const report = await moderationService.submitReport({
          contentId: `content-${i}`,
          reporterId,
          reportType: 'policy_violation',
          explanation: i < 3 ? 'Valid violation' : 'False claim',
          contentLocator: `https://example.com/content/${i}`,
          reporterContact: { email: 'reporter@example.com' },
          goodFaithDeclaration: true,
          contentHash: `hash-${i}`,
        });

        await moderationService.makeDecision({
          reportId: report.id,
          moderatorId: 'mod-123',
          action: i < 3 ? 'remove' : 'no_action',
          reasoning: i < 3 ? 'Valid violation' : 'Manifestly unfounded',
          policyViolations: i < 3 ? ['spam'] : [],
          manifestlyUnfounded: i >= 3,
        });
      }

      const reporterStatus =
        await repeatOffenderService.getReporterStatus(reporterId);

      expect(reporterStatus.totalReports).toBe(10);
      expect(reporterStatus.manifestlyUnfoundedCount).toBe(7);
      expect(reporterStatus.falseReportRate).toBeCloseTo(0.7, 2);
    });
  });

  describe('Audit Trail (Requirement 12.3)', () => {
    it('should log all enforcement actions with immutable audit trail', async () => {
      const userId = 'user-audit-123';
      const auditLogSpy = jest.spyOn(auditService, 'logEvent');

      await repeatOffenderService.recordViolation(userId, 'hate_speech');

      expect(auditLogSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'repeat_offender_violation_recorded',
          actorId: expect.any(String),
          targetId: userId,
          metadata: expect.objectContaining({
            violationType: 'hate_speech',
            violationCount: expect.any(Number),
          }),
        })
      );
    });

    it('should log escalation actions with reason codes', async () => {
      const userId = 'user-escalation-audit';
      const auditLogSpy = jest.spyOn(auditService, 'logEvent');

      // Trigger escalation
      for (let i = 0; i < 3; i++) {
        await repeatOffenderService.recordViolation(userId, 'spam');
      }

      expect(auditLogSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'repeat_offender_escalation',
          metadata: expect.objectContaining({
            escalationLevel: 'temporary_suspension',
            reasonCode: expect.any(String),
          }),
        })
      );
    });

    it('should include evidence links in audit trail', async () => {
      const userId = 'user-evidence-audit';
      const auditLogSpy = jest.spyOn(auditService, 'logEvent');

      await repeatOffenderService.recordViolation(userId, 'hate_speech', {
        evidenceUrls: ['https://example.com/evidence/1'],
        decisionId: 'decision-123',
      });

      expect(auditLogSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            evidenceUrls: expect.arrayContaining([
              'https://example.com/evidence/1',
            ]),
            decisionId: 'decision-123',
          }),
        })
      );
    });
  });

  describe('Appeal Paths (Requirement 12.4)', () => {
    it('should allow users to appeal repeat offender status', async () => {
      const userId = 'user-appeal-status';

      // Trigger suspension
      for (let i = 0; i < 3; i++) {
        await repeatOffenderService.recordViolation(userId, 'spam');
      }

      const record =
        await repeatOffenderService.getRepeatOffenderRecord(userId);
      expect(record.status).toBe('suspended');

      // Submit appeal
      const appeal = await repeatOffenderService.submitStatusAppeal(userId, {
        reason: 'Violations were mistakes, I have learned the rules',
        evidence: ['https://example.com/evidence/reform'],
      });

      expect(appeal.appealType).toBe('repeat_offender_status');
      expect(appeal.status).toBe('pending');
      expect(appeal.userId).toBe(userId);
    });

    it('should restore account status when appeal is upheld', async () => {
      const userId = 'user-appeal-upheld';

      // Trigger suspension
      for (let i = 0; i < 3; i++) {
        await repeatOffenderService.recordViolation(userId, 'spam');
      }

      // Submit and uphold appeal
      const appeal = await repeatOffenderService.submitStatusAppeal(userId, {
        reason: 'False positives',
        evidence: [],
      });

      await repeatOffenderService.processAppeal(appeal.id, {
        decision: 'upheld',
        reviewerId: 'reviewer-123',
        reasoning: 'Evidence shows false positives',
      });

      const record =
        await repeatOffenderService.getRepeatOffenderRecord(userId);
      expect(record.status).toBe('active');
      expect(record.escalationLevel).toBe('warning'); // Reset to lower level
    });

    it('should maintain suspension when appeal is rejected', async () => {
      const userId = 'user-appeal-rejected';

      // Trigger suspension
      for (let i = 0; i < 3; i++) {
        await repeatOffenderService.recordViolation(userId, 'hate_speech');
      }

      // Submit and reject appeal
      const appeal = await repeatOffenderService.submitStatusAppeal(userId, {
        reason: 'I disagree with the violations',
        evidence: [],
      });

      await repeatOffenderService.processAppeal(appeal.id, {
        decision: 'rejected',
        reviewerId: 'reviewer-456',
        reasoning: 'Violations were correctly identified',
      });

      const record =
        await repeatOffenderService.getRepeatOffenderRecord(userId);
      expect(record.status).toBe('suspended');
    });
  });

  describe('Pattern Detection', () => {
    it('should detect rapid violation patterns', async () => {
      const userId = 'user-rapid-pattern';

      // Record 5 violations within 1 hour
      const startTime = Date.now();
      for (let i = 0; i < 5; i++) {
        await repeatOffenderService.recordViolation(userId, 'spam', {
          timestamp: new Date(startTime + i * 10 * 60 * 1000), // 10 min apart
        });
      }

      const pattern =
        await repeatOffenderService.detectViolationPattern(userId);

      expect(pattern.isRapid).toBe(true);
      expect(pattern.violationsPerHour).toBeGreaterThan(4);
      expect(pattern.riskLevel).toBe('high');
    });

    it('should detect cross-category violation patterns', async () => {
      const userId = 'user-cross-category';

      await repeatOffenderService.recordViolation(userId, 'hate_speech');
      await repeatOffenderService.recordViolation(userId, 'harassment');
      await repeatOffenderService.recordViolation(userId, 'threats');

      const pattern =
        await repeatOffenderService.detectViolationPattern(userId);

      expect(pattern.isCrossCategory).toBe(true);
      expect(pattern.uniqueViolationTypes).toBe(3);
      expect(pattern.riskLevel).toBe('high');
    });
  });

  describe('Severity-Based Thresholds', () => {
    it('should apply stricter thresholds for severe violations', async () => {
      const userId = 'user-severe-threshold';

      // Single CSAM violation should trigger immediate action
      await repeatOffenderService.recordViolation(userId, 'csam');

      const record =
        await repeatOffenderService.getRepeatOffenderRecord(userId);

      expect(record.escalationLevel).toBe('permanent_ban');
      expect(record.status).toBe('banned');
    });

    it('should apply lenient thresholds for minor violations', async () => {
      const userId = 'user-minor-threshold';

      // Multiple minor violations before escalation
      for (let i = 0; i < 5; i++) {
        await repeatOffenderService.recordViolation(userId, 'off_topic');
      }

      const record =
        await repeatOffenderService.getRepeatOffenderRecord(userId);

      expect(record.escalationLevel).toBe('warning');
      expect(record.status).toBe('active');
    });
  });
});
