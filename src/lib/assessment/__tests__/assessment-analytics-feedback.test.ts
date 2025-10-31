import { Q } from '@nozbe/watermelondb';

import { database } from '@/lib/watermelon';
import type { AssessmentFeedbackModel } from '@/lib/watermelon-models/assessment-feedback';

import { getFeedbackStats } from '../assessment-analytics-feedback';

// Mock the database
jest.mock('@/lib/watermelon', () => ({
  database: {
    get: jest.fn(),
  },
}));

const mockDatabase = database as jest.Mocked<typeof database>;

describe('getFeedbackStats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return stats for last 30 days by default', async () => {
    const mockFeedback = [
      { helpful: true, issueResolved: 'yes' },
      { helpful: false, issueResolved: 'no' },
      { helpful: true, issueResolved: 'too_early' },
    ] as AssessmentFeedbackModel[];

    const mockQuery = {
      query: jest.fn().mockReturnThis(),
      fetch: jest.fn().mockResolvedValue(mockFeedback),
    };

    mockDatabase.get.mockReturnValue(mockQuery as any);

    const stats = await getFeedbackStats();

    expect(mockDatabase.get).toHaveBeenCalledWith('assessment_feedback');
    expect(mockQuery.query).toHaveBeenCalledWith(
      Q.where('created_at', Q.gte(expect.any(Number)))
    );
    expect(stats).toEqual({
      total: 3,
      helpful: 2,
      notHelpful: 1,
      resolved: 1,
      notResolved: 1,
      tooEarly: 1,
    });
  });

  it('should return stats for specified days', async () => {
    const mockFeedback = [
      { helpful: true, issueResolved: 'yes' },
    ] as AssessmentFeedbackModel[];

    const mockQuery = {
      query: jest.fn().mockReturnThis(),
      fetch: jest.fn().mockResolvedValue(mockFeedback),
    };

    mockDatabase.get.mockReturnValue(mockQuery as any);

    const stats = await getFeedbackStats(7);

    expect(mockQuery.query).toHaveBeenCalledWith(
      Q.where('created_at', Q.gte(expect.any(Number)))
    );
    expect(stats.total).toBe(1);
  });

  it('should return limited stats for all historical data when days=0', async () => {
    const mockFeedback = Array(60000)
      .fill(null)
      .map((_, i) => ({
        helpful: i % 2 === 0,
        issueResolved: i % 3 === 0 ? 'yes' : i % 3 === 1 ? 'no' : 'too_early',
      })) as AssessmentFeedbackModel[];

    const mockQuery = {
      query: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      fetch: jest.fn().mockResolvedValue(mockFeedback.slice(0, 50000)),
    };

    mockDatabase.get.mockReturnValue(mockQuery as any);

    const stats = await getFeedbackStats(0);

    expect(mockQuery.query).toHaveBeenCalledWith();
    expect(mockQuery.limit).toHaveBeenCalledWith(50000);
    expect(stats.total).toBe(50000); // Should be limited to 50000
  });

  it('should handle empty feedback list', async () => {
    const mockQuery = {
      query: jest.fn().mockReturnThis(),
      fetch: jest.fn().mockResolvedValue([]),
    };

    mockDatabase.get.mockReturnValue(mockQuery as any);

    const stats = await getFeedbackStats(30);

    expect(stats).toEqual({
      total: 0,
      helpful: 0,
      notHelpful: 0,
      resolved: 0,
      notResolved: 0,
      tooEarly: 0,
    });
  });

  it('should correctly count different issueResolved values', async () => {
    const mockFeedback = [
      { helpful: true, issueResolved: 'yes' },
      { helpful: false, issueResolved: 'no' },
      { helpful: true, issueResolved: 'too_early' },
      { helpful: false, issueResolved: null },
    ] as AssessmentFeedbackModel[];

    const mockQuery = {
      query: jest.fn().mockReturnThis(),
      fetch: jest.fn().mockResolvedValue(mockFeedback),
    };

    mockDatabase.get.mockReturnValue(mockQuery as any);

    const stats = await getFeedbackStats(30);

    expect(stats).toEqual({
      total: 4,
      helpful: 2,
      notHelpful: 2,
      resolved: 1,
      notResolved: 1,
      tooEarly: 1,
    });
  });
});
