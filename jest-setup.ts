import '@testing-library/react-native/extend-expect';

// Initialize __DEV__ global for tests
// This ensures the global declaration in src/types/global.d.ts is properly initialized
// Tests typically run in development mode, so we set it to true
Object.defineProperty(global, '__DEV__', {
  value: true,
  writable: true,
  configurable: true,
});

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
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- intentional conditional require for test environment
    return require('__mocks__/@react-native-async-storage/async-storage');
  } catch {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- fallback require for test environment
    return require('@react-native-async-storage/async-storage/jest/async-storage-mock');
  }
});

// mock: @env to provide test environment configuration
jest.mock('@env', () => ({
  Env: {
    APP_ACCESS_REVIEWER_EMAIL: 'test@example.com',
    APP_ACCESS_REVIEWER_PASSWORD: 'testpassword123',
    EXPO_PUBLIC_APP_ACCESS_REVIEWER_EMAIL: 'test@example.com',
    EXPO_PUBLIC_APP_ACCESS_REVIEWER_PASSWORD: 'testpassword123',
  },
}));

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

// Note: WatermelonDB is mocked via moduleNameMapper and __mocks__ folder.

// mock: react-native-reanimated to avoid native timers/threads in tests
jest.mock('react-native-reanimated', () => {
  // Silence the useNativeDriver warning
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- intentional require to load jest mock
  const mockReanimated = require('react-native-reanimated/mock');
  mockReanimated.default.call = () => {};
  return mockReanimated;
});

// mock: animated-scroll-list-provider to avoid context dependency in tests
jest.mock('@/lib/animations/animated-scroll-list-provider', () => ({
  useAnimatedScrollList: () => ({
    listRef: { current: null },
    scrollHandler: jest.fn(),
    listPointerEvents: { value: true },
    listOffsetY: { value: 0 },
    isDragging: { value: false },
    scrollDirection: { value: 'none' },
    offsetYAnchorOnBeginDrag: { value: 0 },
    offsetYAnchorOnChangeDirection: { value: 0 },
    velocityOnEndDrag: { value: 0 },
    enableAutoScrollLock: jest.fn(),
  }),
  AnimatedScrollListProvider: ({ children }: any) => children ?? null,
}));

// mock: bottom tab bar height hook
jest.mock('@/lib/animations/use-bottom-tab-bar-height', () => ({
  useBottomTabBarHeight: () => ({
    netHeight: 80,
    grossHeight: 80,
  }),
}));

// mock: nativewind exports used by components. Provide cssInterop no-op plus
// stubs for useColorScheme, colorScheme and setColorScheme so components that
// call these hooks in tests won't throw TypeError.
jest.mock('nativewind', () => {
  const setColorScheme = jest.fn();

  return {
    __esModule: true,
    cssInterop: (_component: any, _config: any) => {
      // no-op
    },
    // Hook used by several components. Return a stable shape used in the app.
    useColorScheme: () => ({ colorScheme: 'light', setColorScheme }),
    // Some components import `colorScheme` directly — export a simple value.
    colorScheme: 'light',
    setColorScheme,
  };
});

// mock: react-native-css-interop runtime to avoid installing wrappers and timers
jest.mock('react-native-css-interop', () => {
  const styled = (c: any) => c;
  const cssInterop = (_c: any, _cfg: any) => {};
  return {
    __esModule: true,
    styled,
    cssInterop,
  };
});

// mock: react-native-svg with lightweight React host components
jest.mock('react-native-svg', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- intentional require for lightweight SVG mocks
  const mockReact = require('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- intentional require for lightweight SVG mocks
  const mockRN = require('react-native');
  const View = mockRN.View;
  const Svg = (props: any) => mockReact.createElement(View, props);
  const Path = (props: any) => mockReact.createElement(View, props);
  const Circle = (props: any) => mockReact.createElement(View, props);
  const G = (props: any) => mockReact.createElement(View, props);
  return {
    __esModule: true,
    default: Svg,
    Svg,
    Path,
    Circle,
    G,
  };
});

// mock: react-native-gesture-handler is now handled by moduleNameMapper in jest.config.js

// mock: react-native-edge-to-edge SystemBars to prevent native behavior in tests
jest.mock('react-native-edge-to-edge', () => ({
  SystemBars: () => null,
}));

