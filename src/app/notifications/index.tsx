import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import React from 'react';
import { RefreshControl, StyleSheet } from 'react-native';

import { NotificationRow } from '@/components/notifications/notification-row';
import { NotificationSectionHeader } from '@/components/notifications/notification-section-header';
import { ActivityIndicator, Pressable, Text, View } from '@/components/ui';
import i18n, { translate, type TxKeyPath } from '@/lib/i18n';
import {
  buildNotificationListItems,
  type NotificationListItem,
} from '@/lib/notifications/notification-list-helpers';
import type { NotificationSnapshot } from '@/lib/notifications/notification-storage';
import {
  type NotificationCenterStatus,
  useNotificationCenter,
} from '@/lib/notifications/use-notification-center';
import { openLinkInBrowser } from '@/lib/utils';

const listContentStyles = StyleSheet.create({
  content: {
    paddingBottom: 24,
  },
});

type FilterKey = 'all' | 'unread';

type FilterConfig = {
  readonly key: FilterKey;
  readonly labelKey: TxKeyPath;
  readonly testID: string;
};

const FILTERS: readonly FilterConfig[] = [
  {
    key: 'all',
    labelKey: 'notifications.inbox.filters.all',
    testID: 'notifications-filter-all',
  },
  {
    key: 'unread',
    labelKey: 'notifications.inbox.filters.unread',
    testID: 'notifications-filter-unread',
  },
];

type HeaderProps = {
  readonly filter: FilterKey;
  readonly onFilterChange: (key: FilterKey) => void;
  readonly includeArchived: boolean;
  readonly onToggleArchived: (value: boolean) => void;
  readonly onMarkAll: () => void;
  readonly unreadCount: number;
};

function NotificationHeader({
  filter,
  onFilterChange,
  includeArchived,
  onToggleArchived,
  onMarkAll,
  unreadCount,
}: HeaderProps): React.ReactElement {
  return (
    <View className="gap-4 px-4 pb-4 pt-6">
      <UnreadSummary count={unreadCount} />
      <View className="flex-row items-center justify-between">
        <FilterGroup current={filter} onChange={onFilterChange} />
        <Pressable
          accessibilityHint={translate('notifications.inbox.mark_all_hint')}
          accessibilityRole="button"
          className="rounded-full bg-primary-600 px-4 py-2"
          onPress={onMarkAll}
          testID="notifications-mark-all"
        >
          <Text className="text-xs font-semibold uppercase tracking-wide text-neutral-50">
            {translate('notifications.inbox.mark_all_read')}
          </Text>
        </Pressable>
      </View>
      <Pressable
        accessibilityHint={translate(
          'notifications.inbox.archived.toggle_hint'
        )}
        accessibilityRole="button"
        className="self-start rounded-full border border-neutral-200 px-4 py-2 dark:border-neutral-700"
        onPress={() => onToggleArchived(!includeArchived)}
        testID="notifications-toggle-archived"
      >
        <Text className="text-xs font-semibold uppercase tracking-wide text-neutral-700 dark:text-neutral-200">
          {translate(
            includeArchived
              ? 'notifications.inbox.archived.hide'
              : 'notifications.inbox.archived.show'
          )}
        </Text>
      </Pressable>
    </View>
  );
}

type FilterGroupProps = {
  readonly current: FilterKey;
  readonly onChange: (key: FilterKey) => void;
};

