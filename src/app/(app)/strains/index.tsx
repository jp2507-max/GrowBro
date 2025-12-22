import { useFocusEffect, useScrollToTop } from '@react-navigation/native';
import { useColorScheme } from 'nativewind';
import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { StrainFilters } from '@/api/strains/types';
import {
  ComplianceBanner,
  FilterModal,
  StrainsHeader,
  StrainsListWithCache,
  StrainsOfflineBanner,
  useStrainFilters,
} from '@/components/strains';
import { FocusAwareStatusBar, Pressable, Text, View } from '@/components/ui';
import colors from '@/components/ui/colors';
import { X } from '@/components/ui/icons';
import { translate, useAnalytics } from '@/lib';
import { useAnimatedScrollList } from '@/lib/animations/animated-scroll-list-provider';
import { useBottomTabBarHeight } from '@/lib/animations/use-bottom-tab-bar-height';
import { haptics } from '@/lib/haptics';
import { useNetworkStatus } from '@/lib/hooks';
import { useAnalyticsConsent } from '@/lib/hooks/use-analytics-consent';

const SEARCH_DEBOUNCE_MS = 300;
const LIST_BOTTOM_EXTRA = 24;

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = React.useState(value);

  React.useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(handle);
  }, [value, delayMs]);

  return debounced;
}

// eslint-disable-next-line max-lines-per-function
export default function StrainsScreen(): React.ReactElement {
  const { listRef, scrollHandler, resetScrollState } = useAnimatedScrollList();
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
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const activeFilterIconColor = isDark ? colors.neutral[900] : colors.white;

  const [searchValue, setSearchValue] = React.useState('');
  const debouncedQuery = useDebouncedValue(searchValue, SEARCH_DEBOUNCE_MS);
  const [filters, setFilters] = React.useState<StrainFilters>({});
  const [listState, setListState] = useState<{
    strains: { length: number };
    isOffline: boolean;
    isUsingCache: boolean;
    isLoading: boolean;
    isError: boolean;
    isFetchingNextPage: boolean;
    hasNextPage: boolean;
  } | null>(null);

  const resolvedCount = listState?.strains.length ?? 0;
  const resolvedOffline =
    listState?.isOffline ?? (!isConnected || !isInternetReachable);

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

  const lastSearchPayloadRef = React.useRef<{
    query: string;
    resultsCount: number;
    isOffline: boolean;
    hasAnalyticsConsent: boolean;
  } | null>(null);

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

  React.useEffect(() => {
    if (!listState || listState.isLoading || listState.isFetchingNextPage) {
      return;
    }
    const payload = {
      query: debouncedQuery,
      resultsCount: listState.strains.length,
      isOffline: resolvedOffline,
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
    listState,
    resolvedOffline,
  ]);

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
      className="flex-1 bg-neutral-50 dark:bg-charcoal-950"
      testID="strains-screen"
    >
      <FocusAwareStatusBar />

      <StrainsHeader
        insets={insets}
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        strainCount={resolvedCount}
        hasActiveFilters={hasActiveFilters}
        onFiltersPress={filterModal.openFilters}
      />

      {/* Overlapping content sheet - slides up over header */}
      <View className="bg-sheet z-10 -mt-6 flex-1 rounded-t-[32px] shadow-xl">
        {/* Handle Bar - indicates draggable sheet */}
        <View className="w-full items-center pb-2 pt-3">
          <View className="bg-sheet-handle h-1.5 w-12 rounded-full" />
        </View>

        <View className="px-4">
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

          <StrainsOfflineBanner isVisible={resolvedOffline} />
        </View>
        <ComplianceBanner />
        <StrainsListWithCache
          searchQuery={debouncedQuery}
          filters={filters}
          // scrollHandler is a Reanimated handler; cast to satisfy FlashList typing.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onScroll={scrollHandler as any}
          listRef={listRef}
          contentContainerStyle={[
            styles.listContentContainer,
            listContentPadding,
          ]}
          testID="strains-list"
          onStateChange={(state) => {
            setListState({
              ...state,
              strains: { length: state.strains.length },
            });
          }}
        />
      </View>
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
