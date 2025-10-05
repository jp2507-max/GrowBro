/* eslint-disable @typescript-eslint/no-require-imports */
import { Platform } from 'react-native';

import { AndroidExactAlarmCoordinator } from '@/lib/notifications/android-exact-alarm-service';
import { LocalNotificationService } from '@/lib/notifications/local-service';
import {
  getPlaybookNotificationScheduler,
  PlaybookNotificationScheduler,
} from '@/lib/notifications/playbook-notification-scheduler';
import { PermissionManager } from '@/lib/permissions/permission-manager';

// Mock dependencies
jest.mock('@/lib/notifications/android-exact-alarm-service');
jest.mock('@/lib/notifications/local-service');
jest.mock('@/lib/permissions/permission-manager');
jest.mock('@/lib/notifications/android-channels', () => ({
  registerAndroidChannels: jest.fn().mockResolvedValue(undefined),
  getAndroidChannelId: jest.fn((key: string) => `${key}.v1`),
}));
jest.mock('@/lib/sentry-utils', () => ({
  captureCategorizedErrorSync: jest.fn(),
}));

describe('PlaybookNotificationScheduler', () => {
  let scheduler: PlaybookNotificationScheduler;
  const originalOS = Platform.OS;
  const originalVersion = Platform.Version;

  const mockTask = {
    id: 'task-1',
    title: 'Water plants',
    description: 'Water your plants thoroughly',
    reminderAtUtc: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
    timezone: 'America/Los_Angeles',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    scheduler = new PlaybookNotificationScheduler();

    // Restore Platform state to prevent test pollution
    Object.defineProperty(Platform, 'OS', {
      value: originalOS,
      configurable: true,
    });
    Object.defineProperty(Platform, 'Version', {
      value: originalVersion,
      configurable: true,
    });

    // Default mocks
    (PermissionManager.needsExactAlarms as jest.Mock).mockReturnValue(true);
    (
      LocalNotificationService.scheduleExactNotification as jest.Mock
    ).mockResolvedValue('notif-123');
  });

  describe('ensureChannels', () => {
    it('should register Android channels on Android', async () => {
      Object.defineProperty(Platform, 'OS', {
        value: 'android',
        configurable: true,
      });

      const {
        registerAndroidChannels,
      } = require('@/lib/notifications/android-channels');
      (registerAndroidChannels as jest.Mock).mockClear();

      await scheduler.ensureChannels();

      expect(registerAndroidChannels).toHaveBeenCalledTimes(1);
    });

    it('should not register channels on iOS', async () => {
      Object.defineProperty(Platform, 'OS', {
        value: 'ios',
        configurable: true,
      });

      const {
        registerAndroidChannels,
      } = require('@/lib/notifications/android-channels');
      (registerAndroidChannels as jest.Mock).mockClear();

      await scheduler.ensureChannels();

      expect(registerAndroidChannels).not.toHaveBeenCalled();
    });

    it.skip('should throw error if channel registration fails', async () => {
      Object.defineProperty(Platform, 'OS', {
        value: 'android',
        configurable: true,
      });

      const {
        registerAndroidChannels,
      } = require('@/lib/notifications/android-channels');
      (registerAndroidChannels as jest.Mock).mockRejectedValueOnce(
        new Error('Channel error')
      );

      await expect(scheduler.ensureChannels()).rejects.toThrow('Channel error');
    });
  });

  describe('canUseExactAlarms', () => {
    it('should return false on iOS', async () => {
      Object.defineProperty(Platform, 'OS', {
        value: 'ios',
        configurable: true,
      });

      const result = await scheduler.canUseExactAlarms();

      expect(result).toBe(false);
    });

    it('should return false on Android < 31', async () => {
      Object.defineProperty(Platform, 'OS', {
        value: 'android',
        configurable: true,
      });
      Object.defineProperty(Platform, 'Version', {
        value: 30,
        configurable: true,
      });

      const result = await scheduler.canUseExactAlarms();

      expect(result).toBe(false);
    });

    it('should check permission on Android 31+', async () => {
      Object.defineProperty(Platform, 'OS', {
        value: 'android',
        configurable: true,
      });
      Object.defineProperty(Platform, 'Version', {
        value: 31,
        configurable: true,
      });
      (PermissionManager.needsExactAlarms as jest.Mock).mockReturnValue(true);

      const result = await scheduler.canUseExactAlarms();

      expect(result).toBe(true);
      expect(PermissionManager.needsExactAlarms).toHaveBeenCalled();
    });
  });

  describe('scheduleTaskReminder - basic', () => {
    it('should schedule inexact notification by default', async () => {
      const result = await scheduler.scheduleTaskReminder(mockTask);

      expect(result).toEqual({
        notificationId: 'notif-123',
        exact: false,
        fallbackUsed: false,
      });
      expect(
        LocalNotificationService.scheduleExactNotification
      ).toHaveBeenCalledWith({
        title: mockTask.title,
        body: mockTask.description,
        data: { taskId: mockTask.id, type: 'playbook_reminder' },
        triggerDate: expect.any(Date),
        androidChannelKey: 'cultivation.reminders',
        threadId: `task-${mockTask.id}`,
      });
    });

    it('should throw error if task has no reminder timestamp', async () => {
      const taskWithoutReminder = { ...mockTask, reminderAtUtc: undefined };

      await expect(
        scheduler.scheduleTaskReminder(taskWithoutReminder)
      ).rejects.toThrow('has no reminder timestamp');
    });

    it('should throw error if reminder is in the past', async () => {
      const pastTask = {
        ...mockTask,
        reminderAtUtc: new Date(Date.now() - 3600000).toISOString(),
      };

      await expect(scheduler.scheduleTaskReminder(pastTask)).rejects.toThrow(
        'reminder is in the past'
      );
    });

    it('should track notification for delivery metrics', async () => {
      await scheduler.scheduleTaskReminder(mockTask);

      const stats = scheduler.getDeliveryStats();
      expect(stats.totalScheduled).toBe(1);
      expect(stats.totalDelivered).toBe(0);
    });
  });

  describe('scheduleTaskReminder - exact alarms', () => {
    it('should attempt exact alarm when useExactAlarm is true on Android', async () => {
      Object.defineProperty(Platform, 'OS', {
        value: 'android',
        configurable: true,
      });
      (
        AndroidExactAlarmCoordinator.ensurePermission as jest.Mock
      ).mockResolvedValue({ granted: true });

      const result = await scheduler.scheduleTaskReminder(mockTask, {
        useExactAlarm: true,
      });

      expect(result.exact).toBe(true);
      expect(result.fallbackUsed).toBe(false);
      expect(AndroidExactAlarmCoordinator.ensurePermission).toHaveBeenCalled();
    });

    it('should use fallback when exact alarm permission denied', async () => {
      Object.defineProperty(Platform, 'OS', {
        value: 'android',
        configurable: true,
      });
      (
        AndroidExactAlarmCoordinator.ensurePermission as jest.Mock
      ).mockResolvedValue({
        granted: false,
        fallbackId: 'fallback-123',
      });

      const result = await scheduler.scheduleTaskReminder(mockTask, {
        useExactAlarm: true,
      });

      expect(result.notificationId).toBe('fallback-123');
      expect(result.exact).toBe(false);
      expect(result.fallbackUsed).toBe(true);
    });

    it('should schedule inexact when exact permission denied without fallback', async () => {
      Object.defineProperty(Platform, 'OS', {
        value: 'android',
        configurable: true,
      });
      (
        AndroidExactAlarmCoordinator.ensurePermission as jest.Mock
      ).mockResolvedValue({ granted: false });

      const result = await scheduler.scheduleTaskReminder(mockTask, {
        useExactAlarm: true,
      });

      expect(result.exact).toBe(false);
      expect(result.fallbackUsed).toBe(true);
      expect(
        LocalNotificationService.scheduleExactNotification
      ).toHaveBeenCalled();
    });
  });

  describe('cancelTaskReminder', () => {
    it('should cancel scheduled notification', async () => {
      await scheduler.cancelTaskReminder('notif-123');

      expect(
        LocalNotificationService.cancelScheduledNotification
      ).toHaveBeenCalledWith('notif-123');
    });

    it('should handle empty notification ID', async () => {
      await scheduler.cancelTaskReminder('');

      expect(
        LocalNotificationService.cancelScheduledNotification
      ).not.toHaveBeenCalled();
    });

    it('should remove from delivery tracking', async () => {
      await scheduler.scheduleTaskReminder(mockTask);
      const stats1 = scheduler.getDeliveryStats();
      expect(stats1.totalScheduled).toBe(1);

      await scheduler.cancelTaskReminder('notif-123');
      const stats2 = scheduler.getDeliveryStats();
      expect(stats2.totalScheduled).toBe(0);
    });
  });

  describe('rescheduleTaskReminder', () => {
    it('should cancel existing notification and schedule new one', async () => {
      const taskWithNotif = { ...mockTask, notificationId: 'old-notif' };

      const result = await scheduler.rescheduleTaskReminder(taskWithNotif);

      expect(
        LocalNotificationService.cancelScheduledNotification
      ).toHaveBeenCalledWith('old-notif');
      expect(result.notificationId).toBe('notif-123');
    });

    it('should schedule without canceling if no existing notification', async () => {
      const result = await scheduler.rescheduleTaskReminder(mockTask);

      expect(
        LocalNotificationService.cancelScheduledNotification
      ).not.toHaveBeenCalled();
      expect(result.notificationId).toBe('notif-123');
    });
  });

  describe('rehydrateNotifications - basic', () => {
    it('should reschedule future reminders', async () => {
      const tasks = [
        mockTask,
        {
          ...mockTask,
          id: 'task-2',
          reminderAtUtc: new Date(Date.now() + 7200000).toISOString(),
        },
      ];

      await scheduler.rehydrateNotifications(tasks);

      expect(
        LocalNotificationService.scheduleExactNotification
      ).toHaveBeenCalledTimes(2);
    });

    it('should update task notificationId fields with new notification IDs', async () => {
      const task1 = { ...mockTask, notificationId: 'old-notif-1' };
      const task2 = {
        ...mockTask,
        id: 'task-2',
        reminderAtUtc: new Date(Date.now() + 7200000).toISOString(),
        notificationId: 'old-notif-2',
      };
      const tasks = [task1, task2];

      // Mock different notification IDs for each schedule
      (LocalNotificationService.scheduleExactNotification as jest.Mock)
        .mockResolvedValueOnce('new-notif-1')
        .mockResolvedValueOnce('new-notif-2');

      await scheduler.rehydrateNotifications(tasks);

      expect(task1.notificationId).toBe('new-notif-1');
      expect(task2.notificationId).toBe('new-notif-2');
    });

    it('should skip past reminders', async () => {
      const tasks = [
        mockTask,
        {
          ...mockTask,
          id: 'task-2',
          reminderAtUtc: new Date(Date.now() - 3600000).toISOString(),
        },
      ];

      await scheduler.rehydrateNotifications(tasks);

      expect(
        LocalNotificationService.scheduleExactNotification
      ).toHaveBeenCalledTimes(1);
    });

    it('should skip tasks without reminders', async () => {
      const tasks = [
        mockTask,
        { ...mockTask, id: 'task-2', reminderAtUtc: undefined },
      ];

      await scheduler.rehydrateNotifications(tasks);

      expect(
        LocalNotificationService.scheduleExactNotification
      ).toHaveBeenCalledTimes(1);
    });
  });

  describe('rehydrateNotifications - error handling', () => {
    it('should handle scheduling failures gracefully and not update notificationId for failed tasks', async () => {
      const task1 = { ...mockTask, notificationId: 'old-notif-1' };
      const task2 = {
        ...mockTask,
        id: 'task-2',
        reminderAtUtc: new Date(Date.now() + 7200000).toISOString(),
        notificationId: 'old-notif-2',
      };
      const tasks = [task1, task2];

      (LocalNotificationService.scheduleExactNotification as jest.Mock)
        .mockRejectedValueOnce(new Error('Schedule failed'))
        .mockResolvedValueOnce('new-notif-2');

      await scheduler.rehydrateNotifications(tasks);

      expect(
        LocalNotificationService.scheduleExactNotification
      ).toHaveBeenCalledTimes(2);
      // First task failed, so notificationId should remain unchanged
      expect(task1.notificationId).toBe('old-notif-1');
      // Second task succeeded, so notificationId should be updated
      expect(task2.notificationId).toBe('new-notif-2');
    });
  });

  describe('handleNotificationDelivered', () => {
    it('should mark notification as delivered', async () => {
      await scheduler.scheduleTaskReminder(mockTask);

      scheduler.handleNotificationDelivered('notif-123');

      const stats = scheduler.getDeliveryStats();
      expect(stats.totalDelivered).toBe(1);
    });

    it('should handle unknown notification ID', () => {
      scheduler.handleNotificationDelivered('unknown-id');

      const stats = scheduler.getDeliveryStats();
      expect(stats.totalDelivered).toBe(0);
    });
  });

  describe('verifyDelivery', () => {
    it('should return true if delivered within 5 minutes', async () => {
      const futureTime = Date.now() + 60000;
      const taskWithNearFuture = {
        ...mockTask,
        reminderAtUtc: new Date(futureTime).toISOString(),
      };

      await scheduler.scheduleTaskReminder(taskWithNearFuture);
      scheduler.handleNotificationDelivered('notif-123');

      const verified = await scheduler.verifyDelivery('notif-123');

      expect(verified).toBe(true);
    });

    it('should return false if not delivered', async () => {
      await scheduler.scheduleTaskReminder(mockTask);

      const verified = await scheduler.verifyDelivery('notif-123');

      expect(verified).toBe(false);
    });

    it('should return false for unknown notification', async () => {
      const verified = await scheduler.verifyDelivery('unknown-id');

      expect(verified).toBe(false);
    });
  });

  describe('getDeliveryStats', () => {
    it('should return correct statistics', async () => {
      // Mock different notification IDs for each schedule
      (LocalNotificationService.scheduleExactNotification as jest.Mock)
        .mockResolvedValueOnce('notif-1')
        .mockResolvedValueOnce('notif-2')
        .mockResolvedValueOnce('notif-3');

      // Schedule 3 notifications
      await scheduler.scheduleTaskReminder(mockTask);
      await scheduler.scheduleTaskReminder({
        ...mockTask,
        id: 'task-2',
      });
      await scheduler.scheduleTaskReminder({
        ...mockTask,
        id: 'task-3',
      });

      // Mark 2 as delivered
      scheduler.handleNotificationDelivered('notif-1');
      scheduler.handleNotificationDelivered('notif-2');

      const stats = scheduler.getDeliveryStats();

      expect(stats.totalScheduled).toBe(3);
      expect(stats.totalDelivered).toBe(2);
      expect(stats.totalFailed).toBe(1);
      expect(stats.deliveryRate).toBeGreaterThanOrEqual(0);
      expect(stats.deliveryRate).toBeLessThanOrEqual(1);
    });

    it('should return zero stats when no notifications', () => {
      const stats = scheduler.getDeliveryStats();

      expect(stats).toEqual({
        totalScheduled: 0,
        totalDelivered: 0,
        totalFailed: 0,
        deliveryRate: 0,
        averageDelayMs: 0,
      });
    });
  });

  describe('clearDeliveryTracking', () => {
    it('should clear all tracking data', async () => {
      await scheduler.scheduleTaskReminder(mockTask);
      const stats1 = scheduler.getDeliveryStats();
      expect(stats1.totalScheduled).toBe(1);

      scheduler.clearDeliveryTracking();
      const stats2 = scheduler.getDeliveryStats();
      expect(stats2.totalScheduled).toBe(0);
    });
  });

  describe('getPlaybookNotificationScheduler', () => {
    it('should return singleton instance', () => {
      const instance1 = getPlaybookNotificationScheduler();
      const instance2 = getPlaybookNotificationScheduler();

      expect(instance1).toBe(instance2);
    });
  });
});
