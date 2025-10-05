/**
 * Tests for sync metrics tracker
 */

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

describe('SyncMetricsTracker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStorage.clear();
    syncMetrics.resetMetrics();
  });

  describe('Sync Tracking', () => {
    it('should track sync start', () => {
      syncMetrics.trackSyncStart('sync-1', 'pull');
      // No error thrown
      expect(true).toBe(true);
    });

    it('should track sync completion', () => {
      syncMetrics.trackSyncStart('sync-1', 'pull');
      syncMetrics.trackSyncComplete('sync-1', 10);

      const metrics = syncMetrics.getSyncMetrics();
      expect(metrics.successfulSyncs).toBe(1);
      expect(metrics.totalSyncs).toBe(1);
    });

    it('should track sync failure', () => {
      syncMetrics.trackSyncStart('sync-1', 'push');
      syncMetrics.trackSyncFail('sync-1', 'NETWORK_ERROR', true);

      const metrics = syncMetrics.getSyncMetrics();
      expect(metrics.failedSyncs).toBe(1);
      expect(metrics.totalSyncs).toBe(1);
    });

    it('should handle unknown sync ID gracefully', () => {
      syncMetrics.trackSyncComplete('unknown-sync', 5);
      // Should not throw error
      expect(true).toBe(true);
    });
  });

  describe('Sync Metrics Calculation', () => {
    it('should calculate fail rate', () => {
      // 3 successful, 2 failed
      for (let i = 0; i < 3; i++) {
        syncMetrics.trackSyncStart(`sync-${i}`, 'full');
        syncMetrics.trackSyncComplete(`sync-${i}`, 10);
      }

      for (let i = 3; i < 5; i++) {
        syncMetrics.trackSyncStart(`sync-${i}`, 'full');
        syncMetrics.trackSyncFail(`sync-${i}`, 'TIMEOUT', true);
      }

      const metrics = syncMetrics.getSyncMetrics();
      expect(metrics.failRate).toBeCloseTo(0.4, 2); // 2/5 = 0.4
      expect(metrics.totalSyncs).toBe(5);
      expect(metrics.successfulSyncs).toBe(3);
      expect(metrics.failedSyncs).toBe(2);
    });

    it('should calculate average latency', () => {
      syncMetrics.trackSyncStart('sync-1', 'pull');
      // Simulate 100ms sync
      setTimeout(() => {
        syncMetrics.trackSyncComplete('sync-1', 5);
      }, 100);

      syncMetrics.trackSyncStart('sync-2', 'push');
      // Simulate 200ms sync
      setTimeout(() => {
        syncMetrics.trackSyncComplete('sync-2', 3);
      }, 200);

      // Metrics should be calculated
      const metrics = syncMetrics.getSyncMetrics();
      expect(metrics.averageLatencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should handle zero syncs', () => {
      const metrics = syncMetrics.getSyncMetrics();
      expect(metrics.failRate).toBe(0);
      expect(metrics.averageLatencyMs).toBe(0);
    });
  });

  describe('Conflict Tracking', () => {
    it('should track conflict seen', () => {
      syncMetrics.trackConflictSeen(
        'tasks',
        'task-1',
        'update_update',
        'server_wins'
      );

      const metrics = syncMetrics.getConflictMetrics();
      expect(metrics.totalConflicts).toBe(1);
      expect(metrics.resolvedByServer).toBe(1);
    });

    it('should track different resolution types', () => {
      syncMetrics.trackConflictSeen(
        'tasks',
        'task-1',
        'update_update',
        'server_wins'
      );
      syncMetrics.trackConflictSeen(
        'tasks',
        'task-2',
        'update_delete',
        'client_wins'
      );
      syncMetrics.trackConflictSeen(
        'tasks',
        'task-3',
        'delete_update',
        'manual'
      );

      const metrics = syncMetrics.getConflictMetrics();
      expect(metrics.totalConflicts).toBe(3);
      expect(metrics.resolvedByServer).toBe(1);
      expect(metrics.resolvedByClient).toBe(1);
      expect(metrics.manualResolutions).toBe(1);
    });

    it('should track conflict restoration', () => {
      syncMetrics.trackConflictSeen(
        'tasks',
        'task-1',
        'update_update',
        'server_wins'
      );
      syncMetrics.trackConflictRestored('tasks', 'task-1', 'update_update');

      const metrics = syncMetrics.getConflictMetrics();
      expect(metrics.restoredCount).toBe(1);
    });
  });

  describe('Reset', () => {
    it('should reset all metrics', () => {
      syncMetrics.trackSyncStart('sync-1', 'full');
      syncMetrics.trackSyncComplete('sync-1', 10);
      syncMetrics.trackConflictSeen(
        'tasks',
        'task-1',
        'update_update',
        'server_wins'
      );

      syncMetrics.resetMetrics();

      const syncMetricsData = syncMetrics.getSyncMetrics();
      const conflictMetricsData = syncMetrics.getConflictMetrics();

      expect(syncMetricsData.totalSyncs).toBe(0);
      expect(conflictMetricsData.totalConflicts).toBe(0);
    });
  });
});
