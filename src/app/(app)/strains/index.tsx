import { useFocusEffect, useScrollToTop } from '@react-navigation/native';
import {
  FlashList,
  type FlashListProps,
  type FlashListRef,
} from '@shopify/flash-list';
import { useNavigation, useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import React, { useCallback, useLayoutEffect, useMemo } from 'react';
import { type ListRenderItemInfo, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
import colors from '@/components/ui/colors';
import { Rate, Settings, X } from '@/components/ui/icons';
import { translate, useAnalytics } from '@/lib';
import { useAnimatedScrollList } from '@/lib/animations/animated-scroll-list-provider';
import { useBottomTabBarHeight } from '@/lib/animations/use-bottom-tab-bar-height';
import { haptics } from '@/lib/haptics';
import { useNetworkStatus } from '@/lib/hooks';
import { useAnalyticsConsent } from '@/lib/hooks/use-analytics-consent';
import { applyStrainFilters } from '@/lib/strains/filtering';

const SEARCH_DEBOUNCE_MS = 300;
const LIST_BOTTOM_EXTRA = 24;

const AnimatedFlashList = Animated.createAnimatedComponent(
  FlashList as React.ComponentType<FlashListProps<Strain>>
);

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

  // Get raw strains from paginated API response
  const rawStrains = React.useMemo<Strain[]>(() => {
    if (!data?.pages?.length) return [];
    return data.pages.flatMap((page) => page.data);
  }, [data?.pages]);

  // Apply client-side filters AND search to guarantee UI matches selected criteria
  // This ensures correct behavior even if backend returns extra data or we're offline
  const strains = React.useMemo(() => {
    return applyStrainFilters(rawStrains, filters, searchQuery.trim());
  }, [rawStrains, filters, searchQuery]);

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
  const {
    listRef: sharedListRef,
    scrollHandler,
    resetScrollState,
  } = useAnimatedScrollList();
  const listRef = React.useMemo(
    () => sharedListRef as React.RefObject<FlashListRef<Strain>>,
    [sharedListRef]
  );
  // useScrollToTop accepts refs with scrollTo/scrollToOffset methods
  useScrollToTop(
    listRef as React.RefObject<{
      scrollToOffset: (params: { offset?: number; animated?: boolean }) => void;
    }>
  );
  const { grossHeight } = useBottomTabBarHeight();

  // Reset scroll state on blur so tab bar is visible when navigating away
  useFocusEffect(
    useCallback(() => {
      return () => {
        resetScrollState();
      };
    }, [resetScrollState])
  );
  const { isConnected, isInternetReachable } = useNetworkStatus();
  const analytics = useAnalytics();
  const hasAnalyticsConsent = useAnalyticsConsent();
  const filterModal = useStrainFilters();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const iconColor = isDark ? colors.white : colors.neutral[900];
  const activeFilterIconColor = isDark ? colors.neutral[900] : colors.white;

  // Hide default header to create a custom clean layout
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

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
    ({ item, index }: ListRenderItemInfo<Strain>) => (
      <Animated.View
        entering={FadeIn.delay(index * 50)
          .springify()
          .damping(12)}
      >
        <StrainCard strain={item} testID={`strain-card-${item.id}`} />
      </Animated.View>
    ),
    []
  );

  const keyExtractor = React.useCallback((item: Strain) => item.id, []);
  const getItemType = React.useCallback(() => 'strain', []);

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

  const activeFilterStyle =
    'flex-row items-center gap-1.5 rounded-full bg-neutral-900 dark:bg-white px-3 py-1.5';
  const activeFilterTextStyle =
    'text-sm font-medium text-white dark:text-neutral-900';

  return (
    <View
      className="flex-1 bg-neutral-50 dark:bg-neutral-950"
      testID="strains-screen"
      style={{ paddingTop: insets.top }}
    >
      <FocusAwareStatusBar />
      <View className="px-4 py-2">
        {/* Header Row: Title + Actions */}
        <View className="flex-row items-center justify-between pb-4">
          <Text className="text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-white">
            {translate('shared_header.strains.title')}
          </Text>

          <View className="flex-row items-center gap-1">
            <Pressable
              onPress={() => {
                haptics.selection();
                router.push('/strains/favorites');
              }}
              className="size-10 items-center justify-center rounded-full bg-white shadow-sm active:bg-neutral-100 dark:bg-neutral-900 dark:active:bg-neutral-800"
              accessibilityRole="button"
              accessibilityLabel={translate('strains.favorites.title')}
              accessibilityHint={translate(
                'strains.favoritesAccessibilityHint'
              )}
              testID="strains-favorites-button"
            >
              <Rate
                color={iconColor}
                width={20}
                height={20}
                className="text-neutral-900 dark:text-white"
              />
            </Pressable>
            <Pressable
              onPress={() => {
                haptics.selection();
                filterModal.openFilters();
              }}
              className={`size-10 items-center justify-center rounded-full shadow-sm active:bg-neutral-100 dark:active:bg-neutral-800 ${
                hasActiveFilters
                  ? 'bg-primary-100 dark:bg-primary-900'
                  : 'bg-white dark:bg-neutral-900'
              }`}
              accessibilityRole="button"
              accessibilityLabel={translate('strains.filters.button_label')}
              accessibilityHint={translate(
                'accessibility.strains.open_filters_hint'
              )}
              testID="strains-filter-button"
            >
              <Settings
                color={hasActiveFilters ? colors.primary[600] : iconColor}
                width={20}
                height={20}
                className={
                  hasActiveFilters
                    ? 'text-primary-600 dark:text-primary-400'
                    : 'text-neutral-900 dark:text-white'
                }
              />
            </Pressable>
          </View>
        </View>

        {/* Search Row */}
        <View className="pb-4">
          <Input
            value={searchValue}
            onChangeText={setSearchValue}
            placeholder={
              listData.length > 0
                ? translate('strains.search_placeholder_count', {
                    count: listData.length,
                  })
                : translate('strains.search_placeholder')
            }
            accessibilityLabel={translate('strains.search_placeholder')}
            accessibilityHint={translate('accessibility.strains.search_hint')}
            testID="strains-search-input"
            className="h-12 rounded-2xl border-0 bg-white px-4 font-medium text-neutral-900 shadow-sm dark:bg-neutral-900 dark:text-white"
            placeholderTextColor={colors.neutral[400]}
          />
        </View>

        {/* Active Filters Row */}
        {hasActiveFilters ? (
          <View className="flex-row flex-wrap gap-2 pb-3">
            {filters.race && (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  haptics.selection();
                  setFilters((prev) => ({ ...prev, race: undefined }));
                }}
                className={activeFilterStyle}
                testID="active-filter-race"
              >
                <Text className={activeFilterTextStyle}>
                  {translate(`strains.race.${filters.race}`)}
                </Text>
                <X
                  width={14}
                  height={14}
                  color={activeFilterIconColor}
                  className="text-white dark:text-neutral-900"
                />
              </Pressable>
            )}
            {filters.difficulty && (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  haptics.selection();
                  setFilters((prev) => ({ ...prev, difficulty: undefined }));
                }}
                className={activeFilterStyle}
                testID="active-filter-difficulty"
              >
                <Text className={activeFilterTextStyle}>
                  {translate(`strains.difficulty.${filters.difficulty}`)}
                </Text>
                <X
                  width={14}
                  height={14}
                  color={activeFilterIconColor}
                  className="text-white dark:text-neutral-900"
                />
              </Pressable>
            )}
            {(filters.effects?.length ?? 0) > 0 && (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  haptics.selection();
                  setFilters((prev) => ({ ...prev, effects: [] }));
                }}
                className={activeFilterStyle}
                testID="active-filter-effects"
              >
                <Text className={activeFilterTextStyle}>
                  {translate('strains.filters.effects_count', {
                    count: filters.effects!.length,
                  })}
                </Text>
                <X
                  width={14}
                  height={14}
                  color={activeFilterIconColor}
                  className="text-white dark:text-neutral-900"
                />
              </Pressable>
            )}
            {(filters.flavors?.length ?? 0) > 0 && (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  haptics.selection();
                  setFilters((prev) => ({ ...prev, flavors: [] }));
                }}
                className={activeFilterStyle}
                testID="active-filter-flavors"
              >
                <Text className={activeFilterTextStyle}>
                  {translate('strains.filters.flavors_count', {
                    count: filters.flavors!.length,
                  })}
                </Text>
                <X
                  width={14}
                  height={14}
                  color={activeFilterIconColor}
                  className="text-white dark:text-neutral-900"
                />
              </Pressable>
            )}
          </View>
        ) : null}

        <StrainsOfflineBanner isVisible={isOffline} />
      </View>
      <ComplianceBanner />
      <AnimatedFlashList
        ref={listRef}
        testID="strains-list"
        data={listData}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        getItemType={getItemType}
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
    paddingTop: 8,
  },
});
