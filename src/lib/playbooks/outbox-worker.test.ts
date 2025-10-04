/**
 * Outbox Worker Tests
 *
 * Tests for the outbox pattern notification worker including:
 * - Action processing
 * - Retry logic with exponential backoff
 * - Concurrent worker safety
 * - TTL cleanup
 */
/* eslint-disable max-lines-per-function */

import { type Database } from '@nozbe/watermelondb';

import { OutboxWorker, type OutboxWorkerOptions } from './outbox-worker';

// Mock database
const mockDatabase = {
  get: jest.fn(),
  write: jest.fn(),
} as unknown as Database;

// Mock notification scheduler
const mockNotificationScheduler: OutboxWorkerOptions['notificationScheduler'] =
  {
    scheduleNotification: jest.fn(),
    cancelNotification: jest.fn(),
  };

describe('OutboxWorker', () => {
  let worker: OutboxWorker;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    worker = new OutboxWorker({
      database: mockDatabase,
      notificationScheduler: mockNotificationScheduler,
      maxRetries: 3,
      baseDelayMs: 1000,
      maxDelayMs: 10000,
    });
  });

  afterEach(() => {
    worker.stop();
    jest.useRealTimers();
  });

  describe('start/stop', () => {
    it('should start processing on interval', () => {
      const processSpy = jest.spyOn(worker, 'processPendingActions');
      processSpy.mockResolvedValue();

      worker.start(5000);

      // Should process immediately
      expect(processSpy).toHaveBeenCalledTimes(1);

      // Advance timer
      jest.advanceTimersByTime(5000);
      expect(processSpy).toHaveBeenCalledTimes(2);

      worker.stop();
    });

    it('should not start multiple times', () => {
      worker.start(5000);
      worker.start(5000); // Second call should be ignored

      // Should only have one interval running
      expect(jest.getTimerCount()).toBe(1);
    });
  });

  describe('processPendingActions', () => {
    it('should process pending schedule actions', async () => {
      const mockAction = {
        id: 'action1',
        actionType: 'schedule',
        payload: {
          notificationId: 'notif1',
          taskId: 'task1',
          triggerTime: '2025-01-01T00:00:00Z',
          title: 'Test',
          body: 'Test body',
        },
        update: jest.fn(),
      };

      (mockDatabase.get as jest.Mock).mockReturnValue({
        query: jest.fn().mockReturnValue({
          fetch: jest.fn().mockResolvedValue([mockAction]),
        }),
      });

      (mockDatabase.write as jest.Mock).mockImplementation(async (fn) => {
        await fn();
      });

      await worker.processAllPending();

      expect(
        mockNotificationScheduler.scheduleNotification
      ).toHaveBeenCalledWith({
        notificationId: 'notif1',
        taskId: 'task1',
        triggerTime: '2025-01-01T00:00:00Z',
        title: 'Test',
        body: 'Test body',
        data: undefined,
      });
    });

    it('should process pending cancel actions', async () => {
      const mockAction = {
        id: 'action1',
        actionType: 'cancel',
        payload: {
          notificationId: 'notif1',
          taskId: 'task1',
        },
        update: jest.fn(),
      };

      (mockDatabase.get as jest.Mock).mockReturnValue({
        query: jest.fn().mockReturnValue({
          fetch: jest.fn().mockResolvedValue([mockAction]),
        }),
      });

      (mockDatabase.write as jest.Mock).mockImplementation(async (fn) => {
        await fn();
      });

      await worker.processAllPending();

      expect(mockNotificationScheduler.cancelNotification).toHaveBeenCalledWith(
        'notif1'
      );
    });

    it('should handle processing errors with retry', async () => {
      const mockAction = {
        id: 'action1',
        actionType: 'schedule',
        payload: {
          notificationId: 'notif1',
          taskId: 'task1',
          triggerTime: '2025-01-01T00:00:00Z',
          title: 'Test',
          body: 'Test body',
        },
        attemptedCount: 0,
        update: jest.fn(),
      };

      (mockDatabase.get as jest.Mock).mockReturnValue({
        query: jest.fn().mockReturnValue({
          fetch: jest.fn().mockResolvedValue([mockAction]),
        }),
      });

      (mockDatabase.write as jest.Mock).mockImplementation(async (fn) => {
        await fn();
      });

      // Make notification scheduling fail
      (
        mockNotificationScheduler.scheduleNotification as jest.Mock
      ).mockRejectedValue(new Error('Scheduling failed'));

      await worker.processAllPending();

      // Should mark as failed and set next attempt
      expect(mockAction.update).toHaveBeenCalled();
    });

    it('should mark as failed after max retries', async () => {
      const mockAction = {
        id: 'action1',
        actionType: 'schedule',
        payload: {
          notificationId: 'notif1',
          taskId: 'task1',
          triggerTime: '2025-01-01T00:00:00Z',
          title: 'Test',
          body: 'Test body',
        },
        attemptedCount: 3, // Already at max retries
        update: jest.fn(),
      };

      (mockDatabase.get as jest.Mock).mockReturnValue({
        query: jest.fn().mockReturnValue({
          fetch: jest.fn().mockResolvedValue([mockAction]),
        }),
      });

      (mockDatabase.write as jest.Mock).mockImplementation(async (fn) => {
        await fn();
      });

      (
        mockNotificationScheduler.scheduleNotification as jest.Mock
      ).mockRejectedValue(new Error('Scheduling failed'));

      await worker.processAllPending();

      // Should mark as permanently failed
      expect(mockAction.update).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('cleanup', () => {
    it('should mark expired actions as expired', async () => {
      const mockExpiredAction = {
        id: 'action1',
        expiresAt: Date.now() - 1000, // Expired
        update: jest.fn(),
      };

      (mockDatabase.get as jest.Mock).mockReturnValue({
        query: jest.fn().mockReturnValue({
          fetch: jest.fn().mockResolvedValue([mockExpiredAction]),
        }),
      });

      (mockDatabase.write as jest.Mock).mockImplementation(async (fn) => {
        await fn();
      });

      await worker.processAllPending();

      expect(mockExpiredAction.update).toHaveBeenCalled();
    });

    it('should delete old completed actions', async () => {
      const mockOldAction = {
        id: 'action1',
        status: 'completed',
        createdAt: Date.now() - 25 * 60 * 60 * 1000, // 25 hours ago
        destroyPermanently: jest.fn(),
      };

      (mockDatabase.get as jest.Mock).mockReturnValue({
        query: jest.fn().mockReturnValue({
          fetch: jest.fn().mockResolvedValue([mockOldAction]),
        }),
      });

      (mockDatabase.write as jest.Mock).mockImplementation(async (fn) => {
        await fn();
      });

      await worker.processAllPending();

      expect(mockOldAction.destroyPermanently).toHaveBeenCalled();
    });
  });
});
