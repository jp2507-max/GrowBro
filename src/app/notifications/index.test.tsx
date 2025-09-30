import React from 'react';

import NotificationInboxScreen from '@/app/notifications';
import type { NotificationSnapshot } from '@/lib/notifications/notification-storage';
import { cleanup, fireEvent, render, screen, waitFor } from '@/lib/test-utils';
import { openLinkInBrowser } from '@/lib/utils';

const mockPush = jest.fn();
const mockTranslate = jest.fn(
  (key: string, options?: Record<string, unknown>) => {
    if (options && typeof options.count === 'number') {
      return `${key}:${options.count}`;
    }
    if (options && Object.keys(options).length > 0) {
      return `${key}:${JSON.stringify(options)}`;
    }
    return key;
  }
);

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/lib/i18n', () => {
  const actual = jest.requireActual('@/lib/i18n');
  return {
    ...actual,
    translate: (key: string, options?: Record<string, unknown>) =>
      mockTranslate(key, options),
  };
});

jest.mock('@/lib/utils', () => {
  const actual = jest.requireActual('@/lib/utils');
  return {
    ...actual,
    openLinkInBrowser: jest.fn(),
  };
});

jest.mock('react-native-css-interop', () => {
  const createInteropElement = (Component: any) => Component;
  const identity = (value: number) => value;
  return {
    __esModule: true,
    cssInterop: () => {},
    rem: (value: number) => value * 16,
    vh: identity,
    vw: identity,
    vmin: identity,
    vmax: identity,
    createInteropElement,
    default: {
      cssInterop: () => {},
      rem: (value: number) => value * 16,
      vh: identity,
      vw: identity,
      vmin: identity,
      vmax: identity,
      createInteropElement,
    },
  };
});

jest.mock('@shopify/flash-list', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');

  const FlashList = ({
    data = [],
    renderItem,
    ListEmptyComponent,
    testID,
    refreshControl,
    onEndReached,
    ...rest
  }: {
    data?: any[];
    renderItem?: ({
      item,
      index,
    }: {
      item: any;
      index: number;
    }) => React.ReactElement | null;
    ListEmptyComponent?: React.ComponentType | React.ReactElement | null;
    testID?: string;
    refreshControl?: React.ReactElement | null;
    onEndReached?: () => void;
  }) => {
    const items = Array.isArray(data) ? data : [];
    const children: React.ReactNode[] = [];

    if (items.length === 0 && ListEmptyComponent) {
      if (React.isValidElement(ListEmptyComponent)) {
        children.push(ListEmptyComponent as React.ReactElement);
      } else if (typeof ListEmptyComponent === 'function') {
        const Component = ListEmptyComponent as React.ComponentType;
        children.push(React.createElement(Component));
      }
    }

    if (typeof renderItem === 'function') {
      items.forEach((item, index) => {
        const view = renderItem({ item, index });
        if (view && React.isValidElement(view)) {
          children.push(
            React.cloneElement(view, {
              key: view.key ?? `${index}`,
            })
          );
        }
      });
    }

    return React.createElement(
      View,
      {
        ...rest,
        testID,
        refreshControl,
        onEndReached,
      },
      ...children
    );
  };

  return {
    __esModule: true,
    FlashList,
    default: FlashList,
  };
});

const openLinkMock = openLinkInBrowser as jest.Mock;
type StoreState = {
  status: string;
  error: string | null;
  items: NotificationSnapshot[];
  localCursor: number | null;
  remoteCursor: string | null;
  includeArchived: boolean;
  unreadCount: number;
  isLoadingMore: boolean;
  initialize: jest.Mock<
    Promise<void>,
    [options?: { includeArchived?: boolean }]
  >;
  refresh: jest.Mock<Promise<void>, []>;
  loadMore: jest.Mock<Promise<void>, []>;
  toggleArchived: jest.Mock<Promise<void>, [value: boolean]>;
  markAsRead: jest.Mock<Promise<void>, [ids: readonly string[]]>;
  markAllAsRead: jest.Mock<Promise<void>, []>;
  archive: jest.Mock<Promise<void>, [ids: readonly string[]]>;
  delete: jest.Mock<Promise<void>, [ids: readonly string[]]>;
};

