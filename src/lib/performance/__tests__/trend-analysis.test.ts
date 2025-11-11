/**
 * Tests for Performance Trend Analysis
 */

import {
  analyzeMultipleMetrics,
  analyzeTrend,
  calculateDelta,
  calculateMovingAverage,
  filterRegressions,
  formatTrendResult,
  getMetricsForCategory,
  groupByMetric,
  type PerformanceTimeSeriesPoint,
  type TrendAnalysisConfig,
} from '../trend-analysis';

describe('calculateMovingAverage', () => {
  test('calculates average for data within window', () => {
    const now = Date.now();
    const dataPoints: PerformanceTimeSeriesPoint[] = [
      {
        timestamp: now - 6 * 24 * 60 * 60 * 1000,
        metric: 'test',
        value: 100,
        buildHash: 'abc',
        device: 'test',
        platform: 'android',
      },
      {
        timestamp: now - 3 * 24 * 60 * 60 * 1000,
        metric: 'test',
        value: 200,
        buildHash: 'def',
        device: 'test',
        platform: 'android',
      },
      {
        timestamp: now,
        metric: 'test',
        value: 300,
        buildHash: 'ghi',
        device: 'test',
        platform: 'android',
      },
    ];

    const average = calculateMovingAverage(dataPoints, 7);
    expect(average).toBe(200); // (100 + 200 + 300) / 3
  });

  test('excludes data outside window', () => {
    const now = Date.now();
    const dataPoints: PerformanceTimeSeriesPoint[] = [
      {
        timestamp: now - 10 * 24 * 60 * 60 * 1000,
        metric: 'test',
        value: 100,
        buildHash: 'abc',
        device: 'test',
        platform: 'android',
      },
      {
        timestamp: now - 3 * 24 * 60 * 60 * 1000,
        metric: 'test',
        value: 200,
        buildHash: 'def',
        device: 'test',
        platform: 'android',
      },
      {
        timestamp: now,
        metric: 'test',
        value: 300,
        buildHash: 'ghi',
        device: 'test',
        platform: 'android',
      },
    ];

    const average = calculateMovingAverage(dataPoints, 7);
    expect(average).toBe(250); // (200 + 300) / 2 (excludes 100)
  });

  test('returns null for empty data', () => {
    const average = calculateMovingAverage([], 7);
    expect(average).toBeNull();
  });
});

describe('calculateDelta', () => {
  test('calculates positive percentage change', () => {
    const delta = calculateDelta(110, 100);
    expect(delta).toBe(0.1); // 10% increase
  });

  test('calculates negative percentage change', () => {
    const delta = calculateDelta(90, 100);
    expect(delta).toBe(-0.1); // 10% decrease
  });

  test('handles zero baseline', () => {
    const delta = calculateDelta(100, 0);
    expect(delta).toBe(1); // 100% increase
  });

  test('handles zero current value with zero baseline', () => {
    const delta = calculateDelta(0, 0);
    expect(delta).toBe(0);
  });
});

