import { database } from '@/lib/watermelon';
import type { AssessmentFeedbackModel } from '@/lib/watermelon-models/assessment-feedback';

import * as feedbackService from '../assessment-feedback-service';
import * as sentryModule from '../assessment-sentry';
import * as telemetryService from '../assessment-telemetry-service';

// Mock dependencies
jest.mock('../assessment-sentry');
jest.mock('../assessment-telemetry-service');

// Track assessment IDs created by these tests so cleanup is scoped and safe
const CREATED_ASSESSMENT_IDS = new Set<string>();

describe('AssessmentFeedbackService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('submitFeedback', () => {
    it('should create feedback record with all fields', async () => {
      const options = {
        assessmentId: 'test-assessment-1',
        helpful: true,
        issueResolved: 'yes' as const,
        notes: 'Great advice, issue resolved!',
      };

      const feedback = await feedbackService.submitFeedback(options);
      CREATED_ASSESSMENT_IDS.add(options.assessmentId);

      expect(feedback).toBeDefined();
      expect(feedback.assessmentId).toBe(options.assessmentId);
      expect(feedback.helpful).toBe(true);
      expect(feedback.issueResolved).toBe('yes');
      expect(feedback.notes).toBe(options.notes);

      // Verify telemetry was logged
      expect(telemetryService.logFeedbackSubmitted).toHaveBeenCalledWith({
        assessmentId: options.assessmentId,
        helpful: options.helpful,
        issueResolved: options.issueResolved,
      });

      // Verify Sentry breadcrumb was added
      expect(sentryModule.addFeedbackBreadcrumb).toHaveBeenCalledWith({
        assessmentId: options.assessmentId,
        helpful: options.helpful,
        issueResolved: options.issueResolved,
      });
    });

    it('should create feedback without optional fields', async () => {
      const options = {
        assessmentId: 'test-assessment-2',
        helpful: false,
      };

      const feedback = await feedbackService.submitFeedback(options);
      CREATED_ASSESSMENT_IDS.add(options.assessmentId);

      expect(feedback).toBeDefined();
      expect(feedback.assessmentId).toBe(options.assessmentId);
      expect(feedback.helpful).toBe(false);
      expect(feedback.issueResolved).toBeNull();
      expect(feedback.notes).toBeNull();
    });

    it('should truncate notes to 500 characters', async () => {
      const longNotes = 'a'.repeat(600);
      const options = {
        assessmentId: 'test-assessment-3',
        helpful: true,
        notes: longNotes,
      };

      const feedback = await feedbackService.submitFeedback(options);
      CREATED_ASSESSMENT_IDS.add(options.assessmentId);

      expect(feedback.notes?.length).toBe(500);
    });

    it('should trim whitespace from notes', async () => {
      const options = {
        assessmentId: 'test-assessment-4',
        helpful: true,
        notes: '  Test notes with spaces  ',
      };

      const feedback = await feedbackService.submitFeedback(options);
      CREATED_ASSESSMENT_IDS.add(options.assessmentId);

      expect(feedback.notes).toBe('Test notes with spaces');
    });
  });

  describe('getAssessmentFeedback', () => {
    it('should return feedback for existing assessment', async () => {
      // Create feedback first
      await feedbackService.submitFeedback({
        assessmentId: 'test-assessment-5',
        helpful: true,
        issueResolved: 'yes',
      });
      CREATED_ASSESSMENT_IDS.add('test-assessment-5');

      const feedback =
        await feedbackService.getAssessmentFeedback('test-assessment-5');

      expect(feedback).not.toBeNull();
      expect(feedback?.assessmentId).toBe('test-assessment-5');
    });

    it('should return null for non-existent assessment', async () => {
      const feedback =
        await feedbackService.getAssessmentFeedback('non-existent-id');

      expect(feedback).toBeNull();
    });
  });

  describe('hasAssessmentFeedback', () => {
    it('should return true when feedback exists', async () => {
      await feedbackService.submitFeedback({
        assessmentId: 'test-assessment-6',
        helpful: true,
      });
      CREATED_ASSESSMENT_IDS.add('test-assessment-6');

      const hasFeedback =
        await feedbackService.hasAssessmentFeedback('test-assessment-6');

      expect(hasFeedback).toBe(true);
    });

    it('should return false when feedback does not exist', async () => {
      const hasFeedback =
        await feedbackService.hasAssessmentFeedback('non-existent-id');

      expect(hasFeedback).toBe(false);
    });
  });

  describe('getFeedbackStats', () => {
    beforeEach(async () => {
      // Create test feedback data
      await feedbackService.submitFeedback({
        assessmentId: 'stats-1',
        helpful: true,
        issueResolved: 'yes',
      });
      CREATED_ASSESSMENT_IDS.add('stats-1');
      await feedbackService.submitFeedback({
        assessmentId: 'stats-2',
        helpful: true,
        issueResolved: 'no',
      });
      CREATED_ASSESSMENT_IDS.add('stats-2');
      await feedbackService.submitFeedback({
        assessmentId: 'stats-3',
        helpful: false,
        issueResolved: 'too_early',
      });
      CREATED_ASSESSMENT_IDS.add('stats-3');
      await feedbackService.submitFeedback({
        assessmentId: 'stats-4',
        helpful: true,
      });
      CREATED_ASSESSMENT_IDS.add('stats-4');
    });

    it('should calculate correct feedback statistics', async () => {
      const stats = await feedbackService.getFeedbackStats();

      expect(stats.total).toBeGreaterThanOrEqual(4);
      expect(stats.helpful).toBeGreaterThanOrEqual(3);
      expect(stats.notHelpful).toBeGreaterThanOrEqual(1);
      expect(stats.resolved).toBeGreaterThanOrEqual(1);
      expect(stats.notResolved).toBeGreaterThanOrEqual(1);
      expect(stats.tooEarly).toBeGreaterThanOrEqual(1);
    });
  });

  afterAll(async () => {
    const { Q } = await import('@nozbe/watermelondb');
    await database.write(async () => {
      const toDelete = await database
        .get<AssessmentFeedbackModel>('assessment_feedback')
        .query(
          Q.where('assessment_id', Q.oneOf(Array.from(CREATED_ASSESSMENT_IDS)))
        )
        .fetch();
      for (const feedback of toDelete) {
        await feedback.destroyPermanently();
      }
    });
  });
});
