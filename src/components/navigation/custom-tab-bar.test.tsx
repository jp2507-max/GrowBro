import React from 'react';

import { cleanup, fireEvent, render, screen } from '@/lib/test-utils';

import { CustomTabBar, handleTabPress } from './custom-tab-bar';

afterEach(cleanup);

// Mock navigation object
const mockNavigation: any = {
  navigate: jest.fn(),
  emit: jest.fn(),
};

// Mock state object
const mockState: any = {
  index: 0,
  routes: [
    { key: 'index', name: 'index' },
    { key: 'calendar', name: 'calendar' },
    { key: 'community', name: 'community' },
    { key: 'plants', name: 'plants' },
    { key: 'strains', name: 'strains' },
  ],
};
const routes = ['index', 'calendar', 'community', 'plants', 'strains'] as const;

jest.mock('@/lib', () => {
  const actual = jest.requireActual('@/lib');
  return {
    ...actual,
    translate: jest.fn((key: string) => key),
  };
});

const createTabBarProps = (
  override?: Partial<Parameters<typeof CustomTabBar>[0]>
) => ({
  navigation: mockNavigation,
  state: mockState,
  descriptors: {} as any,
  insets: { top: 0, right: 0, bottom: 0, left: 0 },
  ...override,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('handleTabPress', () => {
  test('emits tabPress event when pressing any tab', () => {
    handleTabPress(mockNavigation, mockState, 'index');

    expect(mockNavigation.emit).toHaveBeenCalledWith({
      type: 'tabPress',
      target: 'index',
      canPreventDefault: true,
    });
  });

  test('navigates to tab when tabPress event is not prevented and tab is not focused', () => {
    mockNavigation.emit.mockReturnValue({ defaultPrevented: false });

    handleTabPress(mockNavigation, { ...mockState, index: 1 }, 'index');

    expect(mockNavigation.navigate).toHaveBeenCalledWith('index');
  });

  test('does not navigate when tabPress event is prevented', () => {
    mockNavigation.emit.mockReturnValue({ defaultPrevented: true });

    handleTabPress(mockNavigation, mockState, 'calendar');

    expect(mockNavigation.navigate).not.toHaveBeenCalled();
  });

  test('does not navigate when tab is already focused', () => {
    mockNavigation.emit.mockReturnValue({ defaultPrevented: false });

    handleTabPress(mockNavigation, mockState, 'index');

    expect(mockNavigation.navigate).not.toHaveBeenCalled();
  });

  test('handles all tab routes correctly', () => {
    mockNavigation.emit.mockReturnValue({ defaultPrevented: false });

    routes.forEach((route, index) => {
      const stateWithDifferentFocus = {
        ...mockState,
        index: (index + 1) % routes.length,
      };
      handleTabPress(mockNavigation, stateWithDifferentFocus, route);

      expect(mockNavigation.emit).toHaveBeenCalledWith({
        type: 'tabPress',
        target: route,
        canPreventDefault: true,
      });
      expect(mockNavigation.navigate).toHaveBeenCalledWith(route);
    });
  });

  test('does nothing when route is not found', () => {
    handleTabPress(mockNavigation, mockState, 'nonexistent');

    expect(mockNavigation.emit).not.toHaveBeenCalled();
    expect(mockNavigation.navigate).not.toHaveBeenCalled();
  });
});

describe('CustomTabBar rendering', () => {
  test('renders accessible tab buttons with stable testIDs', () => {
    render(<CustomTabBar {...createTabBarProps()} />);

    routes.forEach((route, index) => {
      const tab = screen.getByTestId(`${route}-tab`);
      expect(tab).toBeOnTheScreen();
      expect(tab.props.accessibilityRole).toBe('tab');
      expect(tab.props.accessibilityState).toMatchObject({
        selected: index === mockState.index,
      });
    });
  });

  test('pressing focused tab emits event without navigation', () => {
    mockNavigation.emit.mockReturnValue({ defaultPrevented: false });
    render(<CustomTabBar {...createTabBarProps()} />);

    const focusedTab = screen.getByTestId('index-tab');
    fireEvent.press(focusedTab);

    expect(mockNavigation.emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'tabPress', target: 'index' })
    );
    expect(mockNavigation.navigate).not.toHaveBeenCalled();
  });

  test('pressing unfocused tab triggers navigation', () => {
    mockNavigation.emit.mockReturnValue({ defaultPrevented: false });
    const unfocusedState = { ...mockState, index: 2 };
    render(<CustomTabBar {...createTabBarProps({ state: unfocusedState })} />);

    const tab = screen.getByTestId('index-tab');
    fireEvent.press(tab);

    expect(mockNavigation.navigate).toHaveBeenCalledWith('index');
  });
});
