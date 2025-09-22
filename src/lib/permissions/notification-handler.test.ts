import * as Notifications from 'expo-notifications';
import * as RN from 'react-native';

import { NotificationHandler } from '@/lib/permissions/notification-handler';
import { PermissionManager } from '@/lib/permissions/permission-manager';

jest.mock('expo-notifications', () => ({
  setNotificationChannelAsync: jest.fn().mockResolvedValue(undefined),
  AndroidImportance: { HIGH: 4 },
  AndroidNotificationVisibility: { PUBLIC: 1 },
}));

describe('NotificationHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (RN as any).Platform.OS = 'android';
    (RN as any).Platform.Version = 34;
  });

  it('does not create channels when permission not granted', async () => {
    jest
      .spyOn(PermissionManager, 'isNotificationPermissionGranted')
      .mockResolvedValue(false);
    await NotificationHandler.createChannelsAfterGrant();
    expect(
      (Notifications as any).setNotificationChannelAsync
    ).not.toHaveBeenCalled();
  });

  it('creates channels after permission granted', async () => {
    jest
      .spyOn(PermissionManager, 'isNotificationPermissionGranted')
      .mockResolvedValue(true);
    await NotificationHandler.createChannelsAfterGrant();
    expect(
      (Notifications as any).setNotificationChannelAsync
    ).toHaveBeenCalled();
  });
});
