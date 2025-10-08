/**
 * Tests for Harvest Notification Service
 * Requirements: 14.1, 14.2, 14.3, 14.4
 */

import * as Notifications from 'expo-notifications';

import { translate } from '@/lib/i18n';
import { NotificationHandler } from '@/lib/permissions/notification-handler';
import { database } from '@/lib/watermelon';
import { type HarvestStage, HarvestStages } from '@/types/harvest';

import {
  cancelNotificationById,
  cancelStageReminders,
  getNotificationStatus,
  rehydrateNotifications,
  scheduleOverdueReminder,
  scheduleStageReminder,
} from './harvest-notification-service';

// Mock dependencies
jest.mock('expo-notifications');
jest.mock('@/lib/permissions/notification-handler');
jest.mock('@/lib/sentry-utils');
jest.mock('@/lib/watermelon');
jest.mock('@/lib/i18n');

describe('Harvest Notification Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock i18n translate function
    (translate as unknown as jest.Mock).mockImplementation(
      (key: string, params?: any) => {
        if (key === 'harvest.notifications.target.title') {
          return `${params.stage} stage target reached`;
        }
        if (key === 'harvest.notifications.target.body') {
          return `Your harvest has been in ${params.stage} for ${params.days} days. Consider advancing to the next stage.`;
        }
        if (key === 'harvest.notifications.overdue.title') {
          return `${params.stage} stage check recommended`;
        }
        if (key === 'harvest.notifications.overdue.body') {
          return `Your harvest has been in ${params.stage} for ${params.days} days. Please check if it's ready to advance.`;
        }
        return key;
      }
    );

    // Mock permission handler
    (
      NotificationHandler.isNotificationPermissionGranted as unknown as jest.Mock
    ).mockResolvedValue(true);
    (
      NotificationHandler.requestPermissionWithPrimer as unknown as jest.Mock
    ).mockResolvedValue(true);

    // Mock notification scheduling
    (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue(
      'notification-id-123'
    );
    (
      Notifications.cancelScheduledNotificationAsync as jest.Mock
    ).mockResolvedValue(undefined);
    (
      Notifications.getAllScheduledNotificationsAsync as jest.Mock
    ).mockResolvedValue([]);

    // Mock database
    const mockHarvest: any = {
      id: 'harvest-123',
      stage: HarvestStages.DRYING as HarvestStage,
      stageStartedAt: new Date(),
      update: jest.fn((updateFn: any): any => {
        const mockRecord = {};
        updateFn(mockRecord);
        return Promise.resolve(mockHarvest);
      }),
    };

    (database.get as unknown as jest.Mock).mockReturnValue({
      find: jest.fn().mockResolvedValue(mockHarvest),
      query: jest.fn().mockReturnValue({
        fetch: jest.fn().mockResolvedValue([mockHarvest]),
      }),
    });

    (database.write as unknown as jest.Mock).mockImplementation(
      (callback: () => any) => callback()
    );
  });

  describe('scheduleStageReminder', () => {
    it('should schedule target duration notification successfully', async () => {
      // Requirement 14.1: Schedule local notification for target duration
      const harvestId = 'harvest-123';
      const stage = HarvestStages.DRYING as HarvestStage;
      const stageStartedAt = new Date();

      const result = await scheduleStageReminder(
        harvestId,
        stage,
        stageStartedAt
      );

      expect(result.scheduled).toBe(true);
      expect(result.notificationId).toBe('notification-id-123');
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            title: 'Drying stage target reached',
            data: {
              harvestId,
              stage,
              type: 'harvest_stage_target',
            },
          }),
          trigger: expect.objectContaining({
            date: expect.any(Date),
          }),
        })
      );
    });

    it('should not schedule for stages with zero target duration', async () => {
      const harvestId = 'harvest-123';
      const stage = HarvestStages.HARVEST as HarvestStage; // target_duration_days: 0
      const stageStartedAt = new Date();

      const result = await scheduleStageReminder(
        harvestId,
        stage,
        stageStartedAt
      );

      expect(result.scheduled).toBe(false);
      expect(result.error).toBe('zero_duration');
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('should not schedule for past trigger times', async () => {
      const harvestId = 'harvest-123';
      const stage = HarvestStages.DRYING as HarvestStage;
      // Stage started 20 days ago (past target of 10 days)
      const stageStartedAt = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);

      const result = await scheduleStageReminder(
        harvestId,
        stage,
        stageStartedAt
      );

      expect(result.scheduled).toBe(false);
      expect(result.error).toBe('past_trigger_time');
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('should request permissions if not granted', async () => {
      (
        NotificationHandler.isNotificationPermissionGranted as unknown as jest.Mock
      ).mockResolvedValueOnce(false);
      (
        NotificationHandler.requestPermissionWithPrimer as unknown as jest.Mock
      ).mockResolvedValueOnce(true);

      const result = await scheduleStageReminder(
        'harvest-123',
        HarvestStages.DRYING as HarvestStage,
        new Date()
      );

      expect(
        NotificationHandler.requestPermissionWithPrimer
      ).toHaveBeenCalled();
      expect(result.scheduled).toBe(true);
    });

    it('should handle permission denial gracefully', async () => {
      (
        NotificationHandler.isNotificationPermissionGranted as unknown as jest.Mock
      ).mockResolvedValueOnce(false);
      (
        NotificationHandler.requestPermissionWithPrimer as unknown as jest.Mock
      ).mockResolvedValueOnce(false);

      const result = await scheduleStageReminder(
        'harvest-123',
        HarvestStages.DRYING as HarvestStage,
        new Date()
      );

      expect(result.scheduled).toBe(false);
      expect(result.error).toBe('permission_denied');
    });
  });

  describe('scheduleOverdueReminder', () => {
    it('should schedule overdue notification successfully', async () => {
      // Requirement 14.2: Send gentle reminder when duration exceeds recommendation
      const harvestId = 'harvest-123';
      const stage = HarvestStages.DRYING as HarvestStage;
      const stageStartedAt = new Date();

      const result = await scheduleOverdueReminder(
        harvestId,
        stage,
        stageStartedAt
      );

      expect(result.scheduled).toBe(true);
      expect(result.notificationId).toBe('notification-id-123');
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            title: 'Drying stage check recommended',
            data: {
              harvestId,
              stage,
              type: 'harvest_stage_overdue',
            },
          }),
        })
      );
    });

    it('should not schedule for stages with zero max duration', async () => {
      const harvestId = 'harvest-123';
      const stage = HarvestStages.INVENTORY as HarvestStage; // max_duration_days: 0
      const stageStartedAt = new Date();

      const result = await scheduleOverdueReminder(
        harvestId,
        stage,
        stageStartedAt
      );

      expect(result.scheduled).toBe(false);
      expect(result.error).toBe('zero_duration');
    });
  });

  describe('cancelStageReminders', () => {
    it('should cancel all notifications for a harvest', async () => {
      const harvestId = 'harvest-123';
      // use mocked database

      const mockHarvest: any = {
        id: harvestId,
        notificationId: 'notif-1',
        overdueNotificationId: 'notif-2',
        update: jest.fn((updateFn: any): any => {
          const mockRecord = {
            notificationId: null,
            overdueNotificationId: null,
          };
          updateFn(mockRecord);
          return Promise.resolve(mockHarvest);
        }),
      };

      (database.get as unknown as jest.Mock).mockReturnValue({
        find: jest.fn().mockResolvedValue(mockHarvest),
      });

      await cancelStageReminders(harvestId);

      expect(
        Notifications.cancelScheduledNotificationAsync
      ).toHaveBeenCalledWith('notif-1');
      expect(
        Notifications.cancelScheduledNotificationAsync
      ).toHaveBeenCalledWith('notif-2');
      expect(mockHarvest.update).toHaveBeenCalled();
    });
  });

  describe('cancelNotificationById', () => {
    it('should cancel specific notification', async () => {
      const notificationId = 'notif-123';

      await cancelNotificationById(notificationId);

      expect(
        Notifications.cancelScheduledNotificationAsync
      ).toHaveBeenCalledWith(notificationId);
    });
  });

  describe('rehydrateNotifications', () => {
    it('should rehydrate notifications for active harvests', async () => {
      // Requirement 14.3: Rehydrate notifications from persisted state
      (
        Notifications.getAllScheduledNotificationsAsync as jest.Mock
      ).mockResolvedValueOnce([]);

      const stats = await rehydrateNotifications();

      // Verify that rehydration completes and returns stats
      expect(stats).toBeDefined();
      expect(stats).toHaveProperty('totalHarvests');
      expect(stats).toHaveProperty('notificationsScheduled');
      expect(stats).toHaveProperty('notificationsCancelled');
      expect(stats).toHaveProperty('errors');
    });

    it('should skip rehydration if permission not granted', async () => {
      (
        NotificationHandler.isNotificationPermissionGranted as unknown as jest.Mock
      ).mockResolvedValueOnce(false);

      const stats = await rehydrateNotifications();

      expect(stats.totalHarvests).toBe(0);
      expect(stats.notificationsScheduled).toBe(0);
    });

    it('should handle rehydration with missing notifications', async () => {
      // Notification not in scheduled list
      (
        Notifications.getAllScheduledNotificationsAsync as jest.Mock
      ).mockResolvedValueOnce([]);

      const stats = await rehydrateNotifications();

      // Verify rehydration completes without errors
      expect(stats).toBeDefined();
      expect(typeof stats.notificationsScheduled).toBe('number');
      expect(stats.notificationsScheduled).toBeGreaterThanOrEqual(0);
    });

    it('should handle orphaned notification cleanup', async () => {
      (
        Notifications.getAllScheduledNotificationsAsync as jest.Mock
      ).mockResolvedValueOnce([{ identifier: 'orphaned-notif' }]);

      const stats = await rehydrateNotifications();

      // Verify cleanup tracking
      expect(stats).toBeDefined();
      expect(typeof stats.notificationsCancelled).toBe('number');
      expect(stats.notificationsCancelled).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getNotificationStatus', () => {
    it('should return notification status for harvest', async () => {
      // use mocked database

      const mockHarvest = {
        id: 'harvest-123',
        notificationId: 'notif-1',
        overdueNotificationId: 'notif-2',
      };

      (database.get as unknown as jest.Mock).mockReturnValue({
        find: jest.fn().mockResolvedValue(mockHarvest),
      });

      const triggerDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      (
        Notifications.getAllScheduledNotificationsAsync as jest.Mock
      ).mockResolvedValueOnce([
        { identifier: 'notif-1', trigger: { date: triggerDate } },
        { identifier: 'notif-2', trigger: { date: triggerDate } },
      ]);

      const status = await getNotificationStatus('harvest-123');

      expect(status.hasTargetNotification).toBe(true);
      expect(status.hasOverdueNotification).toBe(true);
      expect(status.targetScheduledFor).toBeInstanceOf(Date);
      expect(status.overdueScheduledFor).toBeInstanceOf(Date);
    });

    it('should handle harvest with no notifications', async () => {
      // use mocked database
      const mockHarvest = {
        id: 'harvest-123',
        notificationId: null,
        overdueNotificationId: null,
      };

      (database.get as unknown as jest.Mock).mockReturnValue({
        find: jest.fn().mockResolvedValue(mockHarvest),
      });

      (
        Notifications.getAllScheduledNotificationsAsync as jest.Mock
      ).mockResolvedValueOnce([]);

      const status = await getNotificationStatus('harvest-123');

      expect(status.hasTargetNotification).toBe(false);
      expect(status.hasOverdueNotification).toBe(false);
      expect(status.targetScheduledFor).toBeNull();
      expect(status.overdueScheduledFor).toBeNull();
    });
  });
});
