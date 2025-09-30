import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { PushNotificationService } from '@/lib/notifications/push-service';

jest.mock('@nozbe/watermelondb', () => ({
  Q: {
    where: (field: string, value: unknown) => ({ field, value }),
  },
}));

jest.mock('@/lib/watermelon', () => {
  const tokensStore: any[] = [];

  function wrap(record: any) {
    return {
      ...record,
      update: async (mutator: (model: any) => void) => {
        mutator(record);
      },
    };
  }

  function matches(record: any, condition: { field: string; value: unknown }) {
    if (!condition) return true;
    if (condition.field === 'user_id') {
      return record.userId === condition.value;
    }
    return record[condition.field] === condition.value;
  }

  const collection = {
    query: jest.fn((condition: { field: string; value: unknown }) => ({
      fetch: jest.fn(async () =>
        tokensStore.filter((record) => matches(record, condition)).map(wrap)
      ),
    })),
    create: jest.fn(async (creator: (model: any) => void) => {
      const record: any = {};
      await creator(record);
      tokensStore.push(record);
    }),
  };

  const database = {
    collections: {
      get: jest.fn(() => collection),
    },
    write: async (fn: () => Promise<void> | void) => {
      await fn();
    },
  };

  return {
    database,
    __getTokens: () => tokensStore,
    __resetTokens: () => {
      tokensStore.splice(0, tokensStore.length);
    },
  };
});

jest.mock('@/lib/supabase', () => {
  const pushTokensBuilder: any = {
    upsert: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
  };

  return {
    supabase: {
      from: jest.fn(() => pushTokensBuilder),
      rpc: jest.fn(),
    },
    __pushTokensBuilder: pushTokensBuilder,
    __reset: () => {
      pushTokensBuilder.upsert.mockClear();
      pushTokensBuilder.update.mockClear();
      pushTokensBuilder.eq.mockClear();
      pushTokensBuilder.neq.mockClear();
    },
  };
});

jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      eas: {
        projectId: 'project-id',
      },
    },
  },
}));

jest.mock('expo-notifications');

type TokenListener = (payload: { data: string | null }) => void;

type NotificationsMock = Record<string, any> & {
  addPushTokenListener: (listener: TokenListener) => { remove: () => void };
  getExpoPushTokenAsync: (_options?: unknown) => Promise<{ data?: string }>;
  __setMockExpoPushToken: (token: string | null) => void;
  __emitPushToken: (payload: string | null) => Promise<void>;
};

const pushTokenListeners = new Set<TokenListener>();
let currentMockToken: string | null = 'ExponentPushToken[MOCK]';

const notificationsMock = Notifications as unknown as NotificationsMock;

notificationsMock.addPushTokenListener = jest.fn((listener: TokenListener) => {
  pushTokenListeners.add(listener);
  return {
    remove: () => {
      pushTokenListeners.delete(listener);
    },
  };
});

notificationsMock.getExpoPushTokenAsync = jest.fn(async () => ({
  data: currentMockToken ?? undefined,
}));

notificationsMock.__setMockExpoPushToken = (token: string | null) => {
  currentMockToken = token;
};

notificationsMock.__emitPushToken = async (token: string | null) => {
  await Promise.all(
    Array.from(pushTokenListeners).map(async (listener) => {
      await listener({ data: token });
    })
  );
};
const mockWatermelon = jest.requireMock('@/lib/watermelon');
const mockSupabase = jest.requireMock('@/lib/supabase');

let originalJestWorkerId: string | undefined;

beforeAll(() => {
  originalJestWorkerId = process.env.JEST_WORKER_ID;
  (globalThis as any).__growbroWatermelonLoader = async () => mockWatermelon;
});

afterAll(() => {
  if (originalJestWorkerId === undefined) {
    delete process.env.JEST_WORKER_ID;
  } else {
    process.env.JEST_WORKER_ID = originalJestWorkerId;
  }
  delete (globalThis as any).__growbroWatermelonLoader;
});

