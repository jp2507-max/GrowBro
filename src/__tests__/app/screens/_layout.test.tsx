import React, { type ReactNode } from 'react';

import TabLayout from '@/app/(app)/_layout';
import { cleanup, render } from '@/lib/test-utils';

type TabsProps = Record<string, unknown>;
type ScreenProps = {
  name?: string;
  options?: { tabBarButtonTestID?: string };
};

const capturedTabsProps: TabsProps[] = [];
const capturedScreens: ScreenProps[] = [];

jest.mock('expo-router', () => {
  const capturedTabsPropsModule: TabsProps[] = capturedTabsProps;
  const capturedScreensModule: ScreenProps[] = capturedScreens;

  const Tabs = ({
    children,
    ...props
  }: { children?: ReactNode } & TabsProps) => {
    capturedTabsPropsModule.push(props);
    return <>{children}</>;
  };

  Tabs.Screen = (props: ScreenProps) => {
    capturedScreensModule.push(props);
    return null;
  };

  return {
    Tabs,
    Link: ({ children }: { children?: ReactNode }) => children ?? null,
    Redirect: ({ href }: { href: string }) => <>{href}</>,
    SplashScreen: {
      hideAsync: jest.fn(() => Promise.resolve()),
    },
  };
});

const statusSelector = jest.fn(() => 'signIn');
const ageGateStatusMock = jest.fn(() => 'verified');

jest.mock('@/lib', () => {
  const actual = jest.requireActual('@/lib');
  return {
    ...actual,
    translate: jest.fn((key: string) => key),
    useAuth: { use: { status: statusSelector } },
    useIsFirstTime: () => [false],
    useAgeGate: { status: ageGateStatusMock },
  };
});

jest.mock('@/components/navigation/shared-header', () => ({
  SharedHeader: () => null,
}));

afterEach(() => {
  cleanup();
  capturedTabsProps.length = 0;
  capturedScreens.length = 0;
});

describe('TabLayout', () => {
  test('sets tabBarHideOnKeyboard on Tabs screen options', () => {
    render(<TabLayout />);

    const props = capturedTabsProps[0];
    expect(props).toBeDefined();
    expect(props.tabBarHideOnKeyboard).toBe(true);
    expect(props.initialRouteName).toBe('index');
  });

  test('registers tabs for all primary screens with accessibility test IDs', () => {
    render(<TabLayout />);

    const screenNames = capturedScreens.map((screen) => screen.name);
    expect(screenNames).toEqual([
      'index',
      'calendar',
      'community',
      'inventory',
      'strains',
    ]);

    capturedScreens.forEach((screen) => {
      expect(screen.options?.tabBarButtonTestID).toBeDefined();
    });
  });
});