function mockCreateStoreState(): StoreState {
  return {
    status: 'idle',
    error: null,
    items: [],
    localCursor: null,
    remoteCursor: null,
    includeArchived: false,
    unreadCount: 0,
    isLoadingMore: false,
    initialize: jest.fn().mockResolvedValue(undefined),
    refresh: jest.fn().mockResolvedValue(undefined),
    loadMore: jest.fn().mockResolvedValue(undefined),
    toggleArchived: jest.fn().mockResolvedValue(undefined),
    markAsRead: jest.fn().mockResolvedValue(undefined),
    markAllAsRead: jest.fn().mockResolvedValue(undefined),
    archive: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
  };
}

let mockStoreState = mockCreateStoreState();

jest.mock('@/lib/notifications/use-notification-center', () => ({
  useNotificationCenter: {
    use: new Proxy(
      {},
      {
        get: (_target, prop: string) => () =>
          (mockStoreState as Record<string, unknown>)[prop],
      }
    ),
  },
  __setNotificationCenterState: (updates: Partial<StoreState>) => {
    mockStoreState = { ...mockStoreState, ...updates };
  },
  __resetNotificationCenterState: () => {
    mockStoreState = mockCreateStoreState();
  },
  __getNotificationCenterState: () => mockStoreState,
}));

const {
  __setNotificationCenterState,
  __resetNotificationCenterState,
  __getNotificationCenterState,
} = jest.requireMock('@/lib/notifications/use-notification-center') as {
  __setNotificationCenterState: (updates: Partial<StoreState>) => void;
  __resetNotificationCenterState: () => void;
  __getNotificationCenterState: () => StoreState;
};

function createNotification(
  overrides: Partial<NotificationSnapshot> = {}
): NotificationSnapshot {
  return {
    id: overrides.id ?? `notif-${Math.random().toString(36).slice(2)}`,
    type: overrides.type ?? 'system.update',
    title: overrides.title ?? 'Title',
    body: overrides.body ?? 'Body',
    data: overrides.data ?? null,
    deepLink: overrides.deepLink ?? null,
    createdAt: overrides.createdAt ?? new Date('2025-09-29T10:00:00Z'),
    readAt: Object.prototype.hasOwnProperty.call(overrides, 'readAt')
      ? (overrides.readAt as Date | null)
      : null,
    expiresAt: overrides.expiresAt ?? null,
    archivedAt: overrides.archivedAt ?? null,
    deletedAt: overrides.deletedAt ?? null,
    messageId: overrides.messageId ?? null,
  };
}

function renderScreen() {
  render(<NotificationInboxScreen />);
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2025-09-29T12:00:00Z'));
  mockTranslate.mockReset();
  mockPush.mockReset();
  openLinkMock.mockReset();
  __resetNotificationCenterState();
});

afterEach(() => {
  cleanup();
  jest.useRealTimers();
});

describe('Initialization and loading states', () => {
  test('calls initialize on mount', async () => {
    renderScreen();

    const state = __getNotificationCenterState();
    await waitFor(() => expect(state.initialize).toHaveBeenCalledTimes(1));
  });

  test('shows loading placeholder', () => {
    __setNotificationCenterState({ status: 'loading' });

    renderScreen();

    expect(screen.getByTestId('notifications-loading')).toBeOnTheScreen();
  });
});

