import { database } from '@/lib/watermelon';
import type { AssessmentModel } from '@/lib/watermelon-models/assessment';
import type { AssessmentFeedbackModel } from '@/lib/watermelon-models/assessment-feedback';

import { getPerClassMetrics } from './assessment-analytics';

// Mock the database
jest.mock('@/lib/watermelon', () => ({
  database: {
    get: jest.fn(),
  },
}));

const mockDatabase = database as jest.Mocked<typeof database>;

describe('AssessmentAnalytics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getPerClassMetrics', () => {
    test('aggregates metrics correctly with multiple feedbacks per assessment', async () => {
      const mockAssessments: AssessmentModel[] = [
        {
          id: '1',
          status: 'completed',
          predictedClass: 'class1',
          calibratedConfidence: 0.8,
          inferenceMode: 'device',
          latencyMs: 100,
          modelVersion: 'v1',
        } as AssessmentModel,
        {
          id: '2',
          status: 'completed',
          predictedClass: 'class1',
          calibratedConfidence: 0.9,
          inferenceMode: 'cloud',
          latencyMs: 200,
          modelVersion: 'v1',
        } as AssessmentModel,
      ];

      const mockFeedbacks: AssessmentFeedbackModel[] = [
        {
          assessmentId: '1',
          helpful: true,
          issueResolved: 'yes',
        } as AssessmentFeedbackModel,
        {
          assessmentId: '1',
          helpful: false,
          issueResolved: 'no',
        } as AssessmentFeedbackModel, // Multiple feedbacks for same assessment
        {
          assessmentId: '2',
          helpful: true,
          issueResolved: 'yes',
        } as AssessmentFeedbackModel,
      ];

      const mockAssessmentCollection = {
        query: jest.fn().mockReturnThis(),
        fetch: jest.fn().mockResolvedValue(mockAssessments),
      };

      const mockFeedbackCollection = {
        query: jest.fn().mockReturnThis(),
        fetch: jest.fn().mockResolvedValue(mockFeedbacks),
      };

      mockDatabase.get
        .mockImplementationOnce(() => mockAssessmentCollection as any)
        .mockImplementationOnce(() => mockFeedbackCollection as any);

      const result = await getPerClassMetrics();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        classId: 'class1',
        totalAssessments: 2,
        avgConfidence: 0.85,
        helpfulCount: 2, // Both feedbacks for assessment 1, one for 2
        notHelpfulCount: 1,
        resolvedCount: 2,
        notResolvedCount: 1,
        helpfulnessRate: 2 / 3, // 2 helpful out of 3 feedbacks
        resolutionRate: 2 / 3,
      });
    });

    test('handles no feedbacks', async () => {
      const mockAssessments: AssessmentModel[] = [
        {
          id: '1',
          status: 'completed',
          predictedClass: 'class1',
          calibratedConfidence: 0.8,
        } as AssessmentModel,
      ];

      const mockAssessmentCollection = {
        query: jest.fn().mockReturnThis(),
        fetch: jest.fn().mockResolvedValue(mockAssessments),
      };

      const mockFeedbackCollection = {
        query: jest.fn().mockReturnThis(),
        fetch: jest.fn().mockResolvedValue([]),
      };

      mockDatabase.get
        .mockImplementationOnce(() => mockAssessmentCollection as any)
        .mockImplementationOnce(() => mockFeedbackCollection as any);

      const result = await getPerClassMetrics();

      expect(result[0].helpfulnessRate).toBe(0);
      expect(result[0].resolutionRate).toBe(0);
    });
  });

  // Add more tests for other functions as needed, but focus on the changed logic
});
