import { useScrollToTop } from '@react-navigation/native';
import React from 'react';
import { FlatList } from 'react-native';

import { Pressable, Text, View } from '@/components/ui';
import { cleanup, fireEvent, render, screen } from '@/lib/test-utils';

import CommunityScreen from '../community';

const analyticsTrackMock = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useScrollToTop: jest.fn(),
}));

jest.mock('@/lib', () => {
  const actual = jest.requireActual('@/lib');
  return {
    ...actual,
    translate: jest.fn((key: string) => key),
    useAnalytics: () => ({ track: analyticsTrackMock }),
  };
});

jest.mock('@/lib/hooks', () => {
  const actual = jest.requireActual('@/lib/hooks');
  return {
    ...actual,
    useScreenErrorLogger: jest.fn(),
  };
});

const postsInfiniteMock = jest.fn();

jest.mock('@/api', () => ({
  usePostsInfinite: (...args: any[]) => postsInfiniteMock(...args),
}));

jest.mock('@/components/card', () => ({
  Card: ({ id }: { id: string }) => (
    <View testID={`community-card-${id}`}>
      <Text>card {id}</Text>
    </View>
  ),
}));

jest.mock('@/components/compose-btn', () => ({
  ComposeBtn: ({ onPress }: { onPress: () => void }) => (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      testID="compose-btn"
    >
      <Text>compose</Text>
    </Pressable>
  ),
}));

jest.mock('@/components/cannabis-educational-banner', () => ({
  CannabisEducationalBanner: () => (
    <View testID="educational-banner">
      <Text>banner</Text>
    </View>
  ),
}));

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

const createPage = (items: any[] = []) => ({ results: items });

type HookState = ReturnType<typeof mockCommunityState>;

function mockCommunityState(): {
  data: { pages: { results: any[] }[] } | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  fetchNextPage: jest.Mock;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  refetch: jest.Mock;
} {
  return {
    data: { pages: [createPage()] },
    isLoading: false,
    isError: false,
    error: null,
    fetchNextPage: jest.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    refetch: jest.fn(),
  };
}

const renderCommunity = (state: Partial<HookState>) => {
  postsInfiniteMock.mockReturnValue({
    ...mockCommunityState(),
    ...state,
  });

  render(<CommunityScreen />);
};

describe('CommunityScreen', () => {
  beforeEach(() => {
    (useScrollToTop as jest.Mock).mockClear();
  });

  test('registers scroll to top handler', () => {
    renderCommunity({});

    expect(useScrollToTop).toHaveBeenCalled();
  });

  test('renders skeleton list while loading initial posts', () => {
    renderCommunity({ data: undefined, isLoading: true });

    expect(screen.getByTestId('community-skeleton-list')).toBeOnTheScreen();
  });

  test('renders empty state when no posts are available', () => {
    renderCommunity({ data: { pages: [createPage([])] } });

    expect(screen.getByTestId('community-empty-state')).toBeOnTheScreen();
  });

  test('renders error card when feed fails and retry triggers refetch', () => {
    const refetchMock = jest.fn();
    renderCommunity({
      data: { pages: [createPage([])] },
      isError: true,
      error: new Error('load failed'),
      refetch: refetchMock,
    });

    fireEvent.press(screen.getByTestId('community-error-card-retry'));

    expect(refetchMock).toHaveBeenCalled();
  });

  test('renders inline error card when posts exist and request fails', () => {
    renderCommunity({
      data: { pages: [createPage([{ id: '1' }])] },
      isError: true,
      error: new Error('error'),
    });

    expect(screen.getByTestId('community-inline-error')).toBeOnTheScreen();
  });

  test('shows footer loader when fetching next page', () => {
    renderCommunity({ isFetchingNextPage: true });

    expect(screen.getByTestId('community-footer-loader')).toBeOnTheScreen();
  });

  test('requests next page when list end reached and more data available', () => {
    const fetchNextPage = jest.fn();
    renderCommunity({ hasNextPage: true, fetchNextPage });

    const list = screen.UNSAFE_getByType(FlatList);
    fireEvent(list, 'onEndReached');

    expect(fetchNextPage).toHaveBeenCalled();
  });
});
