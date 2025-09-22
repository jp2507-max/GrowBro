import * as RN from 'react-native';

import { NotificationHandler } from '@/lib/permissions/notification-handler';
import { TaskNotificationService } from '@/lib/task-notifications';

jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: jest.fn().mockResolvedValue('id'),
}));

describe('TaskNotificationService permission gate', () => {
  const originalOS = RN.Platform.OS;
  const originalVersion = RN.Platform.Version as any;
  beforeEach(() => {
    Object.defineProperty(RN.Platform, 'OS', { value: 'android' });
    Object.defineProperty(RN.Platform, 'Version', { value: 34 });
  });
  afterEach(() => {
    Object.defineProperty(RN.Platform, 'OS', { value: originalOS });
    Object.defineProperty(RN.Platform, 'Version', { value: originalVersion });
  });
  it('returns empty string when POST_NOTIFICATIONS is not granted', async () => {
    jest
      .spyOn(NotificationHandler, 'isNotificationPermissionGranted')
      .mockResolvedValue(false);
    const svc = new TaskNotificationService();
    const result = await svc.scheduleTaskReminder({
      id: 't1',
      title: 'x',
      description: 'y',
      reminderAtUtc: new Date().toISOString(),
      reminderAtLocal: null,
      dueAtUtc: null,
      dueAtLocal: null,
    } as any);
    expect(result).toBe('');
  });
});
