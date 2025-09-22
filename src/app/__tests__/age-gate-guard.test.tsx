import type React from 'react';

import { cleanup, render, screen } from '@/lib/test-utils';

jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Text } = require('react-native');
  const Redirect = ({ href }: { href: string }) => (
    <Text testID="redirect-target">{href}</Text>
  );
  const Tabs = ({ children }: { children: React.ReactNode }) => <>{children}</>;
  Tabs.Screen = () => null;
  return {
    Redirect,
    Tabs,
    SplashScreen: { hideAsync: jest.fn() },
    Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

const mockedAuthStatus = jest.fn();
const mockedIsFirstTime = jest.fn();
const mockedAgeGateStatus = jest.fn();

jest.mock('@/lib', () => ({
  useAuth: { use: { status: mockedAuthStatus } },
  useIsFirstTime: mockedIsFirstTime,
  useAgeGate: { status: mockedAgeGateStatus },
}));

// Import after mocks to ensure they're applied
const { default: TabLayout } = jest.requireActual('@/app/(app)/_layout');

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

describe('TabLayout age gate guard', () => {
  test('redirects to age gate when status is blocked', () => {
    mockedAuthStatus.mockReturnValue('signIn');
    mockedIsFirstTime.mockReturnValue([false]);
    mockedAgeGateStatus.mockReturnValue('blocked');

    render(<TabLayout />);
    expect(screen.getByTestId('redirect-target').props.children).toBe(
      '/age-gate'
    );
  });

  test('renders tabs when age gate is verified', () => {
    mockedAuthStatus.mockReturnValue('signIn');
    mockedIsFirstTime.mockReturnValue([false]);
    mockedAgeGateStatus.mockReturnValue('verified');

    render(<TabLayout />);
    expect(screen.queryByTestId('redirect-target')).toBeNull();
  });
});
