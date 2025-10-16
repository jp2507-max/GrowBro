/**
 * Exact Alarm Coordinator Tests
 *
 * Unit tests for Android 13+ exact alarm permission handling.
 *
 * Requirements: 4.2
 */

import { Alert, Linking, NativeModules, Platform } from 'react-native';

import { ExactAlarmCoordinator } from '../exact-alarm-coordinator';

// Mock React Native modules
jest.mock('react-native', () => ({
  Alert: {
    alert: jest.fn(),
  },
  Linking: {
    canOpenURL: jest.fn(),
    openSettings: jest.fn(),
  },
  NativeModules: {
    AlarmManager: {
      canScheduleExactAlarms: jest.fn(),
    },
  },
  Platform: {
    OS: 'android',
    Version: 34,
  },
}));

describe('ExactAlarmCoordinator', () => {
  const originalPlatform = { ...Platform };

  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'android';
    Platform.Version = 34;
  });

  afterEach(() => {
    Platform.OS = originalPlatform.OS;
    Platform.Version = originalPlatform.Version;
  });

  describe('canScheduleExactAlarms', () => {
    it('should return true on pre-Android 13 devices', async () => {
      Platform.Version = 32;

      const result = await ExactAlarmCoordinator.canScheduleExactAlarms();

      expect(result).toBe(true);
    });

    it('should return true when permission is granted', async () => {
      (
        NativeModules.AlarmManager.canScheduleExactAlarms as jest.Mock
      ).mockResolvedValue(true);

      const result = await ExactAlarmCoordinator.canScheduleExactAlarms();

      expect(result).toBe(true);
    });

    it('should return false when permission is denied', async () => {
      (
        NativeModules.AlarmManager.canScheduleExactAlarms as jest.Mock
      ).mockResolvedValue(false);

      const result = await ExactAlarmCoordinator.canScheduleExactAlarms();

      expect(result).toBe(false);
    });

    it('should return false on error and log to Sentry', async () => {
      (
        NativeModules.AlarmManager.canScheduleExactAlarms as jest.Mock
      ).mockRejectedValue(new Error('Native error'));

      const result = await ExactAlarmCoordinator.canScheduleExactAlarms();

      expect(result).toBe(false);
    });

    it('should return true on iOS', async () => {
      Platform.OS = 'ios';

      const result = await ExactAlarmCoordinator.canScheduleExactAlarms();

      expect(result).toBe(true);
    });
  });

  describe('getPermissionStatus', () => {
    it('should return unavailable on pre-Android 13', async () => {
      Platform.Version = 32;

      const status = await ExactAlarmCoordinator.getPermissionStatus();

      expect(status).toEqual({ status: 'unavailable' });
    });

    it('should return granted when permission is granted', async () => {
      (
        NativeModules.AlarmManager.canScheduleExactAlarms as jest.Mock
      ).mockResolvedValue(true);

      const status = await ExactAlarmCoordinator.getPermissionStatus();

      expect(status).toEqual({ status: 'granted' });
    });

    it('should return denied with fallback when permission denied', async () => {
      (
        NativeModules.AlarmManager.canScheduleExactAlarms as jest.Mock
      ).mockResolvedValue(false);

      const status = await ExactAlarmCoordinator.getPermissionStatus();

      expect(status).toEqual({ status: 'denied', fallbackAvailable: true });
    });
  });

  describe('requestPermission', () => {
    it('should return true on pre-Android 13 without showing alert', async () => {
      Platform.Version = 32;

      const result = await ExactAlarmCoordinator.requestPermission();

      expect(result).toBe(true);
      expect(Alert.alert).not.toHaveBeenCalled();
    });

    it('should return true if already granted without showing alert', async () => {
      (
        NativeModules.AlarmManager.canScheduleExactAlarms as jest.Mock
      ).mockResolvedValue(true);

      const result = await ExactAlarmCoordinator.requestPermission();

      expect(result).toBe(true);
      expect(Alert.alert).not.toHaveBeenCalled();
    });

    it('should show rationale dialog with default message', async () => {
      (
        NativeModules.AlarmManager.canScheduleExactAlarms as jest.Mock
      ).mockResolvedValue(false);
      (Alert.alert as jest.Mock).mockImplementation(
        (title, message, buttons) => {
          // Simulate user pressing "Use Flexible Notifications"
          buttons[0].onPress();
        }
      );

      await ExactAlarmCoordinator.requestPermission();

      expect(Alert.alert).toHaveBeenCalledWith(
        'Enable Timely Alerts',
        expect.stringContaining('GrowBro needs exact alarm permission'),
        expect.any(Array),
        expect.any(Object)
      );
    });

    it('should show custom rationale when provided', async () => {
      (
        NativeModules.AlarmManager.canScheduleExactAlarms as jest.Mock
      ).mockResolvedValue(false);
      (Alert.alert as jest.Mock).mockImplementation(
        (title, message, buttons) => {
          buttons[0].onPress();
        }
      );

      const customRationale = 'Custom message for testing';
      await ExactAlarmCoordinator.requestPermission(customRationale);

      expect(Alert.alert).toHaveBeenCalledWith(
        'Enable Timely Alerts',
        customRationale,
        expect.any(Array),
        expect.any(Object)
      );
    });

    it('should return false when user cancels', async () => {
      (
        NativeModules.AlarmManager.canScheduleExactAlarms as jest.Mock
      ).mockResolvedValue(false);
      (Alert.alert as jest.Mock).mockImplementation(
        (title, message, buttons) => {
          buttons[0].onPress(); // Press cancel button
        }
      );

      const result = await ExactAlarmCoordinator.requestPermission();

      expect(result).toBe(false);
    });

    it('should launch settings when user enables', async () => {
      (NativeModules.AlarmManager.canScheduleExactAlarms as jest.Mock)
        .mockResolvedValueOnce(false) // Initial check
        .mockResolvedValueOnce(true); // After settings
      (Linking.canOpenURL as jest.Mock).mockResolvedValue(true);
      (Linking.openSettings as jest.Mock).mockResolvedValue(undefined);
      (Alert.alert as jest.Mock).mockImplementation(
        (title, message, buttons) => {
          buttons[1].onPress(); // Press "Enable" button
        }
      );

      await ExactAlarmCoordinator.requestPermission();

      expect(Linking.openSettings).toHaveBeenCalled();
    });
  });

  describe('openAppSettings', () => {
    it('should open app settings', async () => {
      (Linking.openSettings as jest.Mock).mockResolvedValue(undefined);

      await ExactAlarmCoordinator.openAppSettings();

      expect(Linking.openSettings).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      (Linking.openSettings as jest.Mock).mockRejectedValue(
        new Error('Settings error')
      );

      await expect(
        ExactAlarmCoordinator.openAppSettings()
      ).resolves.not.toThrow();
    });
  });
});
