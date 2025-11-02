import { database } from '@/lib/watermelon';
import type { AssessmentModel } from '@/lib/watermelon-models/assessment';
import type { AssessmentFeedbackModel } from '@/lib/watermelon-models/assessment-feedback';
import type { AssessmentTelemetryModel } from '@/lib/watermelon-models/assessment-telemetry';

import { getPerClassMetrics } from './assessment-analytics';
import {
  getExecutionProviderDistribution,
  getModelVersionDistribution,
} from './assessment-analytics-distribution';

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
      const mockAssessments: Partial<AssessmentModel>[] = [
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
        extend: jest.fn().mockReturnThis(),
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
      const mockAssessments: Partial<AssessmentModel>[] = [
        {
          id: '1',
          status: 'completed',
          predictedClass: 'class1',
          calibratedConfidence: 0.8,
        } as AssessmentModel,
      ];

      const mockAssessmentCollection = {
        query: jest.fn().mockReturnThis(),
        extend: jest.fn().mockReturnThis(),
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

    test('applies date range filtering to assessments', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const mockAssessments: Partial<AssessmentModel>[] = [
        {
          id: '1',
          status: 'completed',
          predictedClass: 'class1',
          calibratedConfidence: 0.8,
          createdAt: new Date('2024-01-15'),
        } as AssessmentModel,
        {
          id: '2',
          status: 'completed',
          predictedClass: 'class1',
          calibratedConfidence: 0.9,
          createdAt: new Date('2024-02-01'), // Outside date range
        } as AssessmentModel,
      ];

      const mockAssessmentCollection = {
        query: jest.fn().mockReturnThis(),
        extend: jest.fn().mockReturnThis(),
        fetch: jest.fn().mockResolvedValue([mockAssessments[0]]), // Only first assessment returned
      };

      const mockFeedbackCollection = {
        query: jest.fn().mockReturnThis(),
        fetch: jest.fn().mockResolvedValue([]),
      };

      mockDatabase.get
        .mockImplementationOnce(() => mockAssessmentCollection as any)
        .mockImplementationOnce(() => mockFeedbackCollection as any);

      const result = await getPerClassMetrics({ startDate, endDate });

      expect(result).toHaveLength(1);
      expect(result[0].totalAssessments).toBe(1);
      expect(mockAssessmentCollection.query).toHaveBeenCalledWith(
        expect.any(Object), // status filter
        expect.objectContaining({
          type: 'where',
          left: 'created_at',
          op: 'gte',
          right: startDate.getTime(),
        }),
        expect.objectContaining({
          type: 'where',
          left: 'created_at',
          op: 'lte',
          right: endDate.getTime(),
        })
      );
    });

    test('applies pagination limits', async () => {
      const mockAssessments: Partial<AssessmentModel>[] = [
        {
          id: '1',
          status: 'completed',
          predictedClass: 'class1',
          calibratedConfidence: 0.8,
        } as AssessmentModel,
      ];

      const mockAssessmentCollection = {
        query: jest.fn().mockReturnThis(),
        extend: jest.fn().mockReturnThis(),
        fetch: jest.fn().mockResolvedValue(mockAssessments),
      };

      const mockFeedbackCollection = {
        query: jest.fn().mockReturnThis(),
        fetch: jest.fn().mockResolvedValue([]),
      };

      mockDatabase.get
        .mockImplementationOnce(() => mockAssessmentCollection as any)
        .mockImplementationOnce(() => mockFeedbackCollection as any);

      await getPerClassMetrics({ limit: 50, offset: 10 });

      expect(mockAssessmentCollection.extend).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'take', n: 50 }),
        expect.objectContaining({ type: 'skip', n: 10 })
      );
    });

    test('enforces maximum limit cap', async () => {
      const mockAssessments: Partial<AssessmentModel>[] = [];

      const mockAssessmentCollection = {
        query: jest.fn().mockReturnThis(),
        extend: jest.fn().mockReturnThis(),
        fetch: jest.fn().mockResolvedValue(mockAssessments),
      };

      const mockFeedbackCollection = {
        query: jest.fn().mockReturnThis(),
        fetch: jest.fn().mockResolvedValue([]),
      };

      mockDatabase.get
        .mockImplementationOnce(() => mockAssessmentCollection as any)
        .mockImplementationOnce(() => mockFeedbackCollection as any);

      await getPerClassMetrics({ limit: 5000 }); // Exceeds max limit

      expect(mockAssessmentCollection.extend).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'take', n: 1000 }), // Should be capped at MAX_LIMIT
        expect.any(Object)
      );
    });

    test('filters feedback by assessment IDs and date range', async () => {
      const startDate = new Date('2024-01-01');
      const mockAssessments: Partial<AssessmentModel>[] = [
        {
          id: '1',
          status: 'completed',
          predictedClass: 'class1',
          calibratedConfidence: 0.8,
        } as AssessmentModel,
      ];

      const mockFeedbacks: AssessmentFeedbackModel[] = [
        {
          id: 'f1',
          assessmentId: '1',
          helpful: true,
          issueResolved: 'yes',
          createdAt: new Date('2024-01-15'),
        } as AssessmentFeedbackModel,
      ];

      const mockAssessmentCollection = {
        query: jest.fn().mockReturnThis(),
        extend: jest.fn().mockReturnThis(),
        fetch: jest.fn().mockResolvedValue(mockAssessments),
      };

      const mockFeedbackCollection = {
        query: jest.fn().mockReturnThis(),
        fetch: jest.fn().mockResolvedValue(mockFeedbacks),
      };

      mockDatabase.get
        .mockImplementationOnce(() => mockAssessmentCollection as any)
        .mockImplementationOnce(() => mockFeedbackCollection as any);

      await getPerClassMetrics({ startDate });

      expect(mockFeedbackCollection.query).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'where',
          left: 'assessment_id',
          op: 'oneOf',
          right: ['1'],
        }),
        expect.objectContaining({
          type: 'where',
          left: 'created_at',
          op: 'gte',
          right: startDate.getTime(),
        })
      );
    });
  });

  describe('getModelVersionDistribution', () => {
    test('returns version distribution for all completed assessments', async () => {
      const mockAssessments: Partial<AssessmentModel>[] = [
        {
          id: '1',
          status: 'completed',
          modelVersion: 'v1.0',
        } as AssessmentModel,
        {
          id: '2',
          status: 'completed',
          modelVersion: 'v1.0',
        } as AssessmentModel,
        {
          id: '3',
          status: 'completed',
          modelVersion: 'v2.0',
        } as AssessmentModel,
        {
          id: '4',
          status: 'completed',
          modelVersion: undefined, // Should be counted as 'unknown'
        } as Partial<AssessmentModel>,
      ];

      const mockCollection = {
        query: jest.fn().mockReturnThis(),
        extend: jest.fn().mockReturnThis(),
        fetch: jest.fn().mockResolvedValue(mockAssessments),
      };

      mockDatabase.get.mockReturnValue(mockCollection as any);

      const result = await getModelVersionDistribution();

      expect(result).toEqual({
        'v1.0': 2,
        'v2.0': 1,
        unknown: 1,
      });
      expect(mockCollection.query).toHaveBeenCalledWith(
        { key: 'status', value: 'completed' },
        { $sortBy: { direction: 'desc', key: 'created_at' } }
      );
    });

    test('applies limit when specified', async () => {
      const mockAssessments: Partial<AssessmentModel>[] = [
        {
          id: '1',
          status: 'completed',
          modelVersion: 'v1.0',
          created_at: 1000,
        } as Partial<AssessmentModel>,
        {
          id: '2',
          status: 'completed',
          modelVersion: 'v2.0',
          created_at: 2000,
        } as Partial<AssessmentModel>,
      ];

      const mockCollection = {
        query: jest.fn().mockReturnThis(),
        extend: jest.fn().mockReturnThis(),
        fetch: jest.fn().mockResolvedValue([mockAssessments[0]]), // Only first due to limit
      };

      mockDatabase.get.mockReturnValue(mockCollection as any);

      const result = await getModelVersionDistribution({ limit: 1 });

      expect(mockCollection.extend).toHaveBeenCalledWith({ $take: 1 });
      expect(result).toEqual({ 'v1.0': 1 });
    });

    test('applies date filtering when specified', async () => {
      const since = new Date('2024-01-01');
      const until = new Date('2024-12-31');

      const mockCollection = {
        query: jest.fn().mockReturnThis(),
        extend: jest.fn().mockReturnThis(),
        fetch: jest.fn().mockResolvedValue([]),
      };

      mockDatabase.get.mockReturnValue(mockCollection as any);

      await getModelVersionDistribution({ since, until });

      // Verify that date filters are applied
      expect(mockCollection.query).toHaveBeenCalled();
    });

    test('handles empty results', async () => {
      const mockCollection = {
        query: jest.fn().mockReturnThis(),
        extend: jest.fn().mockReturnThis(),
        fetch: jest.fn().mockResolvedValue([]),
      };

      mockDatabase.get.mockReturnValue(mockCollection as any);

      const result = await getModelVersionDistribution();

      expect(result).toEqual({});
    });
  });

  describe('getExecutionProviderDistribution', () => {
    test('returns provider distribution with default filters', async () => {
      const mockTelemetry: Partial<AssessmentTelemetryModel>[] = [
        {
          id: '1',
          eventType: 'inference_started',
          executionProvider: 'onnx',
          createdAt: new Date(),
        } as AssessmentTelemetryModel,
        {
          id: '2',
          eventType: 'inference_started',
          executionProvider: 'onnx',
          createdAt: new Date(),
        } as AssessmentTelemetryModel,
        {
          id: '3',
          eventType: 'inference_started',
          executionProvider: 'tflite',
          createdAt: new Date(),
        } as AssessmentTelemetryModel,
        {
          id: '4',
          eventType: 'inference_started',
          executionProvider: undefined, // Should be counted as 'unknown'
          createdAt: new Date(),
        } as Partial<AssessmentTelemetryModel>,
      ];

      const mockCollection = {
        query: jest.fn().mockReturnThis(),
        extend: jest.fn().mockReturnThis(),
        fetch: jest.fn().mockResolvedValue(mockTelemetry),
      };

      mockDatabase.get.mockReturnValue(mockCollection as any);

      const result = await getExecutionProviderDistribution();

      expect(result).toEqual({
        onnx: 2,
        tflite: 1,
        unknown: 1,
      });
      // Verify default filtering is applied (event_type and date range)
      expect(mockCollection.query).toHaveBeenCalled();
      expect(mockCollection.extend).toHaveBeenCalledWith({ $take: 10000 }); // Default limit
    });

    test('applies limit when specified', async () => {
      const mockTelemetry: Partial<AssessmentTelemetryModel>[] = [
        {
          id: '1',
          eventType: 'inference_started',
          executionProvider: 'onnx',
          createdAt: new Date(Date.now() - 1000), // Older
        } as AssessmentTelemetryModel,
        {
          id: '2',
          eventType: 'inference_started',
          executionProvider: 'tflite',
          createdAt: new Date(), // Newer
        } as AssessmentTelemetryModel,
      ];

      const mockCollection = {
        query: jest.fn().mockReturnThis(),
        extend: jest.fn().mockReturnThis(),
        fetch: jest.fn().mockResolvedValue([mockTelemetry[1]]), // Only newer due to limit + ordering
      };

      mockDatabase.get.mockReturnValue(mockCollection as any);

      const result = await getExecutionProviderDistribution({ limit: 1 });

      expect(mockCollection.extend).toHaveBeenCalledWith({ $take: 1 });
      expect(result).toEqual({ tflite: 1 });
    });

    test('applies date filtering when specified', async () => {
      const since = new Date('2024-01-01');
      const until = new Date('2024-12-31');

      const mockCollection = {
        query: jest.fn().mockReturnThis(),
        extend: jest.fn().mockReturnThis(),
        fetch: jest.fn().mockResolvedValue([]),
      };

      mockDatabase.get.mockReturnValue(mockCollection as any);

      await getExecutionProviderDistribution({ since, until });

      // Verify date filters are applied in query
      expect(mockCollection.query).toHaveBeenCalled();
      expect(mockCollection.extend).toHaveBeenCalledWith({ $take: 10000 });
    });

    test('uses default since date when not specified', async () => {
      const mockCollection = {
        query: jest.fn().mockReturnThis(),
        extend: jest.fn().mockReturnThis(),
        fetch: jest.fn().mockResolvedValue([]),
      };

      mockDatabase.get.mockReturnValue(mockCollection as any);

      await getExecutionProviderDistribution();

      // Should apply default date range (last 30 days)
      expect(mockCollection.query).toHaveBeenCalled();
    });

    test('handles empty results', async () => {
      const mockCollection = {
        query: jest.fn().mockReturnThis(),
        extend: jest.fn().mockReturnThis(),
        fetch: jest.fn().mockResolvedValue([]),
      };

      mockDatabase.get.mockReturnValue(mockCollection as any);

      const result = await getExecutionProviderDistribution();

      expect(result).toEqual({});
    });

    test('filters non-inference_started events', async () => {
      const mockTelemetry: Partial<AssessmentTelemetryModel>[] = [
        {
          id: '1',
          eventType: 'inference_started',
          executionProvider: 'onnx',
          createdAt: new Date(),
        } as AssessmentTelemetryModel,
        {
          id: '2',
          eventType: 'assessment_completed', // Different event type
          executionProvider: 'tflite',
          createdAt: new Date(),
        } as AssessmentTelemetryModel,
      ];

      const mockCollection = {
        query: jest.fn().mockReturnThis(),
        extend: jest.fn().mockReturnThis(),
        fetch: jest.fn().mockResolvedValue([mockTelemetry[0]]), // Only inference_started
      };

      mockDatabase.get.mockReturnValue(mockCollection as any);

      const result = await getExecutionProviderDistribution();

      expect(result).toEqual({ onnx: 1 });
      expect(result).not.toHaveProperty('tflite');
    });
  });

  // Add more tests for other functions as needed, but focus on the changed logic
});
