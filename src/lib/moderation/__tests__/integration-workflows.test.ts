/**
 * End-to-End Integration Tests for Moderation Workflows
 * Tests complete workflows from report submission to resolution
 *
 * Requirements:
 * - Complete notice-and-action workflow (Art. 16 → Art. 17)
 * - Appeals workflow with human review (Art. 20)
 * - SoR submission to Transparency DB (Art. 24(5))
 * - Trusted flagger priority processing (Art. 22)
 * - Age-gating enforcement (Art. 28)
 */

import { supabase } from '@/lib/supabase';

// import { ReportingService } from '../../api/moderation/reporting-service';
import { AgeVerificationService } from '../age-verification-service';
import { AppealsService } from '../appeals-service';
import { AuditService } from '../audit-service';
import { DSATransparencyClient } from '../dsa-transparency-client';
import { GeoLocationService } from '../geo-location-service';
import { ModerationService } from '../moderation-service';

describe('End-to-End Integration Tests', () => {
  // let reportingService: ReportingService;
  let moderationService: ModerationService;
  let appealsService: AppealsService;
  let auditService: AuditService;
  let dsaClient: DSATransparencyClient;
  let ageVerificationService: AgeVerificationService;
  let geoLocationService: GeoLocationService;

  beforeEach(() => {
    auditService = new AuditService(supabase);
    // reportingService = new ReportingService(supabase, auditService);
    moderationService = new ModerationService(supabase, auditService);
    appealsService = new AppealsService(supabase, auditService);
    dsaClient = new DSATransparencyClient({
      apiUrl: 'https://transparency-api.ec.europa.eu',
      apiKey: 'test-key',
    });
    ageVerificationService = new AgeVerificationService(supabase);
    geoLocationService = new GeoLocationService(supabase);

    jest.clearAllMocks();
  });

  describe('Complete Notice-and-Action Workflow', () => {
    it('should process report from submission to decision with SoR', async () => {
      // Step 1: User submits report (Art. 16)
      const report = await reportingService.submitReport({
        contentId: 'post-123',
        reporterId: 'reporter-456',
        reportType: 'illegal',
        jurisdiction: 'DE',
        legalReference: 'DE StGB §86a',
        explanation:
          'This post contains hate speech promoting Nazi ideology, which is illegal under German law',
        contentLocator: 'https://growbro.app/community/posts/123',
        reporterContact: { email: 'reporter@example.com' },
        goodFaithDeclaration: true,
        contentHash: 'abc123hash',
      });

      expect(report.id).toBeDefined();
      expect(report.status).toBe('pending');
      expect(report.priority).toBeGreaterThan(0);

      // Step 2: Report appears in moderation queue
      const queue = await moderationService.getModeratorQueue('mod-789', {
        priority: 'high',
      });

      expect(queue.items).toContainEqual(
        expect.objectContaining({
          reportId: report.id,
          priority: expect.any(Number),
        })
      );

      // Step 3: Moderator claims report
      const claim = await moderationService.claimReport(report.id, 'mod-789');
      expect(claim.success).toBe(true);
      expect(claim.claimedBy).toBe('mod-789');

      // Step 4: Moderator makes decision
      const decision = await moderationService.makeDecision({
        reportId: report.id,
        moderatorId: 'mod-789',
        action: 'remove',
        policyViolations: ['illegal-hate-speech'],
        reasoning: 'Content violates German hate speech laws',
        evidence: [report.contentLocator],
      });

      expect(decision.id).toBeDefined();
      expect(decision.action).toBe('remove');

      // Step 5: Statement of Reasons generated (Art. 17)
      const sor = await moderationService.generateStatementOfReasons(decision);

      expect(sor).toMatchObject({
        decisionGround: 'illegal',
        legalReference: 'DE StGB §86a',
        contentType: 'post',
        factsAndCircumstances: expect.any(String),
        automatedDetection: false,
        automatedDecision: false,
        redress: expect.arrayContaining(['internal_appeal', 'ods', 'court']),
      });

      // Step 6: SoR submitted to Transparency DB (Art. 24(5))
      const mockSubmit = jest.spyOn(dsaClient, 'submitSoR').mockResolvedValue({
        success: true,
        transparencyDbId: 'ec-db-123',
      });

      await moderationService.submitSoRToTransparencyDB(sor);

      expect(mockSubmit).toHaveBeenCalled();
      expect(sor.transparencyDbId).toBe('ec-db-123');

      // Step 7: User notified with SoR
      const notification = await moderationService.notifyUser(
        report.contentAuthorId,
        {
          type: 'content_removed',
          decision,
          statementOfReasons: sor,
        }
      );

      expect(notification.sent).toBe(true);
      expect(notification.includesSoR).toBe(true);

      // Step 8: Verify audit trail
      const auditTrail = await auditService.queryAuditTrail({
        targetId: report.id,
        eventTypes: [
          'report_submitted',
          'report_claimed',
          'decision_made',
          'sor_generated',
          'sor_submitted',
          'user_notified',
        ],
      });

      expect(auditTrail.events).toHaveLength(6);
      expect(auditTrail.events.every((e) => e.signature)).toBe(true);
    });
  });

  describe('Appeals Workflow with Human Review', () => {
    it('should process appeal from submission to reversal', async () => {
      // Setup: Create initial decision
      const report = await reportingService.submitReport({
        contentId: 'post-456',
        reporterId: 'reporter-123',
        reportType: 'policy_violation',
        explanation: 'Spam content',
        contentLocator: 'https://growbro.app/community/posts/456',
        reporterContact: { email: 'reporter@example.com' },
        goodFaithDeclaration: true,
        contentHash: 'def456hash',
      });

      const decision = await moderationService.makeDecision({
        reportId: report.id,
        moderatorId: 'mod-111',
        action: 'remove',
        policyViolations: ['spam'],
        reasoning: 'Promotional spam',
      });

      // Step 1: User submits appeal (Art. 20)
      const appeal = await appealsService.submitAppeal({
        originalDecisionId: decision.id,
        userId: report.contentAuthorId,
        appealType: 'content_removal',
        counterArguments:
          'This is not spam, it is educational content about growing techniques',
        supportingEvidence: ['https://example.com/evidence/1'],
      });

      expect(appeal.id).toBeDefined();
      expect(appeal.status).toBe('pending');
      expect(appeal.deadline).toBeInstanceOf(Date);

      // Step 2: Appeal assigned to different reviewer (conflict-of-interest prevention)
      const reviewer = await appealsService.assignReviewer(appeal.id);

      expect(reviewer.reviewerId).not.toBe('mod-111'); // Not original moderator
      expect(reviewer.assigned).toBe(true);

      // Step 3: Reviewer processes appeal with human review
      const appealDecision = await appealsService.processAppealDecision({
        appealId: appeal.id,
        reviewerId: reviewer.reviewerId,
        decision: 'upheld',
        reasoning:
          'Upon review, content is educational and not spam. Original decision was incorrect.',
        humanReviewPerformed: true,
      });

      expect(appealDecision.decision).toBe('upheld');
      expect(appealDecision.humanReviewPerformed).toBe(true);

      // Step 4: Original decision reversed
      const reversal = await appealsService.reverseDecision(decision.id);

      expect(reversal.reversed).toBe(true);
      expect(reversal.contentRestored).toBe(true);

      // Step 5: User notified of appeal outcome
      const notification = await appealsService.notifyAppealOutcome(appeal.id);

      expect(notification.sent).toBe(true);
      expect(notification.outcome).toBe('upheld');

      // Step 6: Verify audit trail
      const auditTrail = await auditService.queryAuditTrail({
        targetId: appeal.id,
        eventTypes: [
          'appeal_submitted',
          'reviewer_assigned',
          'appeal_decision_made',
          'decision_reversed',
          'user_notified',
        ],
      });

      expect(auditTrail.events).toHaveLength(5);
    });

    it('should escalate to ODS when internal appeal exhausted', async () => {
      // Setup: Create and reject appeal
      const report = await reportingService.submitReport({
        contentId: 'post-789',
        reporterId: 'reporter-456',
        reportType: 'policy_violation',
        explanation: 'Inappropriate content',
        contentLocator: 'https://growbro.app/community/posts/789',
        reporterContact: { email: 'reporter@example.com' },
        goodFaithDeclaration: true,
        contentHash: 'ghi789hash',
      });

      const decision = await moderationService.makeDecision({
        reportId: report.id,
        moderatorId: 'mod-222',
        action: 'remove',
        policyViolations: ['inappropriate'],
        reasoning: 'Violates community guidelines',
      });

      const appeal = await appealsService.submitAppeal({
        originalDecisionId: decision.id,
        userId: report.contentAuthorId,
        appealType: 'content_removal',
        counterArguments: 'Content is appropriate',
        supportingEvidence: [],
      });

      await appealsService.processAppealDecision({
        appealId: appeal.id,
        reviewerId: 'reviewer-333',
        decision: 'rejected',
        reasoning: 'Content violates guidelines',
        humanReviewPerformed: true,
      });

      // Step 1: User escalates to ODS (Art. 21)
      const odsEscalation = await appealsService.escalateToODS(appeal.id, {
        odsBodyId: 'ods-body-eu-1',
        additionalEvidence: ['https://example.com/evidence/2'],
      });

      expect(odsEscalation.escalated).toBe(true);
      expect(odsEscalation.odsBodyId).toBe('ods-body-eu-1');
      expect(odsEscalation.targetResolutionDays).toBeLessThanOrEqual(90);

      // Step 2: Verify ODS case tracking
      const odsCase = await appealsService.getODSCase(odsEscalation.caseId);

      expect(odsCase).toMatchObject({
        appealId: appeal.id,
        odsBodyId: 'ods-body-eu-1',
        status: 'pending',
        submittedAt: expect.any(Date),
      });
    });
  });

  describe('Trusted Flagger Priority Processing', () => {
    it('should prioritize trusted flagger reports', async () => {
      // Step 1: Submit regular report
      const regularReport = await reportingService.submitReport({
        contentId: 'post-regular',
        reporterId: 'regular-user-123',
        reportType: 'policy_violation',
        explanation: 'Spam content',
        contentLocator: 'https://growbro.app/community/posts/regular',
        reporterContact: { email: 'regular@example.com' },
        goodFaithDeclaration: true,
        contentHash: 'regular-hash',
      });

      // Step 2: Submit trusted flagger report (Art. 22)
      const trustedReport = await reportingService.submitReport({
        contentId: 'post-trusted',
        reporterId: 'trusted-flagger-456',
        reportType: 'illegal',
        jurisdiction: 'DE',
        legalReference: 'DE StGB §184b',
        explanation: 'CSAM content detected',
        contentLocator: 'https://growbro.app/community/posts/trusted',
        reporterContact: { email: 'trusted@ngo.org' },
        goodFaithDeclaration: true,
        contentHash: 'trusted-hash',
        trustedFlagger: true,
      });

      // Step 3: Verify priority in queue
      const queue = await moderationService.getModeratorQueue('mod-444', {});

      const regularIndex = queue.items.findIndex(
        (item) => item.reportId === regularReport.id
      );
      const trustedIndex = queue.items.findIndex(
        (item) => item.reportId === trustedReport.id
      );

      expect(trustedIndex).toBeLessThan(regularIndex);
      expect(trustedReport.priority).toBeGreaterThan(regularReport.priority);

      // Step 4: Verify trusted flagger badge in UI
      const trustedReportDetails = await moderationService.getReportDetails(
        trustedReport.id
      );

      expect(trustedReportDetails.trustedFlagger).toBe(true);
      expect(trustedReportDetails.trustedFlaggerBadge).toBeDefined();
    });
  });

  describe('Age-Gating Enforcement Workflow', () => {
    it('should enforce age-gating for cannabis content', async () => {
      // Step 1: User posts age-restricted content
      const post = await createTestPost({
        userId: 'user-789',
        content: 'Check out my cannabis harvest! Great yield this season.',
        images: ['harvest-photo.jpg'],
      });

      // Step 2: Auto-flag content as age-restricted (Art. 28)
      const flagged = await ageVerificationService.autoFlagAgeRestrictedContent(
        post.id
      );

      expect(flagged.isAgeRestricted).toBe(true);
      expect(flagged.reason).toContain('cannabis');

      // Step 3: Unverified user attempts to view
      const unverifiedUserId = 'user-unverified-123';
      const accessCheck = await ageVerificationService.checkAgeGating(
        unverifiedUserId,
        post.id
      );

      expect(accessCheck.allowed).toBe(false);
      expect(accessCheck.reason).toBe('age_verification_required');
      expect(accessCheck.verificationUrl).toBeDefined();

      // Step 4: User completes age verification
      await ageVerificationService.verifyAgeAttribute(unverifiedUserId, {
        over18: true,
        verificationMethod: 'eudi_wallet',
        attributeHash: 'verified-hash',
      });

      expect(token.isValid).toBe(true);

      // Step 5: Verified user can now access content
      const verifiedAccessCheck = await ageVerificationService.checkAgeGating(
        unverifiedUserId,
        post.id
      );

      expect(verifiedAccessCheck.allowed).toBe(true);
      expect(verifiedAccessCheck.userVerified).toBe(true);
    });

    it('should apply safer defaults for minors', async () => {
      const minorUserId = 'user-minor-456';

      // Step 1: Attempt age verification (fails - under 18)
      await expect(
        ageVerificationService.verifyAgeAttribute(minorUserId, {
          over18: false,
          verificationMethod: 'eudi_wallet',
          attributeHash: 'minor-hash',
        })
      ).rejects.toThrow(/must be 18 or older/i);

      // Step 2: Verify safer defaults applied
      const feedAccess =
        await ageVerificationService.getFilteredFeed(minorUserId);

      expect(feedAccess.ageRestrictedContentFiltered).toBe(true);
      expect(feedAccess.saferDefaultsApplied).toBe(true);
      expect(feedAccess.noProfilingAds).toBe(true);
    });
  });

  describe('Geo-Restriction Workflow', () => {
    it('should apply geo-restrictions with SoR notification', async () => {
      const userId = 'user-geo-123';
      const contentId = 'post-geo-456';

      // Step 1: Content flagged for geo-restriction
      const geoRestriction = await geoLocationService.applyGeoRestriction(
        contentId,
        {
          restrictedRegions: ['FR', 'IT'],
          legalBasis: 'National law prohibition',
          includeInSoR: true,
        }
      );

      expect(geoRestriction.applied).toBe(true);
      expect(geoRestriction.restrictedRegions).toEqual(['FR', 'IT']);

      // Step 2: User in restricted region attempts access
      await geoLocationService.detectUserLocation(userId, {
        method: 'ip',
      });

      jest
        .spyOn(geoLocationService, 'detectUserLocation')
        .mockResolvedValue({ country: 'FR', method: 'ip' } as any);

      const accessCheck = await geoLocationService.checkContentAvailability(
        contentId,
        { country: 'FR' }
      );

      expect(accessCheck.available).toBe(false);
      expect(accessCheck.reason).toBe('geo_restricted');

      // Step 3: User receives geo-restriction notification with explanation
      const notification = await geoLocationService.notifyGeoRestriction(
        userId,
        contentId,
        {
          restrictedRegions: ['FR', 'IT'],
          explanation: 'Content restricted in your region due to local laws',
        }
      );

      expect(notification.sent).toBe(true);
      expect(notification.includesExplanation).toBe(true);
      expect(notification.includesAffectedRegions).toBe(true);

      // Step 4: User in allowed region can access
      jest
        .spyOn(geoLocationService, 'detectUserLocation')
        .mockResolvedValue({ country: 'DE', method: 'ip' } as any);

      const allowedAccessCheck =
        await geoLocationService.checkContentAvailability(contentId, {
          country: 'DE',
        });

      expect(allowedAccessCheck.available).toBe(true);
    });
  });

  describe('SLA Compliance Workflow', () => {
    it('should escalate reports approaching SLA deadline', async () => {
      // Step 1: Submit high-priority report
      const report = await reportingService.submitReport({
        contentId: 'post-sla-123',
        reporterId: 'reporter-789',
        reportType: 'illegal',
        jurisdiction: 'DE',
        legalReference: 'DE StGB §131',
        explanation: 'Violent content',
        contentLocator: 'https://growbro.app/community/posts/sla-123',
        reporterContact: { email: 'reporter@example.com' },
        goodFaithDeclaration: true,
        contentHash: 'sla-hash',
      });

      // Step 2: Mock time passage (18 hours of 24-hour SLA)
      jest.useFakeTimers();
      jest.setSystemTime(new Date(Date.now() + 18 * 60 * 60 * 1000));

      // Step 3: SLA monitor detects approaching deadline
      const slaCheck = await moderationService.checkSLACompliance(report.id);

      expect(slaCheck.percentageElapsed).toBeGreaterThan(75);
      expect(slaCheck.alertLevel).toBe('warning');

      // Step 4: Escalation alert sent
      const escalation = await moderationService.escalateSLABreach(report.id);

      expect(escalation.escalated).toBe(true);
      expect(escalation.notifiedSupervisors).toContain('supervisor-123');

      jest.useRealTimers();
    });
  });
});

// Helper function to create test post
async function createTestPost(data: {
  userId: string;
  content: string;
  images?: string[];
}) {
  const { data: post } = await supabase
    .from('posts')
    .insert({
      user_id: data.userId,
      content: data.content,
      images: data.images || [],
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  return post;
}