describe('Notification rendering', () => {
  test('groups notifications by day', () => {
    const created = new Date('2025-09-29T09:00:00Z');
    __setNotificationCenterState({
      status: 'ready',
      items: [
        createNotification({ id: 'first', createdAt: created }),
        createNotification({ id: 'second', createdAt: created }),
      ],
    });

    renderScreen();

    expect(screen.getAllByTestId('notifications-section-header')).toHaveLength(
      1
    );
    expect(screen.getByTestId('notification-row-first')).toBeOnTheScreen();
    expect(screen.getByTestId('notification-row-second')).toBeOnTheScreen();
  });

  test('filters to unread notifications', () => {
    __setNotificationCenterState({
      status: 'ready',
      items: [
        createNotification({ id: 'unread', readAt: null }),
        createNotification({
          id: 'read',
          readAt: new Date('2025-09-29T07:00:00Z'),
        }),
      ],
    });

    renderScreen();
    expect(screen.getByTestId('notification-row-read')).toBeOnTheScreen();

    fireEvent.press(screen.getByTestId('notifications-filter-unread'));

    expect(screen.getByTestId('notification-row-unread')).toBeOnTheScreen();
    expect(screen.queryByTestId('notification-row-read')).not.toBeOnTheScreen();
  });
});

describe('Notification actions', () => {
  test('mark as read forwards to store', () => {
    const markAsRead = jest.fn().mockResolvedValue(undefined);
    __setNotificationCenterState({
      status: 'ready',
      items: [createNotification({ id: 'target', readAt: null })],
      markAsRead,
    });

    renderScreen();
    fireEvent.press(screen.getByTestId('notification-row-target-mark-read'), {
      stopPropagation: jest.fn(),
    });

    expect(markAsRead).toHaveBeenCalledWith(['target']);
  });

  test('mark all as read uses store handler', () => {
    const markAllAsRead = jest.fn().mockResolvedValue(undefined);
    __setNotificationCenterState({
      status: 'ready',
      items: [createNotification({ id: 'one', readAt: null })],
      markAllAsRead,
    });

    renderScreen();
    fireEvent.press(screen.getByTestId('notifications-mark-all'));

    expect(markAllAsRead).toHaveBeenCalledTimes(1);
  });

  test('toggle archived switches includeArchived flag', () => {
    const toggleArchived = jest.fn().mockResolvedValue(undefined);
    __setNotificationCenterState({ toggleArchived });

    renderScreen();
    fireEvent.press(screen.getByTestId('notifications-toggle-archived'));

    expect(toggleArchived).toHaveBeenCalledWith(true);
  });

  test('load more triggers when more data available', () => {
    const loadMore = jest.fn().mockResolvedValue(undefined);
    __setNotificationCenterState({
      status: 'ready',
      localCursor: Date.now(),
      items: [createNotification({ id: 'existing' })],
      loadMore,
    });

    renderScreen();
    fireEvent(screen.getByTestId('notifications-list'), 'onEndReached');

    expect(loadMore).toHaveBeenCalledTimes(1);
  });
});

describe('Navigation', () => {
  test('internal deep link uses router push', () => {
    __setNotificationCenterState({
      status: 'ready',
      items: [createNotification({ id: 'internal', deepLink: '/community' })],
    });

    renderScreen();
    fireEvent.press(screen.getByTestId('notification-row-internal'));

    expect(mockPush).toHaveBeenCalledWith('/community');
    expect(openLinkMock).not.toHaveBeenCalled();
  });

  test('external deep link opens browser', () => {
    __setNotificationCenterState({
      status: 'ready',
      items: [
        createNotification({ id: 'external', deepLink: 'https://growbro.app' }),
      ],
    });

    renderScreen();
    fireEvent.press(screen.getByTestId('notification-row-external'));

    expect(openLinkMock).toHaveBeenCalledWith('https://growbro.app');
    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe('Error and refresh handling', () => {
  test('retry button invokes refresh', () => {
    const refresh = jest.fn().mockResolvedValue(undefined);
    __setNotificationCenterState({
      status: 'error',
      error: 'Network error',
      refresh,
    });

    renderScreen();
    fireEvent.press(screen.getByTestId('notifications-retry'));

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  test('pull to refresh forwards to store handler', () => {
    const refresh = jest.fn().mockResolvedValue(undefined);
    __setNotificationCenterState({
      status: 'ready',
      items: [createNotification({ id: 'refreshable' })],
      refresh,
    });

    renderScreen();
    const list = screen.getByTestId('notifications-list');
    list.props.refreshControl.props.onRefresh();

    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
