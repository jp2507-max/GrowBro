import { useRouter } from 'expo-router';
import React from 'react';

import { cleanup, fireEvent, render, screen } from '@/lib/test-utils';

import { SharedHeader } from './shared-header';

jest.mock('@/lib', () => {
  const actual = jest.requireActual('@/lib');
  return {
    ...actual,
    translate: jest.fn((key: string) => key),
  };
});

jest.mock('@/components/sync/connectivity-banner', () => {
  const { Pressable, Text } = jest.requireActual('@/components/ui');
  return {
    ConnectivityBanner: ({
      onPress,
      testID,
    }: {
      onPress?: () => void;
      testID?: string;
    }) => (
      <Pressable accessibilityRole="button" testID={testID} onPress={onPress}>
        <Text>connectivity</Text>
      </Pressable>
    ),
  };
});

jest.mock('@/components/sync/sync-status', () => {
  const { View, Text } = jest.requireActual('@/components/ui');
  return {
    SyncStatus: ({ testID }: { testID?: string }) => (
      <View testID={testID}>
        <Text>sync</Text>
      </View>
    ),
  };
});

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
}));

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

describe('SharedHeader', () => {
  const createSharedHeader = (
    override: Partial<React.ComponentProps<typeof SharedHeader>> = {}
  ) => {
    return (
      <SharedHeader
        routeName="community"
        rightComponent={<React.Fragment />}
        {...override}
      />
    );
  };

  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue({
      push: jest.fn(),
      replace: jest.fn(),
      back: jest.fn(),
      canGoBack: jest.fn(() => true),
    });
  });

  test('renders connectivity banner and sync status by default', () => {
    render(createSharedHeader());

    expect(
      screen.getByTestId('shared-header-connectivity-banner')
    ).toBeOnTheScreen();
    expect(screen.getByTestId('shared-header-sync-status')).toBeOnTheScreen();
  });

  test('omits connectivity banner when showConnectivity is false', () => {
    render(createSharedHeader({ showConnectivity: false }));

    expect(
      screen.queryByTestId('shared-header-connectivity-banner')
    ).not.toBeOnTheScreen();
    expect(screen.getByTestId('shared-header-sync-status')).toBeOnTheScreen();
  });

  test('pressing connectivity banner navigates to sync diagnostics', () => {
    const pushMock = jest.fn();
    (useRouter as jest.Mock).mockReturnValue({
      push: pushMock,
      replace: jest.fn(),
      back: jest.fn(),
      canGoBack: jest.fn(() => true),
    });

    render(createSharedHeader());

    const banner = screen.getByTestId('shared-header-connectivity-banner');
    fireEvent.press(banner);

    expect(pushMock).toHaveBeenCalledWith('/sync-diagnostics');
  });

  test('omits sync status when showSync is false', () => {
    render(createSharedHeader({ showSync: false }));

    expect(
      screen.getByTestId('shared-header-connectivity-banner')
    ).toBeOnTheScreen();
    expect(
      screen.queryByTestId('shared-header-sync-status')
    ).not.toBeOnTheScreen();
  });
});