beforeEach(() => {
  delete process.env.JEST_WORKER_ID;
  jest.clearAllMocks();
  pushTokenListeners.clear();
  notificationsMock.__setMockExpoPushToken('ExponentPushToken[DEVICE]');
  mockWatermelon.__resetTokens();
  mockSupabase.__reset();
  (Platform as any).OS = 'ios';
});

afterEach(() => {
  if (originalJestWorkerId === undefined) {
    delete process.env.JEST_WORKER_ID;
  } else {
    process.env.JEST_WORKER_ID = originalJestWorkerId;
  }
});

describe('registerDeviceToken - initial storage', () => {
  test('stores token locally and syncs remotely', async () => {
    const result = await PushNotificationService.registerDeviceToken({
      userId: 'user-1',
    });

    expect(result).toEqual({ token: 'ExponentPushToken[DEVICE]' });

    const tokens = mockWatermelon.__getTokens();
    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toMatchObject({
      token: 'ExponentPushToken[DEVICE]',
      userId: 'user-1',
      isActive: true,
    });

    const builder = mockSupabase.__pushTokensBuilder;

    // First update: deactivate any existing active tokens for this token (regardless of user)
    expect(builder.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ is_active: false })
    );

    // Second update: deactivate other tokens for this user
    expect(builder.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ is_active: false })
    );
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(builder.neq).toHaveBeenCalledWith(
      'token',
      'ExponentPushToken[DEVICE]'
    );

    // Then upsert the new active token
    expect(builder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        token: 'ExponentPushToken[DEVICE]',
        is_active: true,
      }),
      { onConflict: 'user_id,token' }
    );
  });
});

describe('registerDeviceToken - rotations', () => {
  test('deactivates stale tokens locally and remotely', async () => {
    await PushNotificationService.registerDeviceToken({ userId: 'user-1' });

    notificationsMock.__setMockExpoPushToken('ExponentPushToken[ROTATED]');
    await PushNotificationService.registerDeviceToken({ userId: 'user-1' });

    const tokens = mockWatermelon.__getTokens();
    expect(tokens).toHaveLength(2);
    const active = tokens.find(
      (token: any) => token.token === 'ExponentPushToken[ROTATED]'
    );
    const inactive = tokens.find(
      (token: any) => token.token === 'ExponentPushToken[DEVICE]'
    );

    expect(active?.isActive).toBe(true);
    expect(inactive?.isActive).toBe(false);

    const builder = mockSupabase.__pushTokensBuilder;
    expect(builder.neq).toHaveBeenCalledWith(
      'token',
      'ExponentPushToken[ROTATED]'
    );
  });
});

describe('token listener', () => {
  test('persists rotated tokens emitted by Expo', async () => {
    await PushNotificationService.startTokenListener({ userId: 'user-1' });

    await Promise.resolve(
      notificationsMock.__emitPushToken('ExponentPushToken[LISTENER]')
    );

    const tokens = mockWatermelon.__getTokens();
    expect(
      tokens.some((token: any) => token.token === 'ExponentPushToken[LISTENER]')
    ).toBe(true);
  });
});

describe('markTokenInactive', () => {
  test('toggles local and remote state', async () => {
    await PushNotificationService.registerDeviceToken({ userId: 'user-1' });

    await PushNotificationService.markTokenInactive(
      'ExponentPushToken[DEVICE]'
    );

    const tokens = mockWatermelon.__getTokens();
    const stored = tokens.find(
      (token: any) => token.token === 'ExponentPushToken[DEVICE]'
    );
    expect(stored?.isActive).toBe(false);

    const builder = mockSupabase.__pushTokensBuilder;
    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({ is_active: false })
    );
    expect(builder.eq).toHaveBeenCalledWith(
      'token',
      'ExponentPushToken[DEVICE]'
    );
  });
});
