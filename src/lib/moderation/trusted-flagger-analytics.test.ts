import { cleanup } from '@/lib/test-utils';
import type { TrustedFlaggerMetrics } from '@/types/moderation';

import {
  calculateAggregateMetrics,
  calculateQualityTrend,
  exportFlaggerMetrics,
  formatResponseTime,
  getFlaggersRequiringReview,
  getPerformanceBadgeColor,
  getTrustedFlaggerAnalytics,
  getTrustedFlaggerMetrics,
  getTrustedFlaggers,
  shouldSuspendFlagger,
  shouldWarnFlagger,
} from './trusted-flagger-analytics';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

afterEach(cleanup);
afterEach(() => {
  jest.clearAllMocks();
});

describe('Trusted Flagger Analytics', () => {
  describe('getTrustedFlaggerAnalytics', () => {
    test('fetches analytics and converts date strings to Date objects', async () => {
      const mockResponse = {
        total_flaggers: 2,
        active_flaggers: 2,
        flaggers: [
          {
            flagger_id: '1',
            flagger_name: 'Test Flagger 1',
            accuracy_rate: 0.95,
            false_positive_rate: 0.05,
            average_response_time_ms: 3600000,
            report_volume: { total: 100, this_week: 10, this_month: 25 },
            quality_trend: 'improving' as const,
            last_reviewed_at: '2024-01-15T10:00:00Z',
            status: 'active' as const,
          },
          {
            flagger_id: '2',
            flagger_name: 'Test Flagger 2',
            accuracy_rate: 0.88,
            false_positive_rate: 0.12,
            average_response_time_ms: 7200000,
            report_volume: { total: 50, this_week: 5, this_month: 15 },
            quality_trend: 'stable' as const,
            last_reviewed_at: '2024-01-10T10:00:00Z',
            status: 'active' as const,
          },
        ],
        aggregate_metrics: {
          average_accuracy: 0.915,
          average_response_time_ms: 5400000,
          total_reports_this_month: 40,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const result = await getTrustedFlaggerAnalytics();

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/moderation/trusted-flaggers/analytics'
      );
      expect(result.total_flaggers).toBe(2);
      expect(result.active_flaggers).toBe(2);
      expect(result.flaggers).toHaveLength(2);
      expect(result.flaggers[0].last_reviewed_at).toBeInstanceOf(Date);
      expect(result.flaggers[0].last_reviewed_at?.toISOString()).toBe(
        '2024-01-15T10:00:00.000Z'
      );
      expect(result.flaggers[1].last_reviewed_at).toBeInstanceOf(Date);
      expect(result.flaggers[1].last_reviewed_at?.toISOString()).toBe(
        '2024-01-10T10:00:00.000Z'
      );
    });

    test('handles empty flaggers array', async () => {
      const mockResponse = {
        total_flaggers: 0,
        active_flaggers: 0,
        flaggers: [],
        aggregate_metrics: {
          average_accuracy: 0,
          average_response_time_ms: 0,
          total_reports_this_month: 0,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const result = await getTrustedFlaggerAnalytics();

      expect(result.flaggers).toEqual([]);
    });

    test('throws error on failed response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error',
      });

      await expect(getTrustedFlaggerAnalytics()).rejects.toThrow(
        'Failed to fetch trusted flagger analytics: Internal Server Error'
      );
    });
  });

  describe('getTrustedFlaggerMetrics', () => {
    test('fetches metrics and converts date string to Date object', async () => {
      const mockResponse = {
        flagger_id: '1',
        flagger_name: 'Test Flagger',
        accuracy_rate: 0.95,
        false_positive_rate: 0.05,
        average_response_time_ms: 3600000,
        report_volume: { total: 100, this_week: 10, this_month: 25 },
        quality_trend: 'improving' as const,
        last_reviewed_at: '2024-01-15T10:00:00Z',
        status: 'active' as const,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const result = await getTrustedFlaggerMetrics('1');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/moderation/trusted-flaggers/1/metrics'
      );
      expect(result.last_reviewed_at).toBeInstanceOf(Date);
      expect(result.last_reviewed_at?.toISOString()).toBe(
        '2024-01-15T10:00:00.000Z'
      );
    });

    test('handles undefined last_reviewed_at', async () => {
      const mockResponse = {
        flagger_id: '1',
        flagger_name: 'Test Flagger',
        accuracy_rate: 0.95,
        false_positive_rate: 0.05,
        average_response_time_ms: 3600000,
        report_volume: { total: 100, this_week: 10, this_month: 25 },
        quality_trend: 'improving' as const,
        last_reviewed_at: undefined,
        status: 'active' as const,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const result = await getTrustedFlaggerMetrics('1');

      expect(result.last_reviewed_at).toBeUndefined();
    });
  });

  describe('getTrustedFlaggers', () => {
    test('fetches flaggers and converts date strings to Date objects', async () => {
      const mockResponse = [
        {
          id: '1',
          organization_name: 'Test Org 1',
          contact_info: { email: 'test1@example.com' },
          specialization: ['terrorism'],
          status: 'active' as const,
          quality_metrics: {
            accuracy_rate: 0.95,
            average_handling_time_hours: 1.5,
            total_reports: 100,
          },
          certification_date: '2023-06-01T00:00:00Z',
          review_date: '2024-06-01T00:00:00Z',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        {
          id: '2',
          organization_name: 'Test Org 2',
          contact_info: { email: 'test2@example.com' },
          specialization: ['hate_speech'],
          status: 'active' as const,
          quality_metrics: {
            accuracy_rate: 0.88,
            average_handling_time_hours: 2.0,
            total_reports: 50,
          },
          certification_date: '2023-07-01T00:00:00Z',
          review_date: '2024-07-01T00:00:00Z',
          created_at: '2023-02-01T00:00:00Z',
          updated_at: '2024-01-15T00:00:00Z',
          deleted_at: '2024-01-20T00:00:00Z',
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const result = await getTrustedFlaggers();

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/moderation/trusted-flaggers'
      );
      expect(result).toHaveLength(2);

      // Check first flagger
      expect(result[0].certification_date).toBeInstanceOf(Date);
      expect(result[0].certification_date.toISOString()).toBe(
        '2023-06-01T00:00:00.000Z'
      );
      expect(result[0].review_date).toBeInstanceOf(Date);
      expect(result[0].review_date.toISOString()).toBe(
        '2024-06-01T00:00:00.000Z'
      );
      expect(result[0].created_at).toBeInstanceOf(Date);
      expect(result[0].created_at.toISOString()).toBe(
        '2023-01-01T00:00:00.000Z'
      );
      expect(result[0].updated_at).toBeInstanceOf(Date);
      expect(result[0].updated_at.toISOString()).toBe(
        '2024-01-01T00:00:00.000Z'
      );
      expect(result[0].deleted_at).toBeUndefined();

      // Check second flagger
      expect(result[1].certification_date).toBeInstanceOf(Date);
      expect(result[1].review_date).toBeInstanceOf(Date);
      expect(result[1].created_at).toBeInstanceOf(Date);
      expect(result[1].updated_at).toBeInstanceOf(Date);
      expect(result[1].deleted_at).toBeInstanceOf(Date);
      expect(result[1].deleted_at?.toISOString()).toBe(
        '2024-01-20T00:00:00.000Z'
      );
    });

    test('handles status filter', async () => {
      const mockResponse: any[] = [];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      await getTrustedFlaggers('active');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/moderation/trusted-flaggers?status=active'
      );
    });

    test('handles empty response array', async () => {
      const mockResponse: any[] = [];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const result = await getTrustedFlaggers();

      expect(result).toEqual([]);
    });
  });

  describe('calculateQualityTrend', () => {
    test('returns stable when no recent accuracy data', () => {
      expect(calculateQualityTrend([], 0.8)).toBe('stable');
    });

    test('returns stable when accuracy data has 1 element', () => {
      expect(calculateQualityTrend([0.85], 0.8)).toBe('stable');
    });

    test('returns improving when accuracy increased by more than 5%', () => {
      expect(calculateQualityTrend([0.8], 0.86)).toBe('improving');
    });

    test('returns degrading when accuracy decreased by more than 5%', () => {
      expect(calculateQualityTrend([0.9], 0.82)).toBe('degrading');
    });

    test('returns stable when accuracy change is within 5%', () => {
      expect(calculateQualityTrend([0.85], 0.87)).toBe('stable');
      expect(calculateQualityTrend([0.85], 0.83)).toBe('stable');
    });
  });

  describe('shouldWarnFlagger', () => {
    test('warns when accuracy drops below 70%', () => {
      expect(
        shouldWarnFlagger(
          {} as TrustedFlaggerMetrics & {
            accuracy_rate: 0.65;
            false_positive_rate: 0.1;
            quality_trend: 'stable';
          }
        )
      ).toBe(true);
    });

    test('warns when false positive rate exceeds 30%', () => {
      expect(
        shouldWarnFlagger(
          {} as TrustedFlaggerMetrics & {
            accuracy_rate: 0.8;
            false_positive_rate: 0.35;
            quality_trend: 'stable';
          }
        )
      ).toBe(true);
    });

    test('warns when quality is degrading', () => {
      expect(
        shouldWarnFlagger(
          {} as TrustedFlaggerMetrics & {
            accuracy_rate: 0.8;
            false_positive_rate: 0.1;
            quality_trend: 'degrading';
          }
        )
      ).toBe(true);
    });

    test('does not warn when all metrics are good', () => {
      expect(
        shouldWarnFlagger(
          {} as TrustedFlaggerMetrics & {
            accuracy_rate: 0.8;
            false_positive_rate: 0.1;
            quality_trend: 'stable';
          }
        )
      ).toBe(false);
    });
  });

  describe('shouldSuspendFlagger', () => {
    test('suspends when accuracy drops below 50%', () => {
      expect(
        shouldSuspendFlagger(
          {} as TrustedFlaggerMetrics & {
            accuracy_rate: 0.45;
            false_positive_rate: 0.1;
            quality_trend: 'stable';
            status: 'active';
          }
        )
      ).toBe(true);
    });

    test('suspends when false positive rate exceeds 50%', () => {
      expect(
        shouldSuspendFlagger(
          {} as TrustedFlaggerMetrics & {
            accuracy_rate: 0.8;
            false_positive_rate: 0.55;
            quality_trend: 'stable';
            status: 'active';
          }
        )
      ).toBe(true);
    });

    test('suspends when already on warning and still degrading', () => {
      expect(
        shouldSuspendFlagger(
          {} as TrustedFlaggerMetrics & {
            accuracy_rate: 0.75;
            false_positive_rate: 0.2;
            quality_trend: 'degrading';
            status: 'warning';
          }
        )
      ).toBe(true);
    });

    test('does not suspend when metrics are acceptable', () => {
      expect(
        shouldSuspendFlagger(
          {} as TrustedFlaggerMetrics & {
            accuracy_rate: 0.75;
            false_positive_rate: 0.2;
            quality_trend: 'stable';
            status: 'active';
          }
        )
      ).toBe(false);
    });
  });

  describe('calculateAggregateMetrics', () => {
    test('calculates aggregate metrics for multiple flaggers', () => {
      const flaggers = [
        {
          accuracy_rate: 0.9,
          average_response_time_ms: 3600000,
          report_volume: { this_month: 20 },
        },
        {
          accuracy_rate: 0.8,
          average_response_time_ms: 7200000,
          report_volume: { this_month: 30 },
        },
      ];

      const result = calculateAggregateMetrics(flaggers as any);

      expect(result.averageAccuracy).toBeCloseTo(0.85);
      expect(result.averageResponseTime).toBe(5400000);
      expect(result.totalReportsThisMonth).toBe(50);
    });

    test('returns zero values for empty flaggers array', () => {
      const result = calculateAggregateMetrics([]);

      expect(result.averageAccuracy).toBe(0);
      expect(result.averageResponseTime).toBe(0);
      expect(result.totalReportsThisMonth).toBe(0);
    });
  });

  describe('getFlaggersRequiringReview', () => {
    test('returns flaggers that should be warned or suspended', () => {
      const flaggers = [
        {
          accuracy_rate: 0.8,
          false_positive_rate: 0.1,
          quality_trend: 'stable',
          status: 'active',
        }, // Good
        {
          accuracy_rate: 0.65,
          false_positive_rate: 0.1,
          quality_trend: 'stable',
          status: 'active',
        }, // Should warn
        {
          accuracy_rate: 0.45,
          false_positive_rate: 0.1,
          quality_trend: 'stable',
          status: 'active',
        }, // Should suspend
      ];

      const result = getFlaggersRequiringReview(flaggers as any);

      expect(result).toHaveLength(2);
      expect(result[0].accuracy_rate).toBe(0.65);
      expect(result[1].accuracy_rate).toBe(0.45);
    });

    test('returns empty array when no flaggers need review', () => {
      const flaggers = [
        {
          accuracy_rate: 0.85,
          false_positive_rate: 0.1,
          quality_trend: 'stable',
          status: 'active',
        },
        {
          accuracy_rate: 0.9,
          false_positive_rate: 0.05,
          quality_trend: 'improving',
          status: 'active',
        },
      ];

      const result = getFlaggersRequiringReview(flaggers as any);

      expect(result).toEqual([]);
    });
  });

  describe('formatResponseTime', () => {
    test('formats milliseconds to hours and minutes', () => {
      expect(formatResponseTime(3661000)).toBe('1h 1m'); // 1h 1m 1s
      expect(formatResponseTime(7200000)).toBe('2h 0m'); // 2h
    });

    test('formats days for very long response times', () => {
      expect(formatResponseTime(86400000)).toBe('1d 0h'); // 1 day
      expect(formatResponseTime(90000000)).toBe('1d 1h'); // 1d 1h
    });

    test('formats minutes for short response times', () => {
      expect(formatResponseTime(60000)).toBe('1m'); // 1 minute
      expect(formatResponseTime(300000)).toBe('5m'); // 5 minutes
    });
  });

  describe('getPerformanceBadgeColor', () => {
    test('returns success for high accuracy', () => {
      expect(getPerformanceBadgeColor(0.95)).toBe('success');
      expect(getPerformanceBadgeColor(0.9)).toBe('success');
    });

    test('returns warning for medium accuracy', () => {
      expect(getPerformanceBadgeColor(0.85)).toBe('warning');
      expect(getPerformanceBadgeColor(0.7)).toBe('warning');
    });

    test('returns danger for low accuracy', () => {
      expect(getPerformanceBadgeColor(0.65)).toBe('danger');
      expect(getPerformanceBadgeColor(0.5)).toBe('danger');
    });
  });

  describe('exportFlaggerMetrics', () => {
    test('exports metrics with date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      const mockBlob = new Blob(['test data'], { type: 'text/csv' });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        blob: jest.fn().mockResolvedValue(mockBlob),
      });

      const result = await exportFlaggerMetrics(startDate, endDate);

      expect(mockFetch).toHaveBeenCalledWith(
        `/api/moderation/trusted-flaggers/export?start=${startDate.toISOString()}&end=${endDate.toISOString()}`
      );
      expect(result).toBeInstanceOf(Blob);
    });

    test('throws error on failed response', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error',
      });

      await expect(exportFlaggerMetrics(startDate, endDate)).rejects.toThrow(
        'Failed to export flagger metrics: Internal Server Error'
      );
    });
  });
});
