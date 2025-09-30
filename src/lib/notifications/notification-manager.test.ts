import {
  createNotificationManager,
  getNotificationManager,
  NotificationManager,
} from '@/lib/notifications/notification-manager';
import type { PermissionManagerAPI } from '@/lib/permissions/permission-manager';

const mockPermissionManager = {
  requestNotificationPermission: jest.fn(),
  isNotificationPermissionGranted: jest.fn(),
  handleExactAlarmPermission: jest.fn(),
  checkStoragePermissions: jest.fn(),
  requestSelectedPhotosAccess: jest.fn(),
  showMediaReselectionUI: jest.fn(),
  needsExactAlarms: jest.fn(),
  requestExactAlarmIfJustified: jest.fn(),
  provideFallbackExperience: jest.fn(),
} as jest.Mocked<PermissionManagerAPI>;

const mockPushNotificationService = {
  registerDeviceToken: jest.fn(),
  startTokenListener: jest.fn(),
  stopTokenListener: jest.fn(),
  trackNotificationOpened: jest.fn(),
  markTokenInactive: jest.fn(),
};

const mockLocalNotificationService = {
  scheduleExactNotification: jest.fn(),
};

const mockDeepLinkService = {
  handle: jest.fn(),
};

const mockRegisterAndroidChannels = jest.fn();
const mockRegisterNotificationCategories = jest.fn();

const mockSupabaseBuilder = {
  upsert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  neq: jest.fn().mockReturnThis(),
};

const mockSupabase = {
  supabase: {
    from: jest.fn(() => mockSupabaseBuilder),
    rpc: jest.fn(),
  },
};

const mockResponseRemove = jest.fn();
const mockNotifications = {
  addNotificationResponseReceivedListener: jest.fn(() => ({
    remove: mockResponseRemove,
  })),
};

const mockWatermelon = {
  database: {
    collections: {
      get: jest.fn(() => ({
        query: jest.fn(() => ({
          fetch: jest.fn(async () => []),
        })),
        create: jest.fn(),
      })),
    },
    write: jest.fn(async (callback: () => void | Promise<void>) => {
      await callback();
    }),
  },
};

jest.mock('@/lib/notifications/android-channels', () => ({
  registerAndroidChannels: mockRegisterAndroidChannels,
}));

jest.mock('@/lib/notifications/ios-categories', () => ({
  registerNotificationCategories: mockRegisterNotificationCategories,
}));

jest.mock('@/lib/notifications/deep-link-service', () => ({
  DeepLinkService: mockDeepLinkService,
}));

jest.mock('@/lib/notifications/local-service', () => ({
  LocalNotificationService: mockLocalNotificationService,
}));

jest.mock('@/lib/notifications/push-service', () => ({
  PushNotificationService: mockPushNotificationService,
}));

jest.mock('@/lib/permissions/permission-manager', () => ({
  PermissionManager: mockPermissionManager,
}));

jest.mock('@/lib/supabase', () => mockSupabase);

jest.mock('expo-notifications', () => mockNotifications);

jest.doMock('@/lib/watermelon', () => mockWatermelon);

function resetPermissionManager(): void {
  mockPermissionManager.requestNotificationPermission.mockResolvedValue(
    'granted'
  );
  mockPermissionManager.isNotificationPermissionGranted.mockResolvedValue(
    false
  );
  mockPermissionManager.handleExactAlarmPermission.mockResolvedValue({
    status: 'unavailable',
  });
  mockPermissionManager.checkStoragePermissions.mockResolvedValue({
    scope: 'scoped',
    granted: true,
  });
  mockPermissionManager.requestSelectedPhotosAccess.mockResolvedValue(
    'unavailable'
  );
  mockPermissionManager.showMediaReselectionUI.mockReset();
  mockPermissionManager.needsExactAlarms.mockReturnValue(false);
  mockPermissionManager.requestExactAlarmIfJustified.mockResolvedValue({
    status: 'unavailable',
  });
  mockPermissionManager.provideFallbackExperience.mockReset();
}

function resetPushService(): void {
  mockPushNotificationService.registerDeviceToken.mockResolvedValue({
    token: 'ExponentPushToken[MOCK]',
  });
  mockPushNotificationService.startTokenListener.mockResolvedValue(undefined);
  mockPushNotificationService.stopTokenListener.mockReturnValue(undefined);
  mockPushNotificationService.trackNotificationOpened.mockResolvedValue(
    undefined
  );
  mockPushNotificationService.markTokenInactive.mockResolvedValue(undefined);
}

function resetLocalService(): void {
  mockLocalNotificationService.scheduleExactNotification.mockResolvedValue(
    'notification-id'
  );
}

function resetDeepLinkService(): void {
  mockDeepLinkService.handle.mockResolvedValue({ ok: true });
}

beforeEach(() => {
  jest.clearAllMocks();
  resetPermissionManager();
  resetPushService();
  resetLocalService();
  resetDeepLinkService();
  mockRegisterAndroidChannels.mockResolvedValue(undefined);
  mockRegisterNotificationCategories.mockResolvedValue(undefined);
  mockSupabaseBuilder.upsert.mockClear();
  mockSupabaseBuilder.update.mockClear();
  mockSupabaseBuilder.eq.mockClear();
  mockSupabaseBuilder.neq.mockClear();
  mockSupabase.supabase.from.mockImplementation(() => mockSupabaseBuilder);
  mockSupabase.supabase.rpc.mockResolvedValue({});
  mockResponseRemove.mockReset();
  mockNotifications.addNotificationResponseReceivedListener.mockReturnValue({
    remove: mockResponseRemove,
  });
});

