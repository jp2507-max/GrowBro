import '@testing-library/react-native/extend-expect';

// react-hook form setup for testing
// @ts-ignore
global.window = {};
// @ts-ignore
global.window = global;

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
    return require('@nozbe/watermelondb');
  }
});

// mock: react-native-reanimated to avoid native timers/threads in tests
jest.mock('react-native-reanimated', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Reanimated = require('react-native-reanimated/mock');
  // Silence the useNativeDriver warning
  Reanimated.default.call = () => {};
  return Reanimated;
});

// mock: react-native-gesture-handler to jest mocks
jest.mock('react-native-gesture-handler', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('react-native-gesture-handler/src/mocks')
);

// mock: react-native-edge-to-edge SystemBars to prevent native behavior in tests
jest.mock('react-native-edge-to-edge', () => ({
  SystemBars: () => null,
}));

// mock: @shopify/flash-list with a simple FlatList-like component (no JSX in .ts file)
jest.mock('@shopify/flash-list', () => {
  const React = require('react');
  const { FlatList } = require('react-native');
  const FlashList = React.forwardRef((props: any, ref: any) =>
    React.createElement(FlatList, { ref, ...props })
  );
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
