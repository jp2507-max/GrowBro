/**
 * Tests for metrics aggregator
 */

import { metricsAggregator } from '../metrics-aggregator';
import { notificationMetrics } from '../notification-metrics';
import { syncMetrics } from '../sync-metrics';

// Mock MMKV with in-memory storage
const mockStorage = new Map<string, string | number>();

jest.mock('react-native-mmkv', () => ({
  MMKV: jest.fn().mockImplementation(() => ({
    getString: jest.fn(
      (key: string) => mockStorage.get(key) as string | undefined
    ),
    getNumber: jest.fn(
      (key: string) => mockStorage.get(key) as number | undefined
    ),
    set: jest.fn((key: string, value: string | number) =>
      mockStorage.set(key, value)
    ),
    delete: jest.fn((key: string) => mockStorage.delete(key)),
  })),
}));

// Mock analytics service
jest.mock('../service', () => ({
  analyticsService: {
    track: jest.fn(),
  },
}));

describe('MetricsAggregator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStorage.clear();
    notificationMetrics.resetMetrics();
    syncMetrics.resetMetrics();
  });

  describe('Aggregated Metrics', () => {
    it('should get aggregated metrics', () => {
      const metrics = metricsAggregator.getAggregatedMetrics();

      expect(metrics).toHaveProperty('notifications');
      expect(metrics).toHaveProperty('sync');
      expect(metrics).toHaveProperty('conflicts');
      expect(metrics).toHaveProperty('timestamp');
    });

    it('should include all metric types', () => {
      const metrics = metricsAggregator.getAggregatedMetrics();

      expect(metrics.notifications).toHaveProperty('deliveryRate');
      expect(metrics.sync).toHaveProperty('failRate');
      expect(metrics.conflicts).toHaveProperty('totalConflicts');
    });
  });

  describe('Health Status', () => {
    it('should report healthy status with good metrics', () => {
      // Simulate good metrics
      const now = Date.now();
      for (let i = 0; i < 10; i++) {
        notificationMetrics.trackScheduled(
          `notif-${i}`,
          `task-${i}`,
          now,
          false
        );
        notificationMetrics.trackDelivered(`notif-${i}`, now + 1000);
      }

      for (let i = 0; i < 10; i++) {
        syncMetrics.trackSyncStart(`sync-${i}`, 'full');
        syncMetrics.trackSyncComplete(`sync-${i}`, 5);
      }

      const health = metricsAggregator.getHealthStatus();
      expect(health.overall).toBe('healthy');
      expect(health.notifications).toBe('healthy');
      expect(health.sync).toBe('healthy');
      expect(health.issues).toHaveLength(0);
    });

    it('should report degraded status with low delivery rate', () => {
      const now = Date.now();

      // 90% delivery rate (below 95% threshold)
      for (let i = 0; i < 20; i++) {
        notificationMetrics.trackScheduled(
          `notif-${i}`,
          `task-${i}`,
          now,
          false
        );
      }
      for (let i = 0; i < 18; i++) {
        notificationMetrics.trackDelivered(`notif-${i}`, now + 1000);
      }
      notificationMetrics.trackMissed('notif-18', 'doze_mode');
      notificationMetrics.trackMissed('notif-19', 'system_error');

      const health = metricsAggregator.getHealthStatus();
      expect(health.notifications).toBe('degraded');
      expect(health.issues.length).toBeGreaterThan(0);
    });

    it('should report unhealthy status with very low delivery rate', () => {
      const now = Date.now();

      // 80% delivery rate (below 85% threshold)
      for (let i = 0; i < 20; i++) {
        notificationMetrics.trackScheduled(
          `notif-${i}`,
          `task-${i}`,
          now,
          false
        );
      }
      for (let i = 0; i < 16; i++) {
        notificationMetrics.trackDelivered(`notif-${i}`, now + 1000);
      }
      for (let i = 16; i < 20; i++) {
        notificationMetrics.trackMissed(`notif-${i}`, 'doze_mode');
      }

      const health = metricsAggregator.getHealthStatus();
      expect(health.notifications).toBe('unhealthy');
    });

    it('should report degraded status with high sync failure rate', () => {
      // 15% failure rate (above 10% threshold)
      for (let i = 0; i < 20; i++) {
        syncMetrics.trackSyncStart(`sync-${i}`, 'full');
        if (i < 17) {
          syncMetrics.trackSyncComplete(`sync-${i}`, 5);
        } else {
          syncMetrics.trackSyncFail(`sync-${i}`, 'NETWORK_ERROR', true);
        }
      }

      const health = metricsAggregator.getHealthStatus();
      expect(health.sync).toBe('degraded');
      expect(health.issues.length).toBeGreaterThan(0);
    });

    it('should report unhealthy status with very high sync failure rate', () => {
      // 30% failure rate (above 25% threshold)
      for (let i = 0; i < 20; i++) {
        syncMetrics.trackSyncStart(`sync-${i}`, 'full');
        if (i < 14) {
          syncMetrics.trackSyncComplete(`sync-${i}`, 5);
        } else {
          syncMetrics.trackSyncFail(`sync-${i}`, 'NETWORK_ERROR', true);
        }
      }

      const health = metricsAggregator.getHealthStatus();
      expect(health.sync).toBe('unhealthy');
    });
  });

  describe('Metrics Report', () => {
    it('should generate metrics report', () => {
      const report = metricsAggregator.getMetricsReport();

      expect(report).toContain('Playbook Metrics Report');
      expect(report).toContain('Overall Health');
      expect(report).toContain('Notifications');
      expect(report).toContain('Sync');
      expect(report).toContain('Conflicts');
    });

    it('should include health issues in report', () => {
      const now = Date.now();

      // Create low delivery rate
      for (let i = 0; i < 20; i++) {
        notificationMetrics.trackScheduled(
          `notif-${i}`,
          `task-${i}`,
          now,
          false
        );
      }
      for (let i = 0; i < 16; i++) {
        notificationMetrics.trackDelivered(`notif-${i}`, now + 1000);
      }
      for (let i = 16; i < 20; i++) {
        notificationMetrics.trackMissed(`notif-${i}`, 'doze_mode');
      }

      const report = metricsAggregator.getMetricsReport();
      expect(report).toContain('Issues');
    });
  });

  describe('Summary Emission', () => {
    it('should emit summary', () => {
      metricsAggregator.emitSummary();
      // No error thrown
      expect(true).toBe(true);
    });
  });

  describe('Reset', () => {
    it('should reset all metrics', () => {
      const now = Date.now();

      notificationMetrics.trackScheduled('notif-1', 'task-1', now, false);
      notificationMetrics.trackDelivered('notif-1', now + 1000);

      syncMetrics.trackSyncStart('sync-1', 'full');
      syncMetrics.trackSyncComplete('sync-1', 5);

      metricsAggregator.resetAllMetrics();

      const metrics = metricsAggregator.getAggregatedMetrics();
      expect(metrics.notifications.totalDelivered).toBe(0);
      expect(metrics.sync.totalSyncs).toBe(0);
    });
  });
});