describe('analyzeTrend', () => {
  const now = Date.now();
  const config: TrendAnalysisConfig = {
    windowDays: 7,
    deltaThreshold: 0.1,
    minDataPoints: 3,
  };

  test('detects regression when threshold exceeded', () => {
    const dataPoints: PerformanceTimeSeriesPoint[] = [
      {
        timestamp: now - 6 * 24 * 60 * 60 * 1000,
        metric: 'startup.tti',
        value: 1000,
        buildHash: 'abc',
        device: 'test',
        platform: 'android',
      },
      {
        timestamp: now - 3 * 24 * 60 * 60 * 1000,
        metric: 'startup.tti',
        value: 1100,
        buildHash: 'def',
        device: 'test',
        platform: 'android',
      },
      {
        timestamp: now - 1 * 24 * 60 * 60 * 1000,
        metric: 'startup.tti',
        value: 1200,
        buildHash: 'ghi',
        device: 'test',
        platform: 'android',
      },
    ];

    const result = analyzeTrend(dataPoints, 1400, config);

    expect(result.exceedsThreshold).toBe(true);
    expect(result.currentValue).toBe(1400);
    expect(result.movingAverage).toBeCloseTo(1100, 0);
    expect(result.delta).toBeCloseTo(0.27, 1); // ~27% increase
  });

  test('does not detect regression when within threshold', () => {
    const dataPoints: PerformanceTimeSeriesPoint[] = [
      {
        timestamp: now - 6 * 24 * 60 * 60 * 1000,
        metric: 'startup.tti',
        value: 1000,
        buildHash: 'abc',
        device: 'test',
        platform: 'android',
      },
      {
        timestamp: now - 3 * 24 * 60 * 60 * 1000,
        metric: 'startup.tti',
        value: 1100,
        buildHash: 'def',
        device: 'test',
        platform: 'android',
      },
      {
        timestamp: now - 1 * 24 * 60 * 60 * 1000,
        metric: 'startup.tti',
        value: 1200,
        buildHash: 'ghi',
        device: 'test',
        platform: 'android',
      },
    ];

    const result = analyzeTrend(dataPoints, 1150, config);

    expect(result.exceedsThreshold).toBe(false);
    expect(result.currentValue).toBe(1150);
    expect(result.delta).toBeLessThan(0.1);
  });

  test('handles insufficient data points', () => {
    const dataPoints: PerformanceTimeSeriesPoint[] = [
      {
        timestamp: now,
        metric: 'startup.tti',
        value: 1000,
        buildHash: 'abc',
        device: 'test',
        platform: 'android',
      },
    ];

    const result = analyzeTrend(dataPoints, 1500, config);

    expect(result.exceedsThreshold).toBe(false);
    expect(result.dataPoints).toBe(1);
    expect(result.movingAverage).toBe(1500);
  });
});

describe('analyzeMultipleMetrics', () => {
  const now = Date.now();
  const config: TrendAnalysisConfig = {
    windowDays: 7,
    deltaThreshold: 0.1,
    minDataPoints: 3,
  };

  test('analyzes multiple metrics', () => {
    const metricData = new Map<string, PerformanceTimeSeriesPoint[]>();

    metricData.set('startup.tti', [
      {
        timestamp: now - 3 * 24 * 60 * 60 * 1000,
        metric: 'startup.tti',
        value: 1000,
        buildHash: 'abc',
        device: 'test',
        platform: 'android',
      },
      {
        timestamp: now - 2 * 24 * 60 * 60 * 1000,
        metric: 'startup.tti',
        value: 1100,
        buildHash: 'def',
        device: 'test',
        platform: 'android',
      },
      {
        timestamp: now - 1 * 24 * 60 * 60 * 1000,
        metric: 'startup.tti',
        value: 1200,
        buildHash: 'ghi',
        device: 'test',
        platform: 'android',
      },
    ]);

    metricData.set('scroll.avgFps', [
      {
        timestamp: now - 3 * 24 * 60 * 60 * 1000,
        metric: 'scroll.avgFps',
        value: 60,
        buildHash: 'abc',
        device: 'test',
        platform: 'android',
      },
      {
        timestamp: now - 2 * 24 * 60 * 60 * 1000,
        metric: 'scroll.avgFps',
        value: 59,
        buildHash: 'def',
        device: 'test',
        platform: 'android',
      },
      {
        timestamp: now - 1 * 24 * 60 * 60 * 1000,
        metric: 'scroll.avgFps',
        value: 58,
        buildHash: 'ghi',
        device: 'test',
        platform: 'android',
      },
    ]);

    const currentValues = new Map([
      ['startup.tti', 1300],
      ['scroll.avgFps', 57],
    ]);

    const results = analyzeMultipleMetrics(metricData, currentValues, config);

    expect(results.size).toBe(2);
    expect(results.has('startup.tti')).toBe(true);
    expect(results.has('scroll.avgFps')).toBe(true);
  });
});

