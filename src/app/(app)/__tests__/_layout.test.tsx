import React from 'react';

import { cleanup, render } from '@/lib/test-utils';

import TabLayout from '../_layout';

const capturedTabsProps: any[] = [];
const capturedScreens: any[] = [];

jest.mock('expo-router', () => {
  const capturedTabsPropsModule: any[] = capturedTabsProps;
  const capturedScreensModule: any[] = capturedScreens;

  const Tabs = ({ children, ...props }: any) => {
    capturedTabsPropsModule.push(props);
    return <>{children}</>;
  };

  Tabs.Screen = (props: any) => {
    capturedScreensModule.push(props);
    return null;
  };

  return {
    Tabs,
    Link: ({ children }: any) => children ?? null,
    Redirect: ({ href }: any) => <>{href}</>,
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
      'plants',
      'strains',
    ]);

    capturedScreens.forEach((screen) => {
      expect(screen.options?.tabBarButtonTestID).toBeDefined();
    });
  });
});
