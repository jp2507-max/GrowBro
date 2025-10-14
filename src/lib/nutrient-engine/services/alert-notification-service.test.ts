/**
 * Tests for alert notification service
 */

import { LocalNotificationService } from '@/lib/notifications/local-service';
import { PermissionManager } from '@/lib/permissions/permission-manager';

import type { DeviationAlert, PhEcReading, Reservoir } from '../types';
import {
  cancelAlertNotification,
  canSendNotifications,
  deliverOfflineAlert,
  scheduleAlertNotification,
} from './alert-notification-service';

// ============================================================================
// Mocks
// ============================================================================

jest.mock('@/lib/notifications/local-service');
jest.mock('@/lib/permissions/permission-manager');
jest.mock('@/lib/sentry-utils', () => ({
  captureCategorizedErrorSync: jest.fn(),
}));

const mockScheduleNotification =
  LocalNotificationService.scheduleExactNotification as jest.MockedFunction<
    typeof LocalNotificationService.scheduleExactNotification
  >;

const mockCancelNotification =
  LocalNotificationService.cancelScheduledNotification as jest.MockedFunction<
    typeof LocalNotificationService.cancelScheduledNotification
  >;

const mockIsNotificationPermissionGranted =
  PermissionManager.isNotificationPermissionGranted as jest.MockedFunction<
    typeof PermissionManager.isNotificationPermissionGranted
  >;

const mockRequestNotificationPermission =
  PermissionManager.requestNotificationPermission as jest.MockedFunction<
    typeof PermissionManager.requestNotificationPermission
  >;

// ============================================================================
// Test Fixtures
// ============================================================================

const mockReservoir: Reservoir = {
  id: 'res1',
  name: 'Main Reservoir',
  volumeL: 20,
  medium: 'hydro',
  targetPhMin: 5.5,
  targetPhMax: 6.5,
  targetEcMin25c: 1.0,
  targetEcMax25c: 2.0,
  ppmScale: '500',
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

const mockReading: PhEcReading = {
  id: 'reading1',
  reservoirId: 'res1',
  measuredAt: Date.now(),
  ph: 7.5,
  ecRaw: 2.5,
  ec25c: 2.5,
  tempC: 22,
  atcOn: true,
  ppmScale: '500',
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

const mockAlert: DeviationAlert = {
  id: 'alert1',
  readingId: 'reading1',
  type: 'ph_high',
  severity: 'warning',
  message: 'pH 7.5 (target 5.5-6.5)',
  recommendations: ['Add pH down solution'],
  recommendationCodes: ['ADJUST_PH_DOWN'],
  triggeredAt: Date.now(),
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

// ============================================================================
// Test Setup
// ============================================================================

beforeEach(() => {
  jest.clearAllMocks();
  mockIsNotificationPermissionGranted.mockResolvedValue(true);
  mockRequestNotificationPermission.mockResolvedValue('granted');
  mockScheduleNotification.mockResolvedValue('notif123');
});

// ============================================================================
// Tests: Notification Scheduling
// ============================================================================

describe('scheduleAlertNotification', () => {
  test('schedules notification with proper title and body for pH alert', async () => {
    const notificationId = await scheduleAlertNotification(
      mockAlert,
      mockReading,
      mockReservoir
    );

    expect(notificationId).toBe('notif123');
    expect(mockScheduleNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        idTag: 'alert_alert1',
        title: 'pH Too High',
        body: expect.stringContaining('Main Reservoir'),
        androidChannelKey: 'cultivation.alerts',
        data: expect.objectContaining({
          type: 'nutrient_alert',
          alertId: 'alert1',
          readingId: 'reading1',
          reservoirId: 'res1',
          alertType: 'ph_high',
        }),
      })
    );
  });

  test('schedules notification with PPM and scale for EC alert', async () => {
    const ecAlert: DeviationAlert = {
      ...mockAlert,
      type: 'ec_high',
      message: 'EC too high',
    };

    await scheduleAlertNotification(ecAlert, mockReading, mockReservoir);

    const call = mockScheduleNotification.mock.calls[0][0];
    expect(call.title).toBe('EC Too High');
    expect(call.body).toContain('2.50 mS/cm');
    expect(call.body).toContain('1250 ppm [500]'); // 2.5 * 500
  });

  test('schedules notification for temperature warning', async () => {
    const tempAlert: DeviationAlert = {
      ...mockAlert,
      type: 'temp_high',
      severity: 'info',
      message: 'Temperature high',
    };

    const tempReading: PhEcReading = {
      ...mockReading,
      tempC: 29,
    };

    await scheduleAlertNotification(tempAlert, tempReading, mockReservoir);

    const call = mockScheduleNotification.mock.calls[0][0];
    expect(call.title).toBe('Temperature Warning');
    expect(call.body).toContain('29.0°C');
  });

  test('schedules notification for calibration warning', async () => {
    const calAlert: DeviationAlert = {
      ...mockAlert,
      type: 'calibration_stale',
      severity: 'info',
      message: 'Calibration stale',
    };

    await scheduleAlertNotification(calAlert, mockReading, mockReservoir);

    const call = mockScheduleNotification.mock.calls[0][0];
    expect(call.title).toBe('Calibration Needed');
    expect(call.body).toContain('calibration');
  });

  test('requests permission if not granted', async () => {
    mockIsNotificationPermissionGranted.mockResolvedValueOnce(false);
    mockRequestNotificationPermission.mockResolvedValueOnce('granted');

    await scheduleAlertNotification(mockAlert, mockReading, mockReservoir);

    expect(mockRequestNotificationPermission).toHaveBeenCalled();
    expect(mockScheduleNotification).toHaveBeenCalled();
  });

  test('returns null if permission denied', async () => {
    mockIsNotificationPermissionGranted.mockResolvedValueOnce(false);
    mockRequestNotificationPermission.mockResolvedValueOnce('denied');

    const result = await scheduleAlertNotification(
      mockAlert,
      mockReading,
      mockReservoir
    );

    expect(result).toBeNull();
    expect(mockScheduleNotification).not.toHaveBeenCalled();
  });

  test('uses cultivation.alerts channel for Android', async () => {
    await scheduleAlertNotification(mockAlert, mockReading, mockReservoir);

    expect(mockScheduleNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        androidChannelKey: 'cultivation.alerts',
      })
    );
  });

  test('includes reservoir ID in thread ID for grouping', async () => {
    await scheduleAlertNotification(mockAlert, mockReading, mockReservoir);

    expect(mockScheduleNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        threadId: 'reservoir_res1',
      })
    );
  });
});