// mock: react-navigation to provide a minimal NavigationContainer and hooks
jest.mock('@react-navigation/native', () => {
  const NavigationContainer = ({ children }: any) => children ?? null;
  (NavigationContainer as any).displayName = 'NavigationContainer';
  return {
    NavigationContainer,
    useIsFocused: () => true,
    useScrollToTop: () => {},
    // Provide identity ThemeProvider/value to satisfy consumers if used
    ThemeProvider: ({ children, _value }: any) => children ?? null,
    DefaultTheme: {},
    DarkTheme: {},
  };
});

// mock: react-native-flash-message showMessage as no-op
jest.mock('react-native-flash-message', () => ({
  showMessage: () => {},
}));

// mock: react-native-safe-area-context to avoid dependency on native context/provider
jest.mock('react-native-safe-area-context', () => {
  const SafeAreaProvider = ({ children }: any) => children ?? null;
  const SafeAreaView = ({ children }: any) => children ?? null;
  (SafeAreaProvider as any).displayName = 'SafeAreaProvider';
  (SafeAreaView as any).displayName = 'SafeAreaView';
  return {
    SafeAreaProvider,
    SafeAreaView,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
    initialWindowMetrics: {
      frame: { x: 0, y: 0, width: 0, height: 0 },
      insets: { top: 0, right: 0, bottom: 0, left: 0 },
    },
  };
});

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

// mock: @sentry/react-native to avoid native module side effects that can keep
// the Jest process alive on some environments (e.g. Windows)
jest.mock('@sentry/react-native', () => {
  const sentry = {
    init: jest.fn(),
    wrap: (comp: any) => comp,
    withTouchEventBoundary: (comp: any) => comp,
    captureException: jest.fn(),
    captureMessage: jest.fn(),
    setContext: jest.fn(),
    mobileReplayIntegration: jest.fn(() => ({})),
    feedbackIntegration: jest.fn(() => ({})),
    reactNavigationIntegration: jest.fn(() => ({})),
  };
  return sentry;
});

// mock: react-native-restart to avoid trying to reload the app during tests
jest.mock('react-native-restart', () => ({ restart: jest.fn() }));

// Prefer the dedicated manual mock file for Watermelon sync (automock)
jest.mock('@nozbe/watermelondb/sync');

// mock: WatermelonDB decorators as no-op to avoid runtime decoration side effects
jest.mock('@nozbe/watermelondb/decorators', () => {
  // For decorators that are used as factories like @text('col'), return a
  // function that accepts the column name and returns an actual decorator
  // function. For plain decorators like @readonly, return a decorator
  // function directly. The decorator functions simply return the descriptor
  // unchanged which is sufficient for tests that only need to import the
  // models without runtime DB wiring.
  const makeFactory = () => {
    return (_name?: any) => {
      return (_target: any, _propertyKey: any, descriptor?: any) => descriptor;
    };
  };

  const makeDecorator = () => {
    return (_target: any, _propertyKey: any, descriptor?: any) => descriptor;
  };

  return {
    text: makeFactory(),
    date: makeFactory(),
    json: makeFactory(),
    field: makeFactory(),
    readonly: makeDecorator(),
  };
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

// mock: expo-router to avoid native navigation in tests
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
  }),
  useLocalSearchParams: () => ({}),
  useSearchParams: () => ({}),
  useSegments: () => [],
  usePathname: () => '/',
  Link: ({ children, ..._props }: any) => children ?? null,
  Stack: {
    Screen: ({ children, ..._props }: any) => children ?? null,
  },
  Tabs: {
    Screen: ({ children, ..._props }: any) => children ?? null,
  },
}));

// Global cleanup to reduce risk of hanging Jest due to stray timers or intervals
afterEach(() => {
  jest.clearAllTimers();
});

afterAll(() => {
  jest.clearAllTimers();
});

// Ensure i18next shuts down any internal resources after the test run to
// reduce the chance of open handles in Node (especially on Windows)
afterAll(async () => {
  try {
    const mod = await import('./src/lib/i18n');
    const i18n = (mod as any).default;
    i18n?.stop?.();
  } catch {
    // ignore if i18n cannot be imported
  }
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
