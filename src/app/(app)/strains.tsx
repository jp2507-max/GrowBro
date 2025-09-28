import { useScrollToTop } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import React from 'react';
import { type ListRenderItemInfo, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';

import type { Strain } from '@/api';
import { useStrainsInfinite } from '@/api';
import {
  StrainsEmptyState,
  StrainsErrorCard,
  StrainsFooterLoader,
  StrainsOfflineBanner,
  StrainsSkeletonList,
} from '@/components/strains';
import {
  FocusAwareStatusBar,
  Input,
  Pressable,
  Text,
  View,
} from '@/components/ui';
import { translate, useAnalytics } from '@/lib';
import { useAnimatedScrollList } from '@/lib/animations/animated-scroll-list-provider';
import { useBottomTabBarHeight } from '@/lib/animations/use-bottom-tab-bar-height';
import { useNetworkStatus, useScreenErrorLogger } from '@/lib/hooks';
import { useAnalyticsConsent } from '@/lib/hooks/use-analytics-consent';
import type { TxKeyPath } from '@/lib/i18n';

const SEARCH_DEBOUNCE_MS = 300;
const LIST_HORIZONTAL_PADDING = 16;
const LIST_BOTTOM_EXTRA = 16;

const AnimatedFlashList = Animated.createAnimatedComponent(FlashList as any);

function useStrainsData(searchQuery: string) {
  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useStrainsInfinite({ variables: { query: searchQuery.trim() } });

  const strains = React.useMemo<Strain[]>(() => {
    if (!data?.pages?.length) return [];
    return data.pages.flatMap((page) => page.results);
  }, [data?.pages]);

  return {
    strains,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    error,
  } as const;
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = React.useState(value);

  React.useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(handle);
  }, [value, delayMs]);

  return debounced;
}

function useSkeletonVisibility(isLoading: boolean, itemsCount: number) {
  const [isVisible, setVisible] = React.useState(false);
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    const isInitial = isLoading && itemsCount === 0;
    if (isInitial) {
      setVisible(true);
      return () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      };
    }

    if (isVisible) {
      timeoutRef.current = setTimeout(() => setVisible(false), 1200);
    } else if (!isLoading) {
      setVisible(false);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [isLoading, itemsCount, isVisible]);

  return isVisible;
}

