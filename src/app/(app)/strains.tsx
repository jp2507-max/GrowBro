import { useScrollToTop } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { type ListRenderItemInfo, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';

import type { Strain } from '@/api';
import { useStrainsInfinite } from '@/api';
import type { StrainFilters } from '@/api/strains/types';
import {
  ComplianceBanner,
  FilterModal,
  StrainCard,
  StrainsEmptyState,
  StrainsErrorCard,
  StrainsFooterLoader,
  StrainsOfflineBanner,
  StrainsSkeletonList,
  useStrainFilters,
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
import { useNetworkStatus } from '@/lib/hooks';
import { useAnalyticsConsent } from '@/lib/hooks/use-analytics-consent';
import type { TxKeyPath } from '@/lib/i18n';

const SEARCH_DEBOUNCE_MS = 300;
const LIST_HORIZONTAL_PADDING = 16;
const LIST_BOTTOM_EXTRA = 16;

const AnimatedFlashList = Animated.createAnimatedComponent(FlashList as any);

function useStrainsData(searchQuery: string, filters: StrainFilters) {
  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useStrainsInfinite({
    variables: {
      searchQuery: searchQuery.trim(),
      filters,
    },
  });

  const strains = React.useMemo<Strain[]>(() => {
    if (!data?.pages?.length) return [];
    return data.pages.flatMap((page) => page.data);
  }, [data?.pages]);

  // Debug logging for development
  React.useEffect(() => {
    if (__DEV__ && error) {
      console.error('[StrainsScreen] API Error:', error);
    }
  }, [error]);

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
  const { listRef, scrollHandler } = useAnimatedScrollList();
  useScrollToTop(listRef);
  const { grossHeight } = useBottomTabBarHeight();
  const { isConnected, isInternetReachable } = useNetworkStatus();
  const analytics = useAnalytics();
  const hasAnalyticsConsent = useAnalyticsConsent();
  const filterModal = useStrainFilters();
  const router = useRouter();

  const isOffline = !isConnected || !isInternetReachable;

  const [cachedStrains, setCachedStrains] = React.useState<
    Record<string, Strain[]>
  >({});

  const [searchValue, setSearchValue] = React.useState('');
  const debouncedQuery = useDebouncedValue(searchValue, SEARCH_DEBOUNCE_MS);

  const [filters, setFilters] = React.useState<StrainFilters>({});

  const {
    strains,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useStrainsData(debouncedQuery, filters);

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

  const handleApplyFilters = React.useCallback(
    (newFilters: StrainFilters) => {
      setFilters(newFilters);
      filterModal.closeFilters();
    },
    [filterModal]
  );

  const handleClearFilters = React.useCallback(() => {
    setFilters({});
    filterModal.closeFilters();
  }, [filterModal]);

  const hasActiveFilters = useMemo(() => {
    return (
      (filters.race && filters.race.length > 0) ||
      (filters.effects && filters.effects.length > 0) ||
      (filters.flavors && filters.flavors.length > 0) ||
      filters.difficulty !== undefined ||
      filters.thcMin !== undefined ||
      filters.thcMax !== undefined ||
      filters.cbdMin !== undefined ||
      filters.cbdMax !== undefined
    );
  }, [filters]);

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

  const onEndReached = React.useCallback(() => {
    if (!hasNextPage || isFetchingNextPage || isOffline) return;
    void fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, isOffline]);

  const renderItem = React.useCallback(
    ({ item }: ListRenderItemInfo<Strain>) => (
      <StrainCard strain={item} testID={`strain-card-${item.id}`} />
    ),
    []
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
        <View className="flex-row gap-2">
          <View className="flex-1">
            <Input
              value={searchValue}
              onChangeText={setSearchValue}
              placeholder={translate('strains.search_placeholder')}
              accessibilityLabel={translate('strains.search_placeholder')}
              accessibilityHint={translate('accessibility.strains.search_hint')}
              testID="strains-search-input"
            />
          </View>
          <Pressable
            onPress={() => router.push('/strains/favorites')}
            className="size-12 items-center justify-center rounded-xl border border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-900"
            accessibilityRole="button"
            accessibilityLabel={translate('strains.favorites.title')}
            accessibilityHint="View your favorite strains"
            testID="strains-favorites-button"
          >
            <Text className="text-lg">💚</Text>
          </Pressable>
          <Pressable
            onPress={filterModal.openFilters}
            className="size-12 items-center justify-center rounded-xl border border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-900"
            accessibilityRole="button"
            accessibilityLabel={translate('strains.filters.button_label')}
            accessibilityHint={translate(
              'accessibility.strains.open_filters_hint'
            )}
            testID="strains-filter-button"
          >
            <Text className="text-lg">{hasActiveFilters ? '🎯' : '⚙️'}</Text>
          </Pressable>
        </View>
        {hasActiveFilters ? (
          <View className="flex-row flex-wrap gap-2 pt-2">
            {filters.race && (
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  setFilters((prev) => ({ ...prev, race: undefined }))
                }
                className="flex-row items-center gap-1 rounded-full bg-primary-600 px-3 py-1"
                testID="active-filter-race"
              >
                <Text className="text-sm text-white">
                  {translate(`strains.race.${filters.race}`)}
                </Text>
                <Text className="text-white">×</Text>
              </Pressable>
            )}
            {filters.difficulty && (
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  setFilters((prev) => ({ ...prev, difficulty: undefined }))
                }
                className="flex-row items-center gap-1 rounded-full bg-primary-600 px-3 py-1"
                testID="active-filter-difficulty"
              >
                <Text className="text-sm text-white">
                  {translate(`strains.difficulty.${filters.difficulty}`)}
                </Text>
                <Text className="text-white">×</Text>
              </Pressable>
            )}
            {(filters.effects?.length ?? 0) > 0 && (
              <Pressable
                accessibilityRole="button"
                onPress={() => setFilters((prev) => ({ ...prev, effects: [] }))}
                className="flex-row items-center gap-1 rounded-full bg-primary-600 px-3 py-1"
                testID="active-filter-effects"
              >
                <Text className="text-sm text-white">
                  {translate('strains.filters.effects_count', {
                    count: filters.effects!.length,
                  })}
                </Text>
                <Text className="text-white">×</Text>
              </Pressable>
            )}
            {(filters.flavors?.length ?? 0) > 0 && (
              <Pressable
                accessibilityRole="button"
                onPress={() => setFilters((prev) => ({ ...prev, flavors: [] }))}
                className="flex-row items-center gap-1 rounded-full bg-primary-600 px-3 py-1"
                testID="active-filter-flavors"
              >
                <Text className="text-sm text-white">
                  {translate('strains.filters.flavors_count', {
                    count: filters.flavors!.length,
                  })}
                </Text>
                <Text className="text-white">×</Text>
              </Pressable>
            )}
          </View>
        ) : null}
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
      <ComplianceBanner />
      <AnimatedFlashList
        ref={listRef as React.RefObject<any>}
        data={listData}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        getItemType={() => 'strain'}
        estimatedItemSize={280}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.7}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        removeClippedSubviews={true}
        contentContainerStyle={[
          styles.listContentContainer,
          listContentPadding,
        ]}
        ListEmptyComponent={listEmpty}
        ListFooterComponent={listFooter}
      />
      <FilterModal
        ref={filterModal.ref}
        filters={filters}
        onApply={handleApplyFilters}
        onClear={handleClearFilters}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  listContentContainer: {
    paddingHorizontal: LIST_HORIZONTAL_PADDING,
  },
});
