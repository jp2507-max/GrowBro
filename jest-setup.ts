import '@testing-library/react-native/extend-expect';

// Print an immediate snapshot of active Node handles (one-time) to help
// debug CI hangs. This is intentionally lightweight and only logs constructors
// names to avoid leaking sensitive details.
try {
  const handles = (process as any)._getActiveHandles?.() ?? [];
  const names = handles.map((h: any) => h?.constructor?.name || String(h));

  console.warn('[open-handles-initial]', names.slice(0, 20));
} catch {}

// react-hook form setup for testing
// @ts-ignore
global.window = {};
// @ts-ignore
global.window = global;

// Type definitions for MMKV mock
type StoredValue = {
  type: 'string' | 'number' | 'boolean';
  value: string | number | boolean;
};

// mock: async-storage
jest.mock('@react-native-async-storage/async-storage', () => {
  try {
    // Defer import to avoid ESM resolution at top-level in Jest env
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('__mocks__/@react-native-async-storage/async-storage');
  } catch {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@react-native-async-storage/async-storage/jest/async-storage-mock');
  }
});

// mock: expo-notifications (avoid recursive require by returning plain object)
jest.mock('expo-notifications', () => {
  const addListener = jest.fn((_cb: any) => ({ remove: jest.fn() }));
  return {
    AndroidImportance: { DEFAULT: 3, HIGH: 4, LOW: 2, MIN: 1, NONE: 0 },
    AndroidNotificationVisibility: { PRIVATE: 0, PUBLIC: 1, SECRET: -1 },
    scheduleNotificationAsync: jest
      .fn()
      .mockResolvedValue('mock-notification-id'),
    cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
    setNotificationChannelAsync: jest.fn().mockResolvedValue(undefined),
    requestPermissionsAsync: jest
      .fn()
      .mockResolvedValue({ status: 'granted', canAskAgain: false }),
    getPermissionsAsync: jest
      .fn()
      .mockResolvedValue({ status: 'granted', canAskAgain: false }),
    addNotificationReceivedListener: addListener,
    addNotificationResponseReceivedListener: addListener,
  };
});

// mock: @nozbe/watermelondb (for database operations in tests)
jest.mock('@nozbe/watermelondb', () => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('__mocks__/@nozbe/watermelondb');
  } catch {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('__mocks__/@nozbe/watermelondb');
  }
});

// mock: react-native-reanimated to avoid native timers/threads in tests
jest.mock('react-native-reanimated', () => {
  // Silence the useNativeDriver warning
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mockReanimated = require('react-native-reanimated/mock');
  mockReanimated.default.call = () => {};
  return mockReanimated;
});

// mock: react-native-gesture-handler is now handled by moduleNameMapper in jest.config.js

// mock: react-native-edge-to-edge SystemBars to prevent native behavior in tests
jest.mock('react-native-edge-to-edge', () => ({
  SystemBars: () => null,
}));

// mock: @shopify/flash-list with a minimal stub that preserves API shape
jest.mock('@shopify/flash-list', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  const FlashList = React.forwardRef((_props: any, _ref: any) => null);
  return { FlashList };
});

// mock: react-navigation useIsFocused to return true in tests (no actual reference)
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
}));

// mock: react-native-flash-message showMessage as no-op
jest.mock('react-native-flash-message', () => ({
  showMessage: () => {},
}));

// mock: react-native-mmkv to avoid native bindings in Jest
jest.mock('react-native-mmkv', () => {
  class MMKVMock {
    private store: Map<string, StoredValue> = new Map();

    getString(key: string): string | null {
      const stored = this.store.get(key);
      return stored && stored.type === 'string'
        ? (stored.value as string)
        : null;
    }

    getNumber(key: string): number | null {
      const stored = this.store.get(key);
      return stored && stored.type === 'number'
        ? (stored.value as number)
        : null;
    }

    getBoolean(key: string): boolean | null {
      const stored = this.store.get(key);
      return stored && stored.type === 'boolean'
        ? (stored.value as boolean)
        : null;
    }

    set(key: string, value: string | number | boolean): void {
      const type = typeof value as 'string' | 'number' | 'boolean';
      this.store.set(key, { type, value });
    }

    delete(key: string): void {
      this.store.delete(key);
    }
  }
  return { MMKV: MMKVMock };
});

// Prefer the dedicated manual mock file for Watermelon sync (automock)
jest.mock('@nozbe/watermelondb/sync');

// mock: WatermelonDB decorators as no-op to avoid runtime decoration side effects
jest.mock('@nozbe/watermelondb/decorators', () => {
  const make = () => {
    return (..._args: any[]) => undefined;
  };
  return { text: make, date: make, json: make };
});

// mock: @dev-plugins/react-query (ES module issue in Jest)
jest.mock('@dev-plugins/react-query', () => ({
  useReactQueryDevTools: () => null,
}));

// mock: expo background task & task manager (native modules not available in Jest)
jest.mock('expo-task-manager', () => ({
  defineTask: jest.fn(),
  isTaskRegisteredAsync: jest.fn(async () => false),
}));

jest.mock('expo-background-task', () => ({
  registerTaskAsync: jest.fn(async () => undefined),
  unregisterTaskAsync: jest.fn(async () => undefined),
  getStatusAsync: jest.fn(async () => 0), // BackgroundTaskStatus.Available
  triggerTaskWorkerForTestingAsync: jest.fn(async () => undefined),
  BackgroundTaskStatus: { Available: 0, Restricted: 1, Unavailable: 2 },
  BackgroundTaskResult: { Success: 0, Failed: 1, Canceled: 2 },
}));

// mock: NetInfo to prevent internal native reachability errors in tests
jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(async () => ({
    type: 'wifi',
    isConnected: true,
    isInternetReachable: true,
    details: { isConnectionExpensive: false },
  })),
  addEventListener: jest.fn((cb: any) => {
    cb({
      type: 'wifi',
      isConnected: true,
      isInternetReachable: true,
      details: { isConnectionExpensive: false },
    });
    return () => {};
  }),
}));

// Global cleanup to reduce risk of hanging Jest due to stray timers or intervals
afterEach(() => {
  jest.clearAllTimers();
});

afterAll(() => {
  jest.clearAllTimers();
});

// Optional: when running locally or in CI you can enable DEBUG_OPEN_HANDLES=1
// to periodically print active Node handles. This helps debug what is keeping
// the process alive (sockets, intervals, native bindings, etc.). Disabled by
// default to avoid noisy logs.
if (process.env.DEBUG_OPEN_HANDLES) {
  try {
    const interval = setInterval(() => {
      try {
        // process._getActiveHandles is undocumented but useful for debugging
        // in a controlled environment.

        const handles = (process as any)._getActiveHandles?.() ?? [];
        const summary = handles.map(
          (h: any) => h?.constructor?.name || String(h)
        );
        // Keep output concise
        console.warn('[open-handles]', summary.slice(0, 10));
      } catch {
        // ignore
      }
    }, 2000);

    afterAll(() => clearInterval(interval));
  } catch {
    // ignore if not available
  }
}
