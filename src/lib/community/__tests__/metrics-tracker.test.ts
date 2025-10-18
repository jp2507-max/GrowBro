/**
 * Tests for community metrics tracker
 *
 * Requirements: 9.6, 10.5
 */

// import { communityMetrics } from '../metrics-tracker'; // Defer importing the tracker until beforeEach to ensure fresh mocks

// Mock MMKV
jest.mock('react-native-mmkv', () => ({
  MMKV: jest.fn().mockImplementation(() => ({
    set: jest.fn(),
    getString: jest.fn(),
    getNumber: jest.fn(),
    clearAll: jest.fn(),
  })),
}));

describe('CommunityMetricsTracker', () => {
  let tracker: any;
  let mockStorage: any;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.isolateModules(() => {
      // Re-require after mocks/reset

      const { communityMetrics } = require('../metrics-tracker');
      tracker = communityMetrics;
      // Access the mock storage instance

      const { MMKV } = require('react-native-mmkv');
      mockStorage = (MMKV as jest.Mock).mock.results[0].value;
    });
    // Set default mock return values
    mockStorage.getString.mockImplementation(() => undefined);
    mockStorage.getNumber.mockImplementation(() => 0);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('latency tracking', () => {
    test('should add latency samples', () => {
      tracker.addLatencySample(1200);
      tracker.addLatencySample(800);
      tracker.addLatencySample(1500);

      expect(mockStorage.set).toHaveBeenCalledWith(
        'latency_samples',
        expect.any(String)
      );
    });

    test('should calculate P50 percentile correctly', () => {
      // Mock stored samples
      const samples = [
        { timestamp: Date.now(), latency_ms: 500 },
        { timestamp: Date.now(), latency_ms: 1000 },
        { timestamp: Date.now(), latency_ms: 1500 },
        { timestamp: Date.now(), latency_ms: 2000 },
        { timestamp: Date.now(), latency_ms: 2500 },
      ];
      mockStorage.getString.mockImplementation((key: string) =>
        key === 'latency_samples' ? JSON.stringify(samples) : undefined
      );

      const metrics = tracker.getMetrics();

      // P50 should be around 1500
      expect(metrics.realtime_latency_p50).toBeGreaterThanOrEqual(1000);
      expect(metrics.realtime_latency_p50).toBeLessThanOrEqual(2000);
    });

    test('should calculate P95 percentile correctly', () => {
      // Mock stored samples with mostly fast, some slow
      const samples = Array.from({ length: 100 }, (_, i) => ({
        timestamp: Date.now(),
        latency_ms: i < 95 ? 1000 : 3000, // 95% at 1s, 5% at 3s
      }));
      mockStorage.getString.mockImplementation((key: string) =>
        key === 'latency_samples' ? JSON.stringify(samples) : undefined
      );

      const metrics = tracker.getMetrics();

      // P95 should be 1000ms since 95% of samples are at 1000ms
      expect(metrics.realtime_latency_p95).toBe(1000);
    });

    test('should handle empty samples gracefully', () => {
      mockStorage.getString.mockReturnValue(undefined);

      const metrics = tracker.getMetrics();

      expect(metrics.realtime_latency_p50).toBe(0);
      expect(metrics.realtime_latency_p95).toBe(0);
    });

    test('should limit samples to MAX_LATENCY_SAMPLES', () => {
      // Add more than 100 samples
      for (let i = 0; i < 150; i++) {
        tracker.addLatencySample(i * 10);
      }

      const setCalls = mockStorage.set.mock.calls.filter(
        (call: any) => call[0] === 'latency_samples'
      );
      const lastCall = setCalls[setCalls.length - 1];
      const stored = JSON.parse(lastCall[1]);

      // Should keep only last 100
      expect(stored.length).toBeLessThanOrEqual(100);
    });
  });

  describe('reconnection tracking', () => {
    test('should increment reconnect counter', () => {
      mockStorage.getNumber.mockImplementation(() => 2);

      tracker.recordReconnect();

      expect(mockStorage.set).toHaveBeenCalledWith('ws_reconnects', 3);
      expect(mockStorage.set).toHaveBeenCalledWith(
        'last_ws_reconnect',
        expect.any(Number)
      );
    });

    test('should reset session counters', () => {
      tracker.resetSessionCounters();

      expect(mockStorage.set).toHaveBeenCalledWith('ws_reconnects', 0);
    });

    test('should track last reconnect timestamp', () => {
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);

      tracker.recordReconnect();

      expect(mockStorage.set).toHaveBeenCalledWith('last_ws_reconnect', now);
    });
  });

  describe('deduplication tracking', () => {
    test('should record dedupe drops', () => {
      tracker.recordDedupeDrop();
      tracker.recordDedupeDrop();

      expect(mockStorage.set).toHaveBeenCalledWith(
        'dedupe_drops',
        expect.any(String)
      );
    });

    test('should calculate drops per minute', () => {
      const now = Date.now();
      const drops = [
        { timestamp: now - 30000, count: 1 }, // 30s ago
        { timestamp: now - 45000, count: 1 }, // 45s ago
        { timestamp: now - 90000, count: 1 }, // 90s ago (should be excluded)
      ];
      mockStorage.getString.mockImplementation((key: string) =>
        key === 'dedupe_drops' ? JSON.stringify(drops) : undefined
      );

      const metrics = tracker.getMetrics();

      // Should count only drops within last minute
      expect(metrics.dedupe_drops_per_min).toBe(2);
    });
  });

  describe('outbox metrics', () => {
    test('should update outbox metrics', () => {
      const metrics = {
        depth: 10,
        pending: 5,
        failed: 2,
        confirmed: 3,
      };

      tracker.updateOutboxMetrics(metrics);

      expect(mockStorage.set).toHaveBeenCalledWith(
        'outbox_metrics',
        JSON.stringify(metrics)
      );
    });

    test('should return outbox metrics in getMetrics', () => {
      const storedMetrics = {
        depth: 10,
        pending: 5,
        failed: 2,
        confirmed: 3,
      };
      mockStorage.getString.mockImplementation((key: string) =>
        key === 'outbox_metrics' ? JSON.stringify(storedMetrics) : undefined
      );

      const metrics = tracker.getMetrics();

      expect(metrics.outbox_depth).toBe(10);
      expect(metrics.outbox_pending).toBe(5);
      expect(metrics.outbox_failed).toBe(2);
    });
  });

  describe('undo action tracking', () => {
    test('should record successful undo actions', () => {
      tracker.recordUndoAction(true);
      tracker.recordUndoAction(true);
      tracker.recordUndoAction(false);

      expect(mockStorage.set).toHaveBeenCalledWith(
        'undo_actions',
        expect.any(String)
      );
    });

    test('should calculate undo success rate', () => {
      const actions = [
        { timestamp: Date.now(), count: 1 }, // success
        { timestamp: Date.now(), count: 1 }, // success
        { timestamp: Date.now(), count: 0 }, // failure
        { timestamp: Date.now(), count: 1 }, // success
      ];
      mockStorage.getString.mockImplementation((key: string) =>
        key === 'undo_actions' ? JSON.stringify(actions) : undefined
      );

      const metrics = tracker.getMetrics();

      // 3 successes out of 4 = 0.75
      expect(metrics.undo_usage_rate).toBe(0.75);
    });
  });

  describe('mutation failure tracking', () => {
    test('should record mutation failures', () => {
      tracker.recordMutationFailure(true);
      tracker.recordMutationFailure(false);
      tracker.recordMutationFailure(false);

      expect(mockStorage.set).toHaveBeenCalledWith(
        'mutation_failures',
        expect.any(String)
      );
    });

    test('should calculate failure rate correctly', () => {
      const failures = [
        { timestamp: Date.now(), count: 1 }, // failed
        { timestamp: Date.now(), count: 0 }, // success
        { timestamp: Date.now(), count: 0 }, // success
        { timestamp: Date.now(), count: 1 }, // failed
        { timestamp: Date.now(), count: 0 }, // success
      ];
      mockStorage.getString.mockImplementation((key: string) =>
        key === 'mutation_failures' ? JSON.stringify(failures) : undefined
      );

      const metrics = tracker.getMetrics();

      // 2 failures out of 5 = 0.4 (40%)
      expect(metrics.mutation_failure_rate).toBe(0.4);
    });

    test('should meet <2% failure rate requirement', () => {
      // Simulate 98 successes and 2 failures
      const failures = [
        ...Array(98).fill({ timestamp: Date.now(), count: 0 }),
        ...Array(2).fill({ timestamp: Date.now(), count: 1 }),
      ];
      mockStorage.getString.mockImplementation((key: string) =>
        key === 'mutation_failures' ? JSON.stringify(failures) : undefined
      );

      const metrics = tracker.getMetrics();

      // Should be exactly 2% (0.02)
      expect(metrics.mutation_failure_rate).toBe(0.02);
      expect(metrics.mutation_failure_rate).toBeLessThanOrEqual(0.02);
    });
  });

  describe('reconciliation tracking', () => {
    test('should record reconciliation timestamp', () => {
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);

      tracker.recordReconciliation();

      expect(mockStorage.set).toHaveBeenCalledWith('last_reconciliation', now);
    });
  });

  describe('singleton instance', () => {
    test('should export singleton instance', () => {
      expect(tracker).toBeDefined();
      expect(typeof tracker.getMetrics).toBe('function');
    });
  });

  describe('clear functionality', () => {
    test('should clear all stored metrics', () => {
      tracker.clear();

      expect(mockStorage.clearAll).toHaveBeenCalled();
    });
  });
});
