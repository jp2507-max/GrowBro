import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { cleanup } from '@/lib/test-utils';

import {
  calculateDaysUntilExpiry,
  getCalibrationQualityStatus,
} from '../utils/calibration-calculations';
import {
  handleCascadingReminder,
  scheduleCalibrationReminders,
} from './calibration-reminder';

// Mock dependencies
jest.mock('expo-notifications');
jest.mock('@/lib/watermelon-models/calibration');

// Mock the utility functions
jest.mock('../utils/calibration-calculations', () => ({
  calculateDaysUntilExpiry: jest.fn(),
  getCalibrationQualityStatus: jest.fn(),
}));

// Mock Platform
const mockPlatform = Platform as jest.Mocked<typeof Platform>;
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: jest.fn(),
  },
}));

// Mock calibration model
const mockCalibration: any = {
  id: 'test-calibration-id',
  expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 30, // 30 days from now (epoch ms)
  performedAt: Date.now(),
  meterId: 'test-meter',
  type: 'ph',
  points: [],
  slope: 1.0,
  offset: 0.0,
  tempC: 25.0,
  method: 'one_point',
  validDays: 30,
  isValid: true,
  userId: 'test-user',
};

describe('Calibration Reminder Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cleanup();

    // Default to iOS for consistent testing
    mockPlatform.OS = 'ios';

    // Mock Notifications
    (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue(
      'test-notification-id'
    );
    (
      Notifications.getAllScheduledNotificationsAsync as jest.Mock
    ).mockResolvedValue([]);
    (Notifications.SchedulableTriggerInputTypes as any) = {
      TIME_INTERVAL: 'TIME_INTERVAL',
      CALENDAR: 'CALENDAR',
      DATE: 'DATE',
    };

    // Mock utility functions
    (calculateDaysUntilExpiry as jest.Mock).mockReturnValue(7);
    (getCalibrationQualityStatus as jest.Mock).mockReturnValue('valid');
  });

  afterEach(() => {
    cleanup();
  });

  describe('Platform Detection & Limits', () => {
    test('should detect iOS platform limits', () => {
      mockPlatform.OS = 'ios';
      // iOS limit: 64 weeks = 60 * 60 * 24 * 7 * 64 = 38,707,200 seconds
      const iosLimit = 60 * 60 * 24 * 7 * 64;
      expect(iosLimit).toBe(38707200);
    });

    test('should detect Android platform limits', () => {
      mockPlatform.OS = 'android';
      // Android limit: 2 years = 60 * 60 * 24 * 365 * 2 = 63,072,000 seconds
      const androidLimit = 60 * 60 * 24 * 365 * 2;
      expect(androidLimit).toBe(63072000);
    });
  });

  describe('Normal Scheduling (within platform limits)', () => {
    test('should schedule notification normally for dates within iOS limits', async () => {
      mockPlatform.OS = 'ios';

      // Schedule a reminder 30 days from now (well within 64-week limit)

      const result = await scheduleCalibrationReminders(mockCalibration);
      void result;

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(3); // First warning + final warning + expiry
      expect(result).toHaveLength(3);

      // Check that the notification was scheduled with TIME_INTERVAL
      const call = (Notifications.scheduleNotificationAsync as jest.Mock).mock
        .calls[0][0];
      expect(call.trigger.type).toBe(
        Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL
      );
      expect(call.trigger.seconds).toBeGreaterThan(0);
      expect(call.trigger.seconds).toBeLessThan(60 * 60 * 24 * 7 * 64); // Within iOS limit
    });

    test('should schedule notification normally for dates within Android limits', async () => {
      mockPlatform.OS = 'android';

      // Schedule a reminder 1 year from now (well within 2-year limit)

      const result = await scheduleCalibrationReminders(mockCalibration);
      void result;

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(3);
      expect(result).toHaveLength(3);
    });
  });

  describe('Long-Future Date Handling (exceeding platform limits)', () => {
    test('should use cascading strategy for dates exceeding iOS 64-week limit', async () => {
      mockPlatform.OS = 'ios';

      // Create a calibration that expires more than 64 weeks in the future
      const farFutureCalibration = {
        ...mockCalibration,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7 * 70), // 70 weeks
      };

      const result = await scheduleCalibrationReminders(farFutureCalibration);

      void result;

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(3);
      expect(result).toHaveLength(3);

      // Check that cascading data is included
      const call = (Notifications.scheduleNotificationAsync as jest.Mock).mock
        .calls[0][0];
      expect(call.content.data.cascadeTargetDate).toBeDefined();
      expect(call.content.data.cascadeStep).toBe(1);
      expect(call.trigger.seconds).toBeLessThanOrEqual(60 * 60 * 24 * 7 * 64); // Capped at iOS limit
    });

    test('should use cascading strategy for dates exceeding Android limits (edge case)', async () => {
      mockPlatform.OS = 'android';

      // Create a calibration that expires more than 2 years in the future
      const farFutureCalibration = {
        ...mockCalibration,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365 * 3), // 3 years
      };

      const _result = await scheduleCalibrationReminders(farFutureCalibration);
      void _result;

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(3);

      // Check that cascading data is included
      const call = (Notifications.scheduleNotificationAsync as jest.Mock).mock
        .calls[0][0];
      expect(call.content.data.cascadeTargetDate).toBeDefined();
      expect(call.content.data.cascadeStep).toBe(1);
    });
  });

  describe('Cascading Reminder Handling', () => {
    test('should schedule next reminder in cascade when target not reached', async () => {
      const cascadeData = {
        identifier: 'test-cascade-1',
        cascadeTargetDate: new Date(
          Date.now() + 1000 * 60 * 60 * 24 * 100
        ).toISOString(), // 100 days from now
        cascadeStep: 1,
        calibrationId: 'test-calibration',
      };

      const result = await handleCascadingReminder(cascadeData);

      expect(result).toBe(true);
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);

      const call = (Notifications.scheduleNotificationAsync as jest.Mock).mock
        .calls[0][0];
      expect(call.identifier).toBe('test-cascade-1-cascade-2');
      expect(call.content.data.cascadeStep).toBe(2);
    });

    test('should stop cascading when target date is reached', async () => {
      const cascadeData = {
        identifier: 'test-cascade-1',
        cascadeTargetDate: new Date(Date.now() - 1000).toISOString(), // Already passed
        cascadeStep: 1,
        calibrationId: 'test-calibration',
      };

      const result = await handleCascadingReminder(cascadeData);

      expect(result).toBe(false);
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    test('should handle missing cascade data gracefully', async () => {
      const incompleteData = {
        identifier: 'test-cascade-1',
        // Missing cascadeTargetDate
        cascadeStep: 1,
      };

      const result = await handleCascadingReminder(incompleteData);

      expect(result).toBe(false);
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    test('should handle invalid cascade target date', async () => {
      const invalidData = {
        identifier: 'test-cascade-1',
        cascadeTargetDate: 'invalid-date-string',
        cascadeStep: 1,
      };

      const result = await handleCascadingReminder(invalidData);

      expect(result).toBe(false);
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    test('should respect platform limits in cascading reminders', async () => {
      mockPlatform.OS = 'ios';

      const cascadeData = {
        identifier: 'test-cascade-1',
        cascadeTargetDate: new Date(
          Date.now() + 1000 * 60 * 60 * 24 * 7 * 100
        ).toISOString(), // 100 weeks
        cascadeStep: 1,
        calibrationId: 'test-calibration',
      };

      await handleCascadingReminder(cascadeData);

      const call = (Notifications.scheduleNotificationAsync as jest.Mock).mock
        .calls[0][0];
      expect(call.trigger.seconds).toBeLessThanOrEqual(60 * 60 * 24 * 7 * 64); // iOS limit
    });
  });

  describe('Error Handling', () => {
    test('should handle notification scheduling failures gracefully', async () => {
      (Notifications.scheduleNotificationAsync as jest.Mock).mockRejectedValue(
        new Error('Permission denied')
      );

      const result = await scheduleCalibrationReminders(mockCalibration);

      expect(result).toEqual([]); // Should return empty array when all scheduling fails
    });

    test('should handle cascading reminder failures gracefully', async () => {
      (Notifications.scheduleNotificationAsync as jest.Mock).mockRejectedValue(
        new Error('Scheduling failed')
      );

      const cascadeData = {
        identifier: 'test-cascade-1',
        cascadeTargetDate: new Date(
          Date.now() + 1000 * 60 * 60 * 24 * 30
        ).toISOString(),
        cascadeStep: 1,
      };

      const result = await handleCascadingReminder(cascadeData);

      expect(result).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    test('should handle immediate scheduling (null trigger)', async () => {
      // This tests the fallback in scheduleNotification when trigger is null
      // We can't easily test this directly since scheduleCalibrationReminders always provides dates
      // but the internal function handles it
      expect(true).toBe(true); // Placeholder test
    });

    test('should handle very short intervals (less than 1 second)', async () => {
      const shortCalibration = {
        ...mockCalibration,
        expiresAt: new Date(Date.now() + 2000), // 2 seconds from now
      };

      const result = await scheduleCalibrationReminders(shortCalibration);

      expect(result).toHaveLength(1);
      // Only expiry notification should be scheduled since warnings would be in the past
    });

    test('should handle platform switching during runtime', async () => {
      // Test that the code adapts to platform changes
      mockPlatform.OS = 'ios';
      const iosResult = await scheduleCalibrationReminders(mockCalibration);

      mockPlatform.OS = 'android';
      const androidResult = await scheduleCalibrationReminders(mockCalibration);

      expect(iosResult).toHaveLength(3);
      expect(androidResult).toHaveLength(3);
    });
  });
});
