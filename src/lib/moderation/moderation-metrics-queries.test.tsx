import { cleanup } from '@/lib/test-utils';

import {
  calculateAppealReversalRate,
  getAppealMetrics,
  getODSMetrics,
} from './moderation-metrics-queries';
afterEach(cleanup);

// Mock supabase
jest.mock('../supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        gte: jest.fn(() => ({
          lte: jest.fn(() => ({
            not: jest.fn(() => ({
              is: jest.fn(() => ({
                data: [],
                error: null,
              })),
            })),
          })),
        })),
      })),
    })),
  },
}));

describe('ModerationMetricsQueries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateAppealReversalRate', () => {
    test('returns 0 when no appeals found', async () => {
      const mockSupabase = require('../supabase').supabase;
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          gte: jest.fn(() => ({
            lte: jest.fn(() => ({
              not: jest.fn(() => ({
                is: jest.fn(() => ({
                  data: [],
                  error: null,
                })),
              })),
            })),
          })),
        })),
      });

      const period = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      };

      const result = await calculateAppealReversalRate(period);
      expect(result).toBe(0);
    });

    test('calculates reversal rate correctly', async () => {
      const mockAppeals = [
        { decision: 'rejected' }, // reversed
        { decision: 'upheld' }, // not reversed
        { decision: 'rejected' }, // reversed
        { decision: 'partial' }, // not reversed
      ];

      const mockSupabase = require('../supabase').supabase;
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          gte: jest.fn(() => ({
            lte: jest.fn(() => ({
              not: jest.fn(() => ({
                is: jest.fn(() => ({
                  data: mockAppeals,
                  error: null,
                })),
              })),
            })),
          })),
        })),
      });

      const period = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      };

      const result = await calculateAppealReversalRate(period);
      // 2 rejected out of 4 total = 50%
      expect(result).toBe(50);
    });

    test('handles database errors gracefully', async () => {
      const mockSupabase = require('../supabase').supabase;
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          gte: jest.fn(() => ({
            lte: jest.fn(() => ({
              not: jest.fn(() => ({
                is: jest.fn(() => ({
                  data: null,
                  error: new Error('Database connection failed'),
                })),
              })),
            })),
          })),
        })),
      });

      const period = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      };

      const result = await calculateAppealReversalRate(period);
      expect(result).toBe(0);
    });

    test('filters appeals by date range', async () => {
      const mockSupabase = require('../supabase').supabase;
      const mockFrom = {
        select: jest.fn(() => ({
          gte: jest.fn(() => ({
            lte: jest.fn(() => ({
              not: jest.fn(() => ({
                is: jest.fn(() => ({
                  data: [{ decision: 'rejected' }],
                  error: null,
                })),
              })),
            })),
          })),
        })),
      };
      mockSupabase.from.mockReturnValue(mockFrom);

      const period = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      };

      await calculateAppealReversalRate(period);

      expect(mockSupabase.from).toHaveBeenCalledWith('appeals');
      expect(mockFrom.select).toHaveBeenCalledWith('decision');
      expect(mockFrom.select().gte).toHaveBeenCalledWith(
        'submitted_at',
        period.startDate.toISOString()
      );
      expect(mockFrom.select().gte().lte).toHaveBeenCalledWith(
        'submitted_at',
        period.endDate.toISOString()
      );
    });
  });

  describe('getAppealMetrics', () => {
    test('returns hardcoded metrics (placeholder - needs real implementation)', async () => {
      const period = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      };

      const result = await getAppealMetrics(period);

      expect(result).toEqual({
        totalAppeals: 100,
        upheldAppeals: 15,
        rejectedAppeals: 85,
        reversalRate: 15.0,
      });
    });
  });

  describe('getODSMetrics', () => {
    test('returns empty metrics when no escalations found', async () => {
      const mockSupabase = require('../supabase').supabase;
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          gte: jest.fn(() => ({
            lte: jest.fn(() => ({
              is: jest.fn(() => ({
                data: [],
                error: null,
              })),
            })),
          })),
        })),
      });

      const period = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      };

      const result = await getODSMetrics(period);
      expect(result).toEqual({
        totalEscalations: 0,
        upheldByODS: 0,
        rejectedByODS: 0,
        averageResolutionDays: 0,
      });
    });

    test('calculates metrics correctly', async () => {
      const mockEscalations = [
        {
          outcome: 'upheld',
          submitted_at: '2024-01-15T10:00:00Z',
          actual_resolution_date: '2024-01-25T10:00:00Z',
        },
        {
          outcome: 'rejected',
          submitted_at: '2024-01-10T10:00:00Z',
          actual_resolution_date: '2024-01-20T10:00:00Z',
        },
        {
          outcome: 'partial',
          submitted_at: '2024-01-05T10:00:00Z',
          actual_resolution_date: '2024-01-15T10:00:00Z',
        },
        {
          outcome: null, // not resolved yet
          submitted_at: '2024-01-01T10:00:00Z',
          actual_resolution_date: null,
        },
      ];

      const mockSupabase = require('../supabase').supabase;
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          gte: jest.fn(() => ({
            lte: jest.fn(() => ({
              is: jest.fn(() => ({
                data: mockEscalations,
                error: null,
              })),
            })),
          })),
        })),
      });

      const period = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      };

      const result = await getODSMetrics(period);
      // 4 total escalations
      // 1 upheld, 1 rejected, 1 partial (not counted in upheld/rejected), 1 unresolved
      // Average resolution days: (10 + 10 + 10) / 3 = 10 days
      expect(result).toEqual({
        totalEscalations: 4,
        upheldByODS: 1,
        rejectedByODS: 1,
        averageResolutionDays: 10,
      });
    });

    test('handles database errors gracefully', async () => {
      const mockSupabase = require('../supabase').supabase;
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          gte: jest.fn(() => ({
            lte: jest.fn(() => ({
              is: jest.fn(() => ({
                data: null,
                error: new Error('Database connection failed'),
              })),
            })),
          })),
        })),
      });

      const period = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      };

      const result = await getODSMetrics(period);
      expect(result).toEqual({
        totalEscalations: 0,
        upheldByODS: 0,
        rejectedByODS: 0,
        averageResolutionDays: 0,
      });
    });

    test('filters escalations by date range', async () => {
      const mockSupabase = require('../supabase').supabase;
      const mockFrom = {
        select: jest.fn(() => ({
          gte: jest.fn(() => ({
            lte: jest.fn(() => ({
              is: jest.fn(() => ({
                data: [
                  {
                    outcome: 'upheld',
                    submitted_at: '2024-01-15T10:00:00Z',
                    actual_resolution_date: '2024-01-25T10:00:00Z',
                  },
                ],
                error: null,
              })),
            })),
          })),
        })),
      };
      mockSupabase.from.mockReturnValue(mockFrom);

      const period = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      };

      await getODSMetrics(period);

      expect(mockSupabase.from).toHaveBeenCalledWith('ods_escalations');
      expect(mockFrom.select).toHaveBeenCalledWith(
        'outcome, submitted_at, actual_resolution_date'
      );
      // Check that gte was called with the right arguments
      const selectMock = mockFrom.select;
      const gteMock = selectMock.mock.results[0].value.gte;
      expect(gteMock).toHaveBeenCalledWith(
        'submitted_at',
        period.startDate.toISOString()
      );
      // Check that lte was called with the right arguments
      const lteMock = gteMock.mock.results[0].value.lte;
      expect(lteMock).toHaveBeenCalledWith(
        'submitted_at',
        period.endDate.toISOString()
      );
    });
  });
});
