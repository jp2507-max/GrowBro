import { database } from '@/lib/watermelon';
import type { AssessmentFeedbackModel } from '@/lib/watermelon-models/assessment-feedback';

import * as feedbackService from '../assessment-feedback-service';
import * as sentryModule from '../assessment-sentry';
import * as telemetryService from '../assessment-telemetry-service';

// Mock dependencies
jest.mock('../assessment-sentry');
jest.mock('../assessment-telemetry-service');

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

      expect(feedback).toBeDefined();
      expect(feedback.assessmentId).toBe(options.assessmentId);
      expect(feedback.helpful).toBe(false);
      expect(feedback.issueResolved).toBeUndefined();
      expect(feedback.notes).toBeUndefined();
    });

    it('should truncate notes to 500 characters', async () => {
      const longNotes = 'a'.repeat(600);
      const options = {
        assessmentId: 'test-assessment-3',
        helpful: true,
        notes: longNotes,
      };

      const feedback = await feedbackService.submitFeedback(options);

      expect(feedback.notes?.length).toBe(500);
    });

    it('should trim whitespace from notes', async () => {
      const options = {
        assessmentId: 'test-assessment-4',
        helpful: true,
        notes: '  Test notes with spaces  ',
      };

      const feedback = await feedbackService.submitFeedback(options);

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
      await feedbackService.submitFeedback({
        assessmentId: 'stats-2',
        helpful: true,
        issueResolved: 'no',
      });
      await feedbackService.submitFeedback({
        assessmentId: 'stats-3',
        helpful: false,
        issueResolved: 'too_early',
      });
      await feedbackService.submitFeedback({
        assessmentId: 'stats-4',
        helpful: true,
      });
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
    // Clean up test data
    const allFeedback = await database
      .get<AssessmentFeedbackModel>('assessment_feedback')
      .query()
      .fetch();

    await database.write(async () => {
      for (const feedback of allFeedback) {
        await feedback.destroyPermanently();
      }
    });
  });
});
