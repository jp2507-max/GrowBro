/**
 * Tests for community health monitor
 *
 * Requirements: 10.5, 10.6
 */

import { communityHealth } from '../health-monitor';
import type { CommunityMetrics } from '../metrics-tracker';
import { communityMetrics } from '../metrics-tracker';

// Mock Sentry
jest.mock('@sentry/react-native', () => ({
  addBreadcrumb: jest.fn(),
  captureMessage: jest.fn(),
}));

// Mock metrics tracker
jest.mock('../metrics-tracker', () => ({
  communityMetrics: {
    getMetrics: jest.fn(),
  },
}));

describe('CommunityHealthMonitor', () => {
  let monitor: typeof communityHealth;
  let mockGetMetrics: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    monitor = communityHealth;
    mockGetMetrics = communityMetrics.getMetrics as jest.Mock;
  });

  describe('health status determination', () => {
    test('should return healthy when all metrics are within thresholds', () => {
      const mockMetrics: CommunityMetrics = {
        realtime_latency_p50: 800,
        realtime_latency_p95: 1500,
        ws_reconnects_per_session: 1,
        dedupe_drops_per_min: 5,
        outbox_depth: 10,
        outbox_pending: 8,
        outbox_failed: 2,
        undo_usage_rate: 0.8,
        mutation_failure_rate: 0.005,
        last_ws_reconnect_at: Date.now() - 60000,
        last_reconciliation_at: Date.now() - 30000,
      };
      mockGetMetrics.mockReturnValue(mockMetrics);

      const result = monitor.getHealthStatus();

      expect(result.status).toBe('healthy');
      expect(result.alerts).toHaveLength(0);
    });

    test('should return degraded with warning alerts', () => {
      const mockMetrics: CommunityMetrics = {
        realtime_latency_p50: 1000,
        realtime_latency_p95: 2100, // Warning threshold
        ws_reconnects_per_session: 1,
        dedupe_drops_per_min: 3,
        outbox_depth: 35, // Warning threshold
        outbox_pending: 30,
        outbox_failed: 5,
        undo_usage_rate: 0.7,
        mutation_failure_rate: 0.012, // Warning threshold (1.2%)
        last_ws_reconnect_at: Date.now(),
        last_reconciliation_at: Date.now(),
      };
      mockGetMetrics.mockReturnValue(mockMetrics);

      const result = monitor.getHealthStatus();

      expect(result.status).toBe('degraded');
      expect(result.alerts.length).toBeGreaterThan(0);
      expect(result.alerts.every((a) => a.severity === 'warning')).toBe(true);
    });

    test('should return critical with critical alerts', () => {
      const mockMetrics: CommunityMetrics = {
        realtime_latency_p50: 1500,
        realtime_latency_p95: 3500, // Critical threshold exceeded
        ws_reconnects_per_session: 6, // Critical threshold exceeded
        dedupe_drops_per_min: 10,
        outbox_depth: 55, // Critical threshold exceeded
        outbox_pending: 45,
        outbox_failed: 10,
        undo_usage_rate: 0.5,
        mutation_failure_rate: 0.025, // Critical threshold exceeded (2.5%)
        last_ws_reconnect_at: Date.now(),
        last_reconciliation_at: Date.now(),
      };
      mockGetMetrics.mockReturnValue(mockMetrics);

      const result = monitor.getHealthStatus();

      expect(result.status).toBe('critical');
      expect(result.alerts.some((a) => a.severity === 'critical')).toBe(true);
    });
  });

  describe('alert generation', () => {
    test('should generate P95 latency alert when exceeding 3s', () => {
      const mockMetrics: CommunityMetrics = {
        realtime_latency_p50: 1000,
        realtime_latency_p95: 3200,
        ws_reconnects_per_session: 0,
        dedupe_drops_per_min: 0,
        outbox_depth: 0,
        outbox_pending: 0,
        outbox_failed: 0,
        undo_usage_rate: 1,
        mutation_failure_rate: 0,
        last_ws_reconnect_at: null,
        last_reconciliation_at: null,
      };
      mockGetMetrics.mockReturnValue(mockMetrics);

      const result = monitor.getHealthStatus();

      const latencyAlert = result.alerts.find(
        (a) => a.metric === 'realtime_latency_p95'
      );
      expect(latencyAlert).toBeDefined();
      expect(latencyAlert?.severity).toBe('critical');
      expect(latencyAlert?.threshold).toBe(3000);
      expect(latencyAlert?.actual).toBe(3200);
    });

    test('should generate outbox depth alert when exceeding 50', () => {
      const mockMetrics: CommunityMetrics = {
        realtime_latency_p50: 500,
        realtime_latency_p95: 1000,
        ws_reconnects_per_session: 0,
        dedupe_drops_per_min: 0,
        outbox_depth: 52,
        outbox_pending: 50,
        outbox_failed: 2,
        undo_usage_rate: 1,
        mutation_failure_rate: 0,
        last_ws_reconnect_at: null,
        last_reconciliation_at: null,
      };
      mockGetMetrics.mockReturnValue(mockMetrics);

      const result = monitor.getHealthStatus();

      const outboxAlert = result.alerts.find(
        (a) => a.metric === 'outbox_depth'
      );
      expect(outboxAlert).toBeDefined();
      expect(outboxAlert?.severity).toBe('critical');
      expect(outboxAlert?.threshold).toBe(50);
      expect(outboxAlert?.actual).toBe(52);
    });

    test('should generate mutation failure rate alert when exceeding 2%', () => {
      const mockMetrics: CommunityMetrics = {
        realtime_latency_p50: 500,
        realtime_latency_p95: 1000,
        ws_reconnects_per_session: 0,
        dedupe_drops_per_min: 0,
        outbox_depth: 0,
        outbox_pending: 0,
        outbox_failed: 0,
        undo_usage_rate: 1,
        mutation_failure_rate: 0.025, // 2.5%
        last_ws_reconnect_at: null,
        last_reconciliation_at: null,
      };
      mockGetMetrics.mockReturnValue(mockMetrics);

      const result = monitor.getHealthStatus();

      const failureAlert = result.alerts.find(
        (a) => a.metric === 'mutation_failure_rate'
      );
      expect(failureAlert).toBeDefined();
      expect(failureAlert?.severity).toBe('critical');
      expect(failureAlert?.threshold).toBe(0.02);
      expect(failureAlert?.actual).toBe(0.025);
    });

    test('should generate WebSocket reconnection alert', () => {
      const mockMetrics: CommunityMetrics = {
        realtime_latency_p50: 500,
        realtime_latency_p95: 1000,
        ws_reconnects_per_session: 4,
        dedupe_drops_per_min: 0,
        outbox_depth: 0,
        outbox_pending: 0,
        outbox_failed: 0,
        undo_usage_rate: 1,
        mutation_failure_rate: 0,
        last_ws_reconnect_at: Date.now(),
        last_reconciliation_at: null,
      };
      mockGetMetrics.mockReturnValue(mockMetrics);

      const result = monitor.getHealthStatus();

      const wsAlert = result.alerts.find(
        (a) => a.metric === 'ws_reconnects_per_session'
      );
      expect(wsAlert).toBeDefined();
      expect(wsAlert?.severity).toBe('warning');
    });
  });

  describe('Sentry integration', () => {
    test('should not report to Sentry when healthy', async () => {
      const mockMetrics: CommunityMetrics = {
        realtime_latency_p50: 500,
        realtime_latency_p95: 1000,
        ws_reconnects_per_session: 0,
        dedupe_drops_per_min: 0,
        outbox_depth: 0,
        outbox_pending: 0,
        outbox_failed: 0,
        undo_usage_rate: 1,
        mutation_failure_rate: 0,
        last_ws_reconnect_at: null,
        last_reconciliation_at: null,
      };
      mockGetMetrics.mockReturnValue(mockMetrics);

      const result = monitor.getHealthStatus();
      await monitor.reportToSentry(result);

      const Sentry = await import('@sentry/react-native');
      expect(Sentry.addBreadcrumb).not.toHaveBeenCalled();
      expect(Sentry.captureMessage).not.toHaveBeenCalled();
    });

    test('should report degraded status to Sentry', async () => {
      const mockMetrics: CommunityMetrics = {
        realtime_latency_p50: 1000,
        realtime_latency_p95: 2200,
        ws_reconnects_per_session: 0,
        dedupe_drops_per_min: 0,
        outbox_depth: 0,
        outbox_pending: 0,
        outbox_failed: 0,
        undo_usage_rate: 1,
        mutation_failure_rate: 0,
        last_ws_reconnect_at: null,
        last_reconciliation_at: null,
      };
      mockGetMetrics.mockReturnValue(mockMetrics);

      const result = monitor.getHealthStatus();
      await monitor.reportToSentry(result);

      const Sentry = await import('@sentry/react-native');
      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'community.health',
          message: 'Health status: degraded',
          level: 'warning',
        })
      );
    });

    test('should capture critical alerts as Sentry messages', async () => {
      const mockMetrics: CommunityMetrics = {
        realtime_latency_p50: 1500,
        realtime_latency_p95: 3500,
        ws_reconnects_per_session: 0,
        dedupe_drops_per_min: 0,
        outbox_depth: 0,
        outbox_pending: 0,
        outbox_failed: 0,
        undo_usage_rate: 1,
        mutation_failure_rate: 0,
        last_ws_reconnect_at: null,
        last_reconciliation_at: null,
      };
      mockGetMetrics.mockReturnValue(mockMetrics);

      const result = monitor.getHealthStatus();
      await monitor.reportToSentry(result);

      const Sentry = await import('@sentry/react-native');
      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        expect.stringContaining('Real-time latency P95 exceeds 3s threshold'),
        expect.objectContaining({
          level: 'warning',
          tags: expect.objectContaining({
            category: 'community_health',
            metric: 'realtime_latency_p95',
          }),
        })
      );
    });

    test('should sanitize metrics for privacy', async () => {
      const mockMetrics: CommunityMetrics = {
        realtime_latency_p50: 500,
        realtime_latency_p95: 2200,
        ws_reconnects_per_session: 2,
        dedupe_drops_per_min: 5,
        outbox_depth: 10,
        outbox_pending: 8,
        outbox_failed: 2,
        undo_usage_rate: 0.75,
        mutation_failure_rate: 0.01,
        last_ws_reconnect_at: Date.now() - 60000,
        last_reconciliation_at: Date.now() - 30000,
      };
      mockGetMetrics.mockReturnValue(mockMetrics);

      const result = monitor.getHealthStatus();
      await monitor.reportToSentry(result);

      const Sentry = await import('@sentry/react-native');
      const breadcrumbCall = (Sentry.addBreadcrumb as jest.Mock).mock
        .calls[0][0];

      // Should only contain operational metrics, no PII
      expect(breadcrumbCall.data).toHaveProperty('latency_p50');
      expect(breadcrumbCall.data).toHaveProperty('latency_p95');
      expect(breadcrumbCall.data).toHaveProperty('ws_reconnects');
      expect(breadcrumbCall.data).toHaveProperty('outbox_depth');
      expect(breadcrumbCall.data).not.toHaveProperty('user_id');
      expect(breadcrumbCall.data).not.toHaveProperty('email');
    });
  });

  describe('singleton instance', () => {
    test('should export singleton instance', () => {
      expect(communityHealth).toBeDefined();
      expect(typeof communityHealth.getHealthStatus).toBe('function');
    });
  });
});
