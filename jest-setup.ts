import '@testing-library/react-native/extend-expect';

// react-hook form setup for testing
// @ts-ignore
global.window = {};
// @ts-ignore
global.window = global;

// mock: async-storage
jest.mock('@react-native-async-storage/async-storage', () => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('__mocks__/@react-native-async-storage/async-storage');
  } catch {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@react-native-async-storage/async-storage/jest/async-storage-mock');
  }
});

// mock: expo-notifications (avoid recursive require by returning plain object)
jest.mock('expo-notifications', () => ({
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
}));

// (no Watermelon mocks) — rely on real setup used by existing tests
