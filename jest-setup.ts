import '@testing-library/react-native/extend-expect';

import React from 'react';
import * as GestureHandler from 'react-native-gesture-handler/src/mocks';
// @ts-ignore - react-native-reanimated mock has no type definitions
import * as Reanimated from 'react-native-reanimated/mock';

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
  // Silence the useNativeDriver warning
  Reanimated.default.call = () => {};
  return Reanimated;
});

// mock: react-native-gesture-handler to jest mocks
jest.mock('react-native-gesture-handler', () => GestureHandler);

// mock: react-native-edge-to-edge SystemBars to prevent native behavior in tests
jest.mock('react-native-edge-to-edge', () => ({
  SystemBars: () => null,
}));

// mock: @shopify/flash-list with a minimal stub that preserves API shape
jest.mock('@shopify/flash-list', () => {
  const FlashList = React.forwardRef((_props: any, _ref: any) => {
    // Minimal stub that forwards ref and accepts FlashList props
    // Returns null to avoid rendering in tests while preserving API compatibility
    return null;
  });
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
