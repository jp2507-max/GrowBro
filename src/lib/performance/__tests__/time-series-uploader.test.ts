/**
 * Tests for Performance Time Series Uploader
 */

import * as Sentry from '@sentry/react-native';

import * as SentryIntegration from '../sentry-integration';
import {
  createTimeSeriesPoint,
  type TimeSeriesUploadConfig,
  uploadCIMetrics,
  uploadMetricPoint,
  uploadTimeSeriesBatch,
  uploadWithTransaction,
} from '../time-series-uploader';
import type { PerformanceTimeSeriesPoint } from '../trend-analysis';

// Mock Sentry
jest.mock('@sentry/react-native', () => ({
  setMeasurement: jest.fn(),
  setTag: jest.fn(),
  setContext: jest.fn(),
  startSpan: jest.fn(),
}));
jest.mock('../sentry-integration');

const mockSentry = Sentry as jest.Mocked<typeof Sentry>;
const mockSentryIntegration = SentryIntegration as jest.Mocked<
  typeof SentryIntegration
>;

describe('createTimeSeriesPoint', () => {
  test('creates time series point with current timestamp', () => {
    const before = Date.now();
    const point = createTimeSeriesPoint(
      'startup.tti',
      1500,
      'abc123',
      'Pixel 6a',
      'android'
    );
    const after = Date.now();

    expect(point.metric).toBe('startup.tti');
    expect(point.value).toBe(1500);
    expect(point.buildHash).toBe('abc123');
    expect(point.device).toBe('Pixel 6a');
    expect(point.platform).toBe('android');
    expect(point.timestamp).toBeGreaterThanOrEqual(before);
    expect(point.timestamp).toBeLessThanOrEqual(after);
  });
});

describe('uploadMetricPoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('uploads metric when Sentry is initialized', () => {
    mockSentryIntegration.isSentryPerformanceInitialized.mockReturnValue(true);

    const point: PerformanceTimeSeriesPoint = {
      timestamp: Date.now(),
      metric: 'startup.tti',
      value: 1500,
      buildHash: 'abc123',
      device: 'Pixel 6a',
      platform: 'android',
    };

    const result = uploadMetricPoint(point);

    expect(result).toBe(true);
    expect(mockSentry.setMeasurement).toHaveBeenCalledWith(
      'startup.tti',
      1500,
      'millisecond'
    );
    expect(mockSentry.setTag).toHaveBeenCalledWith('device', 'Pixel 6a');
    expect(mockSentry.setTag).toHaveBeenCalledWith('platform', 'android');
    expect(mockSentry.setTag).toHaveBeenCalledWith('build_hash', 'abc123');
    expect(mockSentry.setContext).toHaveBeenCalled();
  });

  test('returns false when Sentry is not initialized', () => {
    mockSentryIntegration.isSentryPerformanceInitialized.mockReturnValue(false);

    const point: PerformanceTimeSeriesPoint = {
      timestamp: Date.now(),
      metric: 'startup.tti',
      value: 1500,
      buildHash: 'abc123',
      device: 'Pixel 6a',
      platform: 'android',
    };

    const result = uploadMetricPoint(point);

    expect(result).toBe(false);
    expect(mockSentry.setMeasurement).not.toHaveBeenCalled();
  });

  test('handles upload errors gracefully', () => {
    mockSentryIntegration.isSentryPerformanceInitialized.mockReturnValue(true);
    mockSentry.setMeasurement.mockImplementation(() => {
      throw new Error('Upload failed');
    });

    const point: PerformanceTimeSeriesPoint = {
      timestamp: Date.now(),
      metric: 'startup.tti',
      value: 1500,
      buildHash: 'abc123',
      device: 'Pixel 6a',
      platform: 'android',
    };

    const result = uploadMetricPoint(point);

    expect(result).toBe(false);
  });
});

describe('uploadTimeSeriesBatch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('uploads batch of metrics successfully', async () => {
    mockSentryIntegration.isSentryPerformanceInitialized.mockReturnValue(true);

    const points: PerformanceTimeSeriesPoint[] = [
      {
        timestamp: Date.now(),
        metric: 'startup.tti',
        value: 1500,
        buildHash: 'abc123',
        device: 'Pixel 6a',
        platform: 'android',
      },
      {
        timestamp: Date.now(),
        metric: 'scroll.avgFps',
        value: 58,
        buildHash: 'abc123',
        device: 'Pixel 6a',
        platform: 'android',
      },
    ];

    const result = await uploadTimeSeriesBatch(points);

    expect(result.success).toBe(true);
    expect(result.pointsUploaded).toBe(2);
    expect(result.errors).toHaveLength(0);
  });

  test('returns error when Sentry not initialized', async () => {
    mockSentryIntegration.isSentryPerformanceInitialized.mockReturnValue(false);

    const points: PerformanceTimeSeriesPoint[] = [
      {
        timestamp: Date.now(),
        metric: 'startup.tti',
        value: 1500,
        buildHash: 'abc123',
        device: 'Pixel 6a',
        platform: 'android',
      },
    ];

    const result = await uploadTimeSeriesBatch(points);

    expect(result.success).toBe(false);
    expect(result.pointsUploaded).toBe(0);
    expect(result.errors).toContain(
      'Sentry performance monitoring not initialized'
    );
  });

  test('handles batch size configuration', async () => {
    mockSentryIntegration.isSentryPerformanceInitialized.mockReturnValue(true);

    const points: PerformanceTimeSeriesPoint[] = Array.from(
      { length: 100 },
      (_, i) => ({
        timestamp: Date.now(),
        metric: 'test.metric',
        value: i,
        buildHash: 'abc123',
        device: 'test',
        platform: 'android' as const,
      })
    );

    const config: TimeSeriesUploadConfig = {
      batchSize: 25,
    };

    const result = await uploadTimeSeriesBatch(points, config);

    expect(result.pointsUploaded).toBe(100);
  });
});

describe('uploadCIMetrics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('uploads CI metrics from map', async () => {
    mockSentryIntegration.isSentryPerformanceInitialized.mockReturnValue(true);

    const metrics = new Map([
      ['startup.tti', 1500],
      ['scroll.avgFps', 58],
      ['navigation.p95', 200],
    ]);

    const result = await uploadCIMetrics(
      metrics,
      'abc123',
      'Pixel 6a',
      'android'
    );

    expect(result.success).toBe(true);
    expect(result.pointsUploaded).toBe(3);
  });
});

describe('uploadWithTransaction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('uploads metrics within transaction', async () => {
    mockSentryIntegration.isSentryPerformanceInitialized.mockReturnValue(true);
    mockSentry.startSpan.mockImplementation((_config, callback) => {
      return callback({} as any);
    });

    const points: PerformanceTimeSeriesPoint[] = [
      {
        timestamp: Date.now(),
        metric: 'startup.tti',
        value: 1500,
        buildHash: 'abc123',
        device: 'Pixel 6a',
        platform: 'android',
      },
    ];

    const result = await uploadWithTransaction('ci.performance.upload', points);

    expect(result.success).toBe(true);
    expect(mockSentry.startSpan).toHaveBeenCalledWith(
      expect.objectContaining({
        op: 'performance.upload',
        name: 'ci.performance.upload',
      }),
      expect.any(Function)
    );
  });

  test('returns error when Sentry not initialized', async () => {
    mockSentryIntegration.isSentryPerformanceInitialized.mockReturnValue(false);

    const points: PerformanceTimeSeriesPoint[] = [];

    const result = await uploadWithTransaction('test', points);

    expect(result.success).toBe(false);
    expect(mockSentry.startSpan).not.toHaveBeenCalled();
  });
});