// eslint-disable-next-line max-lines-per-function
export default function StrainsScreen(): React.ReactElement {
  const router = useRouter();
  const { listRef, scrollHandler } = useAnimatedScrollList();
  useScrollToTop(listRef);
  const { grossHeight } = useBottomTabBarHeight();
  const { isConnected, isInternetReachable } = useNetworkStatus();
  const analytics = useAnalytics();
  const hasAnalyticsConsent = useAnalyticsConsent();

  const isOffline = !isConnected || !isInternetReachable;

  const [cachedStrains, setCachedStrains] = React.useState<
    Record<string, Strain[]>
  >({});

  const [searchValue, setSearchValue] = React.useState('');
  const debouncedQuery = useDebouncedValue(searchValue, SEARCH_DEBOUNCE_MS);

  const {
    strains,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useStrainsData(debouncedQuery);

  React.useEffect(() => {
    if (!isOffline) {
      setCachedStrains((prev) => ({
        ...prev,
        [debouncedQuery]: strains,
      }));
    }
  }, [isOffline, strains, debouncedQuery]);

  const listData = React.useMemo(() => {
    if (!isOffline) return strains;
    return cachedStrains[debouncedQuery] || [];
  }, [isOffline, strains, cachedStrains, debouncedQuery]);

  const isSkeletonVisible = useSkeletonVisibility(isLoading, strains.length);

  const lastSearchPayloadRef = React.useRef<{
    query: string;
    resultsCount: number;
    isOffline: boolean;
    hasAnalyticsConsent: boolean;
  } | null>(null);

  const onRetry = React.useCallback(() => {
    void refetch();
  }, [refetch]);

  useScreenErrorLogger(isError ? error : null, {
    screen: 'strains',
    feature: 'strains-browser',
    action: 'fetch',
    queryKey: 'strains-infinite',
    metadata: {
      resultsCount: listData.length,
      searchQuery: debouncedQuery,
      isOffline,
      isFetchingNextPage,
      hasNextPage,
    },
  });

  const showResultsCount = !isSkeletonVisible;
  const resultsCountKey: TxKeyPath = React.useMemo(() => {
    if (listData.length === 0) return 'strains.results_count_zero';
    if (listData.length === 1) return 'strains.results_count_one';
    return 'strains.results_count_other';
  }, [listData.length]);
  const resultsCountLabel = translate(resultsCountKey, {
    count: listData.length,
  });

  React.useEffect(() => {
    if (isLoading || isFetchingNextPage) return;
    const payload = {
      query: debouncedQuery,
      resultsCount: listData.length,
      isOffline,
      hasAnalyticsConsent,
    };
    const last = lastSearchPayloadRef.current;
    if (
      last &&
      last.query === payload.query &&
      last.isOffline === payload.isOffline &&
      last.hasAnalyticsConsent === payload.hasAnalyticsConsent
    ) {
      return;
    }
    lastSearchPayloadRef.current = payload;
    if (hasAnalyticsConsent) {
      void analytics.track('strain_search', {
        query: payload.query,
        results_count: payload.resultsCount,
        is_offline: payload.isOffline,
      });
    }
  }, [
    analytics,
    debouncedQuery,
    hasAnalyticsConsent,
    isFetchingNextPage,
    isLoading,
    isOffline,
    listData.length,
  ]);

  const onItemPress = React.useCallback(
    (id: string) => {
      router.push(`/strains/${id}`);
    },
    [router]
  );

  const onEndReached = React.useCallback(() => {
    if (!hasNextPage || isFetchingNextPage || isOffline) return;
    void fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, isOffline]);

  const renderItem = React.useCallback(
    ({ item }: ListRenderItemInfo<Strain>) => (
      <StrainCard strain={item} onPress={onItemPress} />
    ),
    [onItemPress]
  );

  const keyExtractor = React.useCallback((item: Strain) => item.id, []);

  const listEmpty = React.useMemo(() => {
    if (isSkeletonVisible) return <StrainsSkeletonList />;
    if (isError && !isOffline) return <StrainsErrorCard onRetry={onRetry} />;
    return (
      <StrainsEmptyState
        query={debouncedQuery}
        showOfflineNotice={
          isOffline && (cachedStrains[debouncedQuery]?.length ?? 0) > 0
        }
      />
    );
  }, [
    debouncedQuery,
    isError,
    isSkeletonVisible,
    isOffline,
    cachedStrains,
    onRetry,
  ]);

  const listFooter = React.useCallback(
    () => <StrainsFooterLoader isVisible={isFetchingNextPage} />,
    [isFetchingNextPage]
  );

  const listContentPadding = React.useMemo(
    () => ({ paddingBottom: grossHeight + LIST_BOTTOM_EXTRA }),
    [grossHeight]
  );

  return (
    <View className="flex-1" testID="strains-screen">
      <FocusAwareStatusBar />
      <View className="px-4 pb-4 pt-3">
        <Text
          className="pb-3 text-2xl font-semibold text-neutral-900 dark:text-neutral-50"
          tx="shared_header.strains.title"
        />
        <Input
          value={searchValue}
          onChangeText={setSearchValue}
          placeholder={translate('strains.search_placeholder')}
          accessibilityLabel={translate('strains.search_placeholder')}
          accessibilityHint={translate('accessibility.strains.search_hint')}
          testID="strains-search-input"
        />
        <StrainsOfflineBanner isVisible={isOffline} />
        {showResultsCount ? (
          <Text
            className="pt-3 text-sm text-neutral-600 dark:text-neutral-300"
            accessibilityRole="text"
            testID="strains-results-count"
          >
            {resultsCountLabel}
          </Text>
        ) : null}
      </View>
      <AnimatedFlashList
        ref={listRef as React.RefObject<any>}
        data={listData}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={[
          styles.listContentContainer,
          listContentPadding,
        ]}
        ListEmptyComponent={listEmpty}
        ListFooterComponent={listFooter}
      />
    </View>
  );
}

type StrainCardProps = {
  strain: Strain;
  onPress: (id: string) => void;
};

function StrainCard({ strain, onPress }: StrainCardProps): React.ReactElement {
  const handlePress = React.useCallback(() => {
    onPress(strain.id);
  }, [onPress, strain.id]);

  return (
    <Pressable
      className="mb-4 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
      testID={`strain-card-${strain.id}`}
      accessibilityRole="button"
      accessibilityLabel={strain.name}
      accessibilityHint={translate('accessibility.strains.open_detail_hint')}
      onPress={handlePress}
    >
      <Text className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
        {strain.name}
      </Text>
      {strain.type ? (
        <Text className="text-sm text-neutral-500 dark:text-neutral-300">
          {strain.type}
        </Text>
      ) : null}
      {strain.description ? (
        <Text
          className="pt-2 text-sm text-neutral-600 dark:text-neutral-200"
          numberOfLines={2}
          ellipsizeMode="tail"
        >
          {strain.description}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  listContentContainer: {
    paddingHorizontal: LIST_HORIZONTAL_PADDING,
  },
});