describe('filterRegressions', () => {
  test('filters metrics exceeding threshold', () => {
    const results = new Map([
      [
        'startup.tti',
        {
          metric: 'startup.tti',
          currentValue: 1500,
          movingAverage: 1000,
          delta: 0.5,
          exceedsThreshold: true,
          dataPoints: 5,
          windowDays: 7,
          threshold: 0.1,
        },
      ],
      [
        'scroll.avgFps',
        {
          metric: 'scroll.avgFps',
          currentValue: 58,
          movingAverage: 59,
          delta: -0.017,
          exceedsThreshold: false,
          dataPoints: 5,
          windowDays: 7,
          threshold: 0.1,
        },
      ],
    ]);

    const regressions = filterRegressions(results);

    expect(regressions).toHaveLength(1);
    expect(regressions[0].metric).toBe('startup.tti');
  });
});

describe('formatTrendResult', () => {
  test('formats regression result', () => {
    const result = {
      metric: 'startup.tti',
      currentValue: 1500,
      movingAverage: 1000,
      delta: 0.5,
      exceedsThreshold: true,
      dataPoints: 5,
      windowDays: 7,
      threshold: 0.1,
    };

    const formatted = formatTrendResult(result);

    expect(formatted).toContain('⚠️ REGRESSION');
    expect(formatted).toContain('startup.tti');
    expect(formatted).toContain('1500');
    expect(formatted).toContain('50%');
  });

  test('formats OK result', () => {
    const result = {
      metric: 'scroll.avgFps',
      currentValue: 58,
      movingAverage: 59,
      delta: -0.017,
      exceedsThreshold: false,
      dataPoints: 5,
      windowDays: 7,
      threshold: 0.1,
    };

    const formatted = formatTrendResult(result);

    expect(formatted).toContain('✓ OK');
    expect(formatted).toContain('scroll.avgFps');
  });
});

describe('groupByMetric', () => {
  test('groups and sorts data points by metric', () => {
    const now = Date.now();
    const dataPoints: PerformanceTimeSeriesPoint[] = [
      {
        timestamp: now - 2 * 24 * 60 * 60 * 1000,
        metric: 'startup.tti',
        value: 1000,
        buildHash: 'abc',
        device: 'test',
        platform: 'android',
      },
      {
        timestamp: now - 1 * 24 * 60 * 60 * 1000,
        metric: 'scroll.avgFps',
        value: 60,
        buildHash: 'def',
        device: 'test',
        platform: 'android',
      },
      {
        timestamp: now - 3 * 24 * 60 * 60 * 1000,
        metric: 'startup.tti',
        value: 900,
        buildHash: 'ghi',
        device: 'test',
        platform: 'android',
      },
    ];

    const grouped = groupByMetric(dataPoints);

    expect(grouped.size).toBe(2);
    expect(grouped.get('startup.tti')).toHaveLength(2);
    expect(grouped.get('scroll.avgFps')).toHaveLength(1);

    // Check sorting (oldest first)
    const startupPoints = grouped.get('startup.tti')!;
    expect(startupPoints[0].value).toBe(900);
    expect(startupPoints[1].value).toBe(1000);
  });
});

describe('getMetricsForCategory', () => {
  test('returns startup metrics', () => {
    const metrics = getMetricsForCategory('startup');
    expect(metrics).toContain('startup.tti');
    expect(metrics).toContain('startup.ttfd');
  });

  test('returns navigation metrics', () => {
    const metrics = getMetricsForCategory('navigation');
    expect(metrics).toContain('navigation.p95');
  });

  test('returns scroll metrics', () => {
    const metrics = getMetricsForCategory('scroll');
    expect(metrics).toContain('scroll.avgFps');
    expect(metrics).toContain('scroll.p95FrameTime');
  });

  test('returns sync metrics', () => {
    const metrics = getMetricsForCategory('sync');
    expect(metrics).toContain('sync.p95');
  });
});
