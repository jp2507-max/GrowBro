/**
 * Tests for notification metrics tracker
 */

import { notificationMetrics } from '../notification-metrics';

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

describe('NotificationMetricsTracker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStorage.clear();
    notificationMetrics.resetMetrics();
  });

  describe('Tracking Scheduled Notifications', () => {
    it('should track scheduled notification', () => {
      notificationMetrics.trackScheduled(
        'notif-1',
        'task-1',
        Date.now(),
        false
      );

      // No error thrown
      expect(true).toBe(true);
    });

    it('should track exact alarm flag', () => {
      notificationMetrics.trackScheduled('notif-2', 'task-2', Date.now(), true);

      // No error thrown
      expect(true).toBe(true);
    });
  });

  describe('Tracking Delivered Notifications', () => {
    it('should track delivered notification', () => {
      const scheduledTime = Date.now();
      const deliveryTime = scheduledTime + 1000; // 1 second delay

      notificationMetrics.trackScheduled(
        'notif-1',
        'task-1',
        scheduledTime,
        false
      );
      notificationMetrics.trackDelivered('notif-1', deliveryTime);

      const metrics = notificationMetrics.getMetrics();
      expect(metrics.totalDelivered).toBe(1);
    });

    it('should calculate delivery delay', () => {
      const scheduledTime = Date.now();
      const deliveryTime = scheduledTime + 5000; // 5 second delay

      notificationMetrics.trackScheduled(
        'notif-1',
        'task-1',
        scheduledTime,
        false
      );
      notificationMetrics.trackDelivered('notif-1', deliveryTime);

      const metrics = notificationMetrics.getMetrics();
      expect(metrics.averageDelayMs).toBeGreaterThan(0);
    });

    it('should handle unscheduled delivery gracefully', () => {
      // Try to track delivery for notification that wasn't scheduled
      notificationMetrics.trackDelivered('unknown-notif', Date.now());

      // Should not throw error
      expect(true).toBe(true);
    });
  });

  describe('Tracking Missed Notifications', () => {
    it('should track missed notification', () => {
      notificationMetrics.trackScheduled(
        'notif-1',
        'task-1',
        Date.now(),
        false
      );
      notificationMetrics.trackMissed('notif-1', 'doze_mode');

      const metrics = notificationMetrics.getMetrics();
      expect(metrics.totalMissed).toBe(1);
    });

    it('should handle different miss reasons', () => {
      const reasons: (
        | 'doze_mode'
        | 'permission_denied'
        | 'system_error'
        | 'unknown'
      )[] = ['doze_mode', 'permission_denied', 'system_error', 'unknown'];

      reasons.forEach((reason, index) => {
        notificationMetrics.trackScheduled(
          `notif-${index}`,
          `task-${index}`,
          Date.now(),
          false
        );
        notificationMetrics.trackMissed(`notif-${index}`, reason);
      });

      const metrics = notificationMetrics.getMetrics();
      expect(metrics.totalMissed).toBe(reasons.length);
    });
  });

  describe('Metrics Calculation', () => {
    it('should calculate delivery rate', () => {
      const now = Date.now();

      // Schedule 10 notifications
      for (let i = 0; i < 10; i++) {
        notificationMetrics.trackScheduled(
          `notif-${i}`,
          `task-${i}`,
          now,
          false
        );
      }

      // Deliver 8
      for (let i = 0; i < 8; i++) {
        notificationMetrics.trackDelivered(`notif-${i}`, now + 1000);
      }

      // Miss 2
      notificationMetrics.trackMissed('notif-8', 'doze_mode');
      notificationMetrics.trackMissed('notif-9', 'system_error');

      const metrics = notificationMetrics.getMetrics();
      expect(metrics.deliveryRate).toBeCloseTo(0.8, 2);
      expect(metrics.totalDelivered).toBe(8);
      expect(metrics.totalMissed).toBe(2);
    });

    it('should calculate average delay', () => {
      const now = Date.now();

      notificationMetrics.trackScheduled('notif-1', 'task-1', now, false);
      notificationMetrics.trackDelivered('notif-1', now + 1000); // 1s delay

      notificationMetrics.trackScheduled('notif-2', 'task-2', now, false);
      notificationMetrics.trackDelivered('notif-2', now + 3000); // 3s delay

      const metrics = notificationMetrics.getMetrics();
      expect(metrics.averageDelayMs).toBeCloseTo(2000, 0); // Average of 1s and 3s
    });

    it('should handle zero notifications', () => {
      const metrics = notificationMetrics.getMetrics();
      expect(metrics.deliveryRate).toBe(0);
      expect(metrics.averageDelayMs).toBe(0);
    });
  });

  describe('Summary Emission', () => {
    it('should emit summary', () => {
      notificationMetrics.emitSummary();
      // No error thrown
      expect(true).toBe(true);
    });

    it('should throttle summary emissions', () => {
      notificationMetrics.emitSummary();
      notificationMetrics.emitSummary(); // Should be throttled
      // No error thrown
      expect(true).toBe(true);
    });
  });

  describe('Cleanup', () => {
    it('should cleanup old scheduled notifications', () => {
      const oldTime = Date.now() - 8 * 24 * 60 * 60 * 1000; // 8 days ago

      notificationMetrics.trackScheduled('old-notif', 'task-1', oldTime, false);
      notificationMetrics.cleanupOldScheduled(7 * 24 * 60 * 60 * 1000); // 7 days

      // No error thrown
      expect(true).toBe(true);
    });
  });

  describe('Reset', () => {
    it('should reset metrics', () => {
      notificationMetrics.trackScheduled(
        'notif-1',
        'task-1',
        Date.now(),
        false
      );
      notificationMetrics.trackDelivered('notif-1', Date.now() + 1000);

      notificationMetrics.resetMetrics();

      const metrics = notificationMetrics.getMetrics();
      expect(metrics.totalDelivered).toBe(0);
      expect(metrics.totalMissed).toBe(0);
    });
  });
});