function FilterGroup({
  current,
  onChange,
}: FilterGroupProps): React.ReactElement {
  return (
    <View className="flex-row gap-2">
      {FILTERS.map((filter) => {
        const isActive = current === filter.key;
        return (
          <Pressable
            key={filter.key}
            accessibilityRole="button"
            className={`rounded-full px-4 py-2 ${
              isActive
                ? 'bg-primary-600'
                : 'border border-neutral-200 dark:border-neutral-700'
            }`}
            onPress={() => onChange(filter.key)}
            testID={filter.testID}
          >
            <Text
              className={`text-xs font-semibold uppercase tracking-wide ${
                isActive
                  ? 'text-neutral-50'
                  : 'text-neutral-700 dark:text-neutral-200'
              }`}
            >
              {translate(filter.labelKey)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function UnreadSummary({
  count,
}: {
  readonly count: number;
}): React.ReactElement {
  const key: TxKeyPath =
    count === 0
      ? 'notifications.inbox.unread_count_zero'
      : count === 1
        ? 'notifications.inbox.unread_count_one'
        : 'notifications.inbox.unread_count_other';

  return (
    <View
      accessibilityLiveRegion="polite"
      className="self-start rounded-full bg-neutral-200 px-4 py-1 dark:bg-neutral-800"
      testID="notifications-unread-summary"
    >
      <Text className="text-xs font-semibold text-neutral-700 dark:text-neutral-100">
        {translate(key, { count })}
      </Text>
    </View>
  );
}

function ErrorState({
  onRetry,
}: {
  readonly onRetry: () => void;
}): React.ReactElement {
  return (
    <View className="flex-1 items-center justify-center gap-3 px-8">
      <Text className="text-center text-lg font-semibold text-neutral-900 dark:text-neutral-100">
        {translate('notifications.inbox.error.title')}
      </Text>
      <Text className="text-center text-sm text-neutral-600 dark:text-neutral-300">
        {translate('notifications.inbox.error.body')}
      </Text>
      <Pressable
        accessibilityRole="button"
        className="rounded-full bg-primary-600 px-5 py-2"
        onPress={onRetry}
        testID="notifications-retry"
      >
        <Text className="text-sm font-semibold text-neutral-50">
          {translate('notifications.inbox.error.retry')}
        </Text>
      </Pressable>
    </View>
  );
}

function EmptyState({
  filter,
}: {
  readonly filter: FilterKey;
}): React.ReactElement {
  const titleKey: TxKeyPath =
    filter === 'unread'
      ? 'notifications.inbox.empty.unread.title'
      : 'notifications.inbox.empty.all.title';
  const bodyKey: TxKeyPath =
    filter === 'unread'
      ? 'notifications.inbox.empty.unread.body'
      : 'notifications.inbox.empty.all.body';

  return (
    <View className="flex-1 items-center justify-center gap-2 px-8">
      <Text className="text-center text-lg font-semibold text-neutral-900 dark:text-neutral-100">
        {translate(titleKey)}
      </Text>
      <Text className="text-center text-sm text-neutral-600 dark:text-neutral-300">
        {translate(bodyKey)}
      </Text>
    </View>
  );
}

function LoadingState({
  testID = 'notifications-loading',
}: {
  readonly testID?: string;
}): React.ReactElement {
  return (
    <View className="flex-1 items-center justify-center" testID={testID}>
      <ActivityIndicator />
    </View>
  );
}

function FooterLoader({
  isVisible,
}: {
  readonly isVisible: boolean;
}): React.ReactElement | null {
  if (!isVisible) return null;
  return (
    <View className="py-4" testID="notifications-loading-more">
      <ActivityIndicator />
    </View>
  );
}

type NotificationInboxViewModel = {
  readonly filter: FilterKey;
  readonly includeArchived: boolean;
  readonly unreadCount: number;
  readonly listItems: NotificationListItem[];
  readonly isRefreshing: boolean;
  readonly isLoadingMore: boolean;
  readonly showLoading: boolean;
  readonly showError: boolean;
  readonly showEmpty: boolean;
  readonly onFilterChange: (key: FilterKey) => void;
  readonly onToggleArchived: (value: boolean) => void;
  readonly onMarkAll: () => void;
  readonly onRefresh: () => void;
  readonly onRetry: () => void;
  readonly onLoadMore: () => void;
  readonly onOpen: (notification: NotificationSnapshot) => void;
  readonly onMarkAsRead: (notification: NotificationSnapshot) => void;
};

export default function NotificationInboxScreen(): React.ReactElement {
  const viewModel = useNotificationInbox();
  return <NotificationInboxLayout {...viewModel} />;
}

function NotificationInboxLayout({
  filter,
  includeArchived,
  unreadCount,
  listItems,
  isRefreshing,
  isLoadingMore,
  showLoading,
  showError,
  showEmpty,
  onFilterChange,
  onToggleArchived,
  onMarkAll,
  onRefresh,
  onRetry,
  onLoadMore,
  onOpen,
  onMarkAsRead,
}: NotificationInboxViewModel): React.ReactElement {
  return (
    <View className="flex-1 bg-neutral-50 dark:bg-charcoal-950">
      <NotificationHeader
        filter={filter}
        onFilterChange={onFilterChange}
        includeArchived={includeArchived}
        onToggleArchived={onToggleArchived}
        onMarkAll={onMarkAll}
        unreadCount={unreadCount}
      />
      <NotificationInboxBody
        filter={filter}
        listItems={listItems}
        isRefreshing={isRefreshing}
        isLoadingMore={isLoadingMore}
        showLoading={showLoading}
        showError={showError}
        showEmpty={showEmpty}
        onRefresh={onRefresh}
        onRetry={onRetry}
        onLoadMore={onLoadMore}
        onOpen={onOpen}
        onMarkAsRead={onMarkAsRead}
      />
    </View>
  );
}

type NotificationInboxBodyProps = {
  readonly filter: FilterKey;
  readonly listItems: NotificationListItem[];
  readonly isRefreshing: boolean;
  readonly isLoadingMore: boolean;
  readonly showLoading: boolean;
  readonly showError: boolean;
  readonly showEmpty: boolean;
  readonly onRefresh: () => void;
  readonly onRetry: () => void;
  readonly onLoadMore: () => void;
  readonly onOpen: (notification: NotificationSnapshot) => void;
  readonly onMarkAsRead: (notification: NotificationSnapshot) => void;
};

function NotificationInboxBody({
  filter,
  listItems,
  isRefreshing,
  isLoadingMore,
  showLoading,
  showError,
  showEmpty,
  onRefresh,
  onRetry,
  onLoadMore,
  onOpen,
  onMarkAsRead,
}: NotificationInboxBodyProps): React.ReactElement {
  if (showLoading) {
    return <LoadingState />;
  }

  if (showError) {
    return <ErrorState onRetry={onRetry} />;
  }

  if (showEmpty) {
    return <EmptyState filter={filter} />;
  }

  return (
    <NotificationListView
      items={listItems}
      isRefreshing={isRefreshing}
      isLoadingMore={isLoadingMore}
      onRefresh={onRefresh}
      onLoadMore={onLoadMore}
      onOpen={onOpen}
      onMarkAsRead={onMarkAsRead}
    />
  );
}

type NotificationListViewProps = {
  readonly items: NotificationListItem[];
  readonly isRefreshing: boolean;
  readonly isLoadingMore: boolean;
  readonly onRefresh: () => void;
  readonly onLoadMore: () => void;
  readonly onOpen: (notification: NotificationSnapshot) => void;
  readonly onMarkAsRead: (notification: NotificationSnapshot) => void;
};

function NotificationListView({
  items,
  isRefreshing,
  isLoadingMore,
  onRefresh,
  onLoadMore,
  onOpen,
  onMarkAsRead,
}: NotificationListViewProps): React.ReactElement {
  const renderItem = React.useCallback(
    ({ item }: { item: NotificationListItem }) => {
      if (item.type === 'section') {
        return <NotificationSectionHeader label={item.label} />;
      }

      return (
        <NotificationRow
          notification={item.notification}
          timestampLabel={item.timestampLabel}
          markAsReadLabel={translate('notifications.inbox.mark_read')}
          unreadLabel={translate('notifications.inbox.unread_badge')}
          openHint={translate('notifications.inbox.open_hint')}
          onOpen={onOpen}
          onMarkAsRead={onMarkAsRead}
        />
      );
    },
    [onMarkAsRead, onOpen]
  );

  return (
    <FlashList
      data={items}
      keyExtractor={(item) => item.key}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
      }
      renderItem={renderItem}
      onEndReached={onLoadMore}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={listContentStyles.content}
      ListFooterComponent={<FooterLoader isVisible={isLoadingMore} />}
      testID="notifications-list"
    />
  );
}

function useNotificationInbox(): NotificationInboxViewModel {
  const router = useRouter();
  const [filter, setFilter] = React.useState<FilterKey>('all');

  const selectors = useNotificationCenterSelectors();

  const {
    status,
    error,
    items,
    includeArchived,
    unreadCount,
    isLoadingMore,
    initialize,
    refresh,
    loadMore,
    toggleArchived,
    markAsRead,
    markAllAsRead,
  } = selectors;

  React.useEffect(() => {
    if (status === 'idle') {
      void initialize();
    }
  }, [initialize, status]);

  const derived = useNotificationDerivedState({
    filter,
    items,
    status,
    error,
  });

  const handlers = useNotificationHandlers({
    router,
    markAsRead,
    markAllAsRead,
    toggleArchived,
    refresh,
    loadMore,
  });

  return {
    filter,
    includeArchived,
    unreadCount,
    listItems: derived.listItems,
    isRefreshing: derived.isRefreshing,
    isLoadingMore,
    showLoading: derived.showLoading,
    showError: derived.showError,
    showEmpty: derived.showEmpty,
    onFilterChange: setFilter,
    onToggleArchived: handlers.onToggleArchived,
    onMarkAll: handlers.onMarkAll,
    onRefresh: handlers.onRefresh,
    onRetry: handlers.onRetry,
    onLoadMore: handlers.onLoadMore,
    onOpen: handlers.onOpen,
    onMarkAsRead: handlers.onMarkAsRead,
  };
}

type NotificationCenterSelectors = {
  readonly status: NotificationCenterStatus;
  readonly error: string | null;
  readonly items: NotificationSnapshot[];
  readonly includeArchived: boolean;
  readonly unreadCount: number;
  readonly isLoadingMore: boolean;
  readonly initialize: () => Promise<void>;
  readonly refresh: () => Promise<void>;
  readonly loadMore: () => Promise<void>;
  readonly toggleArchived: (value: boolean) => Promise<void>;
  readonly markAsRead: (ids: readonly string[]) => Promise<void>;
  readonly markAllAsRead: () => Promise<void>;
};

function useNotificationCenterSelectors(): NotificationCenterSelectors {
  const status = useNotificationCenter.use.status();
  const error = useNotificationCenter.use.error();
  const items = useNotificationCenter.use.items();
  const includeArchived = useNotificationCenter.use.includeArchived();
  const unreadCount = useNotificationCenter.use.unreadCount();
  const isLoadingMore = useNotificationCenter.use.isLoadingMore();
  const initialize = useNotificationCenter.use.initialize();
  const refresh = useNotificationCenter.use.refresh();
  const loadMore = useNotificationCenter.use.loadMore();
  const toggleArchived = useNotificationCenter.use.toggleArchived();
  const markAsRead = useNotificationCenter.use.markAsRead();
  const markAllAsRead = useNotificationCenter.use.markAllAsRead();

  return {
    status,
    error,
    items,
    includeArchived,
    unreadCount,
    isLoadingMore,
    initialize,
    refresh,
    loadMore,
    toggleArchived,
    markAsRead,
    markAllAsRead,
  };
}

type NotificationDerivedState = {
  readonly listItems: NotificationListItem[];
  readonly isRefreshing: boolean;
  readonly showLoading: boolean;
  readonly showError: boolean;
  readonly showEmpty: boolean;
};

function useNotificationDerivedState({
  filter,
  items,
  status,
  error,
}: {
  readonly filter: FilterKey;
  readonly items: readonly NotificationSnapshot[];
  readonly status: NotificationCenterStatus;
  readonly error: string | null;
}): NotificationDerivedState {
  const filteredNotifications = React.useMemo(
    () => filterNotifications(items, filter),
    [items, filter]
  );

  const locale = React.useMemo(() => resolveLocale(), []);
  const listItems = React.useMemo(
    () =>
      buildNotificationListItems({
        notifications: filteredNotifications,
        locale,
        now: new Date(),
        translate,
      }),
    [filteredNotifications, locale]
  );

  const hasNotifications = filteredNotifications.length > 0;
  const showLoading = status === 'loading' && items.length === 0;
  const showError = status === 'error' && Boolean(error);
  const showEmpty = !showLoading && !showError && !hasNotifications;
  const isRefreshing = status === 'loading' && items.length > 0;

  return {
    listItems,
    isRefreshing,
    showLoading,
    showError,
    showEmpty,
  };
}

type NotificationHandlerParams = {
  readonly router: ReturnType<typeof useRouter>;
  readonly markAsRead: (ids: readonly string[]) => Promise<void>;
  readonly markAllAsRead: () => Promise<void>;
  readonly toggleArchived: (value: boolean) => Promise<void>;
  readonly refresh: () => Promise<void>;
  readonly loadMore: () => Promise<void>;
};

type NotificationHandlers = {
  readonly onOpen: (notification: NotificationSnapshot) => void;
  readonly onMarkAsRead: (notification: NotificationSnapshot) => void;
  readonly onMarkAll: () => void;
  readonly onToggleArchived: (value: boolean) => void;
  readonly onRefresh: () => void;
  readonly onRetry: () => void;
  readonly onLoadMore: () => void;
};

function useNotificationHandlers({
  router,
  markAsRead,
  markAllAsRead,
  toggleArchived,
  refresh,
  loadMore,
}: NotificationHandlerParams): NotificationHandlers {
  const onOpen = React.useCallback(
    (notification: NotificationSnapshot) => {
      const link = notification.deepLink;
      if (!link) return;
      if (isExternalLink(link)) {
        openLinkInBrowser(link);
        return;
      }
      router.push(link as never);
    },
    [router]
  );

  const onMarkAsRead = React.useCallback(
    (notification: NotificationSnapshot) => {
      void markAsRead([notification.id]);
    },
    [markAsRead]
  );

  const onMarkAll = React.useCallback(() => {
    void markAllAsRead();
  }, [markAllAsRead]);

  const onToggleArchived = React.useCallback(
    (value: boolean) => {
      void toggleArchived(value);
    },
    [toggleArchived]
  );

  const onRefresh = React.useCallback(() => {
    void refresh();
  }, [refresh]);

  const onLoadMore = React.useCallback(() => {
    void loadMore();
  }, [loadMore]);

  return {
    onOpen,
    onMarkAsRead,
    onMarkAll,
    onToggleArchived,
    onRefresh,
    onRetry: onRefresh,
    onLoadMore,
  };
}

function resolveLocale(): string {
  const language = i18n.language;
  if (typeof language === 'string' && language.length > 0) return language;
  return 'en';
}

function isExternalLink(link: string): boolean {
  return /^https?:\/\//i.test(link);
}

function filterNotifications(
  notifications: readonly NotificationSnapshot[],
  filter: FilterKey
): NotificationSnapshot[] {
  if (filter === 'unread') {
    return notifications.filter((notification) => notification.readAt === null);
  }
  return notifications.slice();
}
