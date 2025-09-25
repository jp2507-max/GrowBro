import { useScrollToTop } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React from 'react';
import { FlatList } from 'react-native';

import { cleanup, fireEvent, render, screen } from '@/lib/test-utils';

import StrainsScreen from '../strains';
jest.mock('@react-navigation/native', () => ({
  useScrollToTop: jest.fn(),
}));

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
}));
const _analyticsTrackMock = jest.fn();

jest.mock('@/lib', () => {
  const actual = jest.requireActual('@/lib');
  return {
    ...actual,
    translate: jest.fn((key: string) => key),
    useAnalytics: () => ({ track: _analyticsTrackMock }),
  };
});

const networkStatusMock = jest.fn(() => ({
  isConnected: true,
  isInternetReachable: true,
  state: null,
}));

jest.mock('@/lib/hooks', () => {
  const actual = jest.requireActual('@/lib/hooks');
  return {
    ...actual,
    useNetworkStatus: () => networkStatusMock(),
    useScreenErrorLogger: jest.fn(),
  };
});

const strainsInfiniteMock = jest.fn();

jest.mock('@/api', () => ({
  useStrainsInfinite: (...args: any[]) => strainsInfiniteMock(...args),
}));

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
  jest.useRealTimers();
});

type Page<T> = { results: T[] };

type HookState = ReturnType<typeof mockStrainsState>;

function mockStrainsState(): {
  data: { pages: Page<any>[] } | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  fetchNextPage: jest.Mock;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  refetch: jest.Mock;
} {
  return {
    data: { pages: [{ results: [] }] },
    isLoading: false,
    isError: false,
    error: null,
    fetchNextPage: jest.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    refetch: jest.fn(),
  };
}

const renderStrains = (state: Partial<HookState>) => {
  strainsInfiniteMock.mockReturnValue({
    ...mockStrainsState(),
    ...state,
  });

  render(<StrainsScreen />);
};

beforeEach(() => {
  (useScrollToTop as jest.Mock).mockClear();
  (useRouter as jest.Mock).mockReturnValue({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
  });
  networkStatusMock.mockReturnValue({
    isConnected: true,
    isInternetReachable: true,
    state: null,
  });
});

describe('StrainsScreen basics', () => {
  test('registers scroll to top handler', () => {
    renderStrains({});

    expect(useScrollToTop).toHaveBeenCalled();
  });

  test('renders skeleton while loading', () => {
    renderStrains({ data: undefined, isLoading: true });

    expect(screen.getByTestId('strains-skeleton-list')).toBeOnTheScreen();
  });

  test('renders empty state when no strains found', () => {
    renderStrains({ data: { pages: [{ results: [] }] } });

    expect(screen.getByTestId('strains-empty-state')).toBeOnTheScreen();
  });

  test('renders error card when request fails', () => {
    renderStrains({
      data: { pages: [{ results: [] }] },
      isError: true,
      error: new Error('failed'),
    });

    expect(screen.getByTestId('strains-error-card')).toBeOnTheScreen();
  });
});

describe('StrainsScreen connectivity', () => {
  test('shows offline banner when network is unavailable', () => {
    networkStatusMock.mockReturnValue({
      isConnected: false,
      isInternetReachable: false,
      state: null,
    });

    renderStrains({});

    expect(screen.getByTestId('strains-offline-banner')).toBeOnTheScreen();
  });
});

describe('StrainsScreen pagination', () => {
  test('fetches next page when reaching list end and online', () => {
    const fetchNextPage = jest.fn();
    renderStrains({ hasNextPage: true, fetchNextPage });

    const list = screen.UNSAFE_getByType(FlatList);
    fireEvent(list, 'onEndReached');

    expect(fetchNextPage).toHaveBeenCalled();
  });

  test('does not fetch next page when offline', () => {
    const fetchNextPage = jest.fn();
    networkStatusMock.mockReturnValue({
      isConnected: false,
      isInternetReachable: false,
      state: null,
    });

    renderStrains({ hasNextPage: true, fetchNextPage });

    const list = screen.UNSAFE_getByType(FlatList);
    fireEvent(list, 'onEndReached');

    expect(fetchNextPage).not.toHaveBeenCalled();
  });
});

describe('StrainsScreen search', () => {
  test('debounces search queries before calling data hook', () => {
    jest.useFakeTimers();
    renderStrains({});

    const input = screen.getByTestId('strains-search-input');
    fireEvent.changeText(input, 'Blue Dream');

    const initialCalls = strainsInfiniteMock.mock.calls.length;
    expect(initialCalls).toBeGreaterThan(0);

    jest.advanceTimersByTime(200);
    expect(strainsInfiniteMock.mock.calls.length).toBe(initialCalls);

    jest.advanceTimersByTime(150);

    const lastCall =
      strainsInfiniteMock.mock.calls[strainsInfiniteMock.mock.calls.length - 1];
    expect(lastCall?.[0]).toMatchObject({ variables: { query: 'Blue Dream' } });
  });
});

describe('StrainsScreen navigation', () => {
  test('navigates to strain details when card pressed', () => {
    const pushMock = jest.fn();
    (useRouter as jest.Mock).mockReturnValue({
      push: pushMock,
      replace: jest.fn(),
      back: jest.fn(),
      canGoBack: jest.fn(() => true),
    });

    renderStrains({
      data: {
        pages: [
          {
            results: [{ id: 'strain-1', name: 'Demo' }],
          },
        ],
      },
    });

    const card = screen.getByTestId('strain-card-strain-1');
    fireEvent.press(card);

    expect(pushMock).toHaveBeenCalledWith('/strains/strain-1');
  });
});