describe('NotificationManager Factory', () => {
  test('createNotificationManager returns distinct instances', () => {
    const instanceA = createNotificationManager();
    const instanceB = createNotificationManager();

    expect(instanceA).toBeInstanceOf(NotificationManager);
    expect(instanceB).toBeInstanceOf(NotificationManager);
    expect(instanceA).not.toBe(instanceB);
  });

  test('getNotificationManager returns singleton instance', () => {
    const instanceA = getNotificationManager();
    const instanceB = getNotificationManager();

    expect(instanceA).toBeInstanceOf(NotificationManager);
    expect(instanceB).toBe(instanceA);
  });
});

describe('NotificationManager Initialization', () => {
  test('initializes when permissions already granted', async () => {
    mockPermissionManager.isNotificationPermissionGranted.mockResolvedValue(
      true
    );

    const manager = createNotificationManager();
    await manager.initialize({ userId: 'user-1', projectId: 'project-1' });

    expect(mockRegisterAndroidChannels).toHaveBeenCalled();
    expect(
      mockPushNotificationService.registerDeviceToken
    ).toHaveBeenCalledWith({
      userId: 'user-1',
      projectId: 'project-1',
    });
  });

  test('initializes without user information', async () => {
    mockPermissionManager.isNotificationPermissionGranted.mockResolvedValue(
      true
    );

    const manager = createNotificationManager();
    await manager.initialize();

    expect(mockRegisterAndroidChannels).toHaveBeenCalled();
    expect(
      mockPushNotificationService.registerDeviceToken
    ).not.toHaveBeenCalled();
  });

  test('skips registration when permission denied', async () => {
    mockPermissionManager.isNotificationPermissionGranted.mockResolvedValue(
      false
    );

    const manager = createNotificationManager();
    await manager.initialize({ userId: 'user-1' });

    expect(mockRegisterAndroidChannels).not.toHaveBeenCalled();
    expect(
      mockPushNotificationService.registerDeviceToken
    ).not.toHaveBeenCalled();
  });
});

describe('NotificationManager Permissions', () => {
  test('requests permissions successfully', async () => {
    mockPermissionManager.isNotificationPermissionGranted.mockResolvedValue(
      true
    );

    const manager = createNotificationManager();
    await manager.initialize({ userId: 'user-1' });

    mockPermissionManager.requestNotificationPermission.mockResolvedValue(
      'granted'
    );
    const result = await manager.requestPermissions();

    expect(result).toEqual({ granted: true });
    expect(mockRegisterAndroidChannels).toHaveBeenCalledTimes(2);
    expect(
      mockPushNotificationService.registerDeviceToken
    ).toHaveBeenLastCalledWith({ userId: 'user-1', projectId: undefined });
  });

  test('returns denial when permission request fails', async () => {
    mockPermissionManager.requestNotificationPermission.mockResolvedValue(
      'denied'
    );

    const manager = createNotificationManager();
    const result = await manager.requestPermissions();

    expect(result).toEqual({ granted: false, error: 'PERMISSION_DENIED' });
  });
});

describe('NotificationManager Local Notifications', () => {
  test('schedules local reminder through service', async () => {
    const manager = createNotificationManager();
    const triggerDate = new Date('2024-03-10T10:00:00Z');

    const id = await manager.scheduleLocalReminder({
      title: 'Reminder',
      body: 'Body',
      triggerDate,
      androidChannelKey: 'reminders',
      threadId: 'thread-1',
    } as any);

    expect(id).toBe('notification-id');
    expect(
      mockLocalNotificationService.scheduleExactNotification
    ).toHaveBeenCalledWith({
      title: 'Reminder',
      body: 'Body',
      triggerDate,
      androidChannelKey: 'reminders',
      threadId: 'thread-1',
    });
  });
});

describe('NotificationManager Mutex Handling', () => {
  test('serializes concurrent initialize calls', async () => {
    mockPermissionManager.isNotificationPermissionGranted.mockResolvedValue(
      true
    );

    const manager = createNotificationManager();

    await Promise.all([
      manager.initialize({ userId: 'user-1' }),
      manager.initialize({ userId: 'user-2' }),
      manager.initialize({ userId: 'user-3' }),
    ]);

    expect(mockPushNotificationService.registerDeviceToken.mock.calls).toEqual([
      [{ userId: 'user-1', projectId: undefined }],
      [{ userId: 'user-2', projectId: undefined }],
      [{ userId: 'user-3', projectId: undefined }],
    ]);
  });

  test('prevents operations once disposed', async () => {
    mockPermissionManager.isNotificationPermissionGranted.mockResolvedValue(
      true
    );

    const manager = createNotificationManager();
    manager.dispose();

    await manager.initialize({ userId: 'user-1' });

    expect(mockRegisterAndroidChannels).not.toHaveBeenCalled();
    expect(
      mockPushNotificationService.registerDeviceToken
    ).not.toHaveBeenCalled();
  });
});

describe('NotificationManager Dispose', () => {
  test('cleans up token listener and subscriptions', () => {
    const manager = createNotificationManager();
    (manager as any).responseSubscription = { remove: mockResponseRemove };

    manager.dispose();

    expect(mockResponseRemove).toHaveBeenCalled();
    expect(mockPushNotificationService.stopTokenListener).toHaveBeenCalled();
  });
});

describe('NotificationManager Preferences', () => {
  test('returns defaults when no user set', async () => {
    const manager = createNotificationManager();
    const prefs = await manager.getPreferences();

    expect(prefs).toEqual({
      communityInteractions: true,
      communityLikes: true,
      cultivationReminders: true,
      systemUpdates: true,
      quietHoursEnabled: false,
      quietHoursStart: null,
      quietHoursEnd: null,
    });
  });
});
