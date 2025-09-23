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
  let originalPlatformOSDescriptor: PropertyDescriptor;
  let originalPlatformVersionDescriptor: PropertyDescriptor;

  beforeAll(() => {
    originalPlatformOSDescriptor = Object.getOwnPropertyDescriptor(
      RN.Platform,
      'OS'
    )!;
    originalPlatformVersionDescriptor = Object.getOwnPropertyDescriptor(
      RN.Platform,
      'Version'
    )!;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(RN.Platform, 'OS', {
      writable: true,
      value: 'android',
    });
    Object.defineProperty(RN.Platform, 'Version', {
      writable: true,
      value: 34,
    });
  });

  afterEach(() => {
    Object.defineProperty(RN.Platform, 'OS', originalPlatformOSDescriptor);
    Object.defineProperty(
      RN.Platform,
      'Version',
      originalPlatformVersionDescriptor
    );
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
