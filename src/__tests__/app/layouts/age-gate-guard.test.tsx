import type React from 'react';

import { cleanup, render, screen } from '@/lib/test-utils';

jest.mock('expo-glass-effect', () => ({
  GlassView: ({ children }: { children: React.ReactNode }) => children,
  isLiquidGlassAvailable: () => false,
}));

jest.mock('@/components/settings/legal-update-banner', () => ({
  LegalUpdateBanner: () => null,
}));

jest.mock('@/components/settings/restore-account-banner', () => ({
  RestoreAccountBanner: () => null,
}));

jest.mock('@/lib/compliance/legal-acceptances', () => ({
  checkLegalVersionBumps: () => ({
    needsNotification: false,
    needsBlocking: false,
    documents: [],
  }),
}));

jest.mock('@/lib/hooks/use-pending-deletion', () => ({
  usePendingDeletion: () => ({
    pendingDeletion: null,
    hasPendingDeletion: false,
  }),
}));

jest.mock('@/lib/community/use-community-sync', () => ({
  useCommunitySync: jest.fn(),
}));

jest.mock('expo-router', () => {
  const React = require('react');

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

jest.mock('expo-router/unstable-native-tabs', () => {
  const React = require('react');
  const { View } = require('react-native');

  const NativeTabs = ({ children }: { children: React.ReactNode }) => (
    <View testID="native-tabs">{children}</View>
  );
  NativeTabs.Trigger = () => null;

  return {
    NativeTabs,
    Icon: () => null,
    Label: ({ children }: { children: React.ReactNode }) => <>{children}</>,
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

  test('redirects first-time users to age gate BEFORE onboarding', () => {
    mockedAuthStatus.mockReturnValue('signIn');
    mockedIsFirstTime.mockReturnValue([true, jest.fn()]); // First time user
    mockedAgeGateStatus.mockReturnValue('pending'); // Not yet verified

    render(<TabLayout />);
    // Age gate must come before onboarding - compliance requirement
    expect(screen.getByTestId('redirect-target').props.children).toBe(
      '/age-gate'
    );
  });

  test('redirects to onboarding only after age gate is verified', () => {
    mockedAuthStatus.mockReturnValue('signIn');
    mockedIsFirstTime.mockReturnValue([true, jest.fn()]); // First time user
    mockedAgeGateStatus.mockReturnValue('verified'); // Age verified

    render(<TabLayout />);
    // Now onboarding can proceed
    expect(screen.getByTestId('redirect-target').props.children).toBe(
      '/onboarding'
    );
  });
});