// ============================================================================
// Tests: Notification Cancellation
// ============================================================================

describe('cancelAlertNotification', () => {
  test('cancels notification by ID', async () => {
    await cancelAlertNotification('notif123');

    expect(mockCancelNotification).toHaveBeenCalledWith('notif123');
  });

  test('handles cancellation errors gracefully', async () => {
    mockCancelNotification.mockRejectedValueOnce(
      new Error('Cancellation failed')
    );

    await expect(cancelAlertNotification('notif123')).resolves.not.toThrow();
  });
});

// ============================================================================
// Tests: Offline Alert Handling
// ============================================================================

describe('deliverOfflineAlert', () => {
  test('delivers alert notification and returns true on success', async () => {
    const result = await deliverOfflineAlert(
      mockAlert,
      mockReading,
      mockReservoir
    );

    expect(result).toBe(true);
    expect(mockScheduleNotification).toHaveBeenCalled();
  });

  test('returns false if notification scheduling fails', async () => {
    mockScheduleNotification.mockResolvedValueOnce(null as any);

    const result = await deliverOfflineAlert(
      mockAlert,
      mockReading,
      mockReservoir
    );

    expect(result).toBe(false);
  });

  test('returns false if permission denied', async () => {
    mockIsNotificationPermissionGranted.mockResolvedValueOnce(false);
    mockRequestNotificationPermission.mockResolvedValueOnce('denied');

    const result = await deliverOfflineAlert(
      mockAlert,
      mockReading,
      mockReservoir
    );

    expect(result).toBe(false);
  });
});

// ============================================================================
// Tests: Permission Utilities
// ============================================================================

describe('canSendNotifications', () => {
  test('returns true if permission granted', async () => {
    mockIsNotificationPermissionGranted.mockResolvedValueOnce(true);

    const result = await canSendNotifications();
    expect(result).toBe(true);
  });

  test('returns false if permission denied', async () => {
    mockIsNotificationPermissionGranted.mockResolvedValueOnce(false);

    const result = await canSendNotifications();
    expect(result).toBe(false);
  });
});
