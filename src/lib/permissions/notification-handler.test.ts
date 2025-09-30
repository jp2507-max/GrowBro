import * as RN from 'react-native';

import { registerAndroidChannels } from '@/lib/notifications/android-channels';
import { NotificationHandler } from '@/lib/permissions/notification-handler';
import { PermissionManager } from '@/lib/permissions/permission-manager';

jest.mock('@/lib/notifications/android-channels', () => ({
  registerAndroidChannels: jest.fn().mockResolvedValue(undefined),
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
    expect(registerAndroidChannels).not.toHaveBeenCalled();
  });

  it('creates channels after permission granted', async () => {
    jest
      .spyOn(PermissionManager, 'isNotificationPermissionGranted')
      .mockResolvedValue(true);
    await NotificationHandler.createChannelsAfterGrant();
    expect(registerAndroidChannels).toHaveBeenCalled();
  });
});
