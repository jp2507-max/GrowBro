import { useFocusEffect, useScrollToTop } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { StrainFilters } from '@/api/strains/types';
import {
  ActiveFiltersRow,
  ComplianceBanner,
  FilterModal,
  StrainsHeader,
  StrainsListWithCache,
  type StrainsListWithCacheProps,
  StrainsOfflineBanner,
  useStrainFilters,
} from '@/components/strains';
import { FocusAwareStatusBar, View } from '@/components/ui';
import { useAnalytics } from '@/lib';
import { useAnimatedScrollList } from '@/lib/animations/animated-scroll-list-provider';
import { useBottomTabBarHeight } from '@/lib/animations/use-bottom-tab-bar-height';
import {
  useDebouncedValue,
  useNetworkStatus,
  useStrainSearchAnalytics,
} from '@/lib/hooks';
import { useAnalyticsConsent } from '@/lib/hooks/use-analytics-consent';
import type { StrainListState } from '@/lib/hooks/use-strain-search-analytics';
import { SEARCH_DEBOUNCE_MS } from '@/lib/strains/constants';
import { hasActiveFilters } from '@/lib/strains/filter-utils';

const LIST_BOTTOM_EXTRA = 24;

export default function StrainsScreen(): React.ReactElement {
  const { listRef, scrollHandler, resetScrollState } = useAnimatedScrollList();

  useScrollToTop(
    listRef as React.RefObject<{
      scrollToOffset: (params: { offset?: number; animated?: boolean }) => void;
    }>
  );
  const { grossHeight } = useBottomTabBarHeight();
  useFocusEffect(
    useCallback(
      () => () => {
        resetScrollState();
      },
      [resetScrollState]
    )
  );

  const { isConnected, isInternetReachable } = useNetworkStatus();
  const analytics = useAnalytics();
  const hasAnalyticsConsent = useAnalyticsConsent();
  const filterModal = useStrainFilters();
  const insets = useSafeAreaInsets();
  const [searchValue, setSearchValue] = React.useState('');
  const debouncedQuery = useDebouncedValue(searchValue, SEARCH_DEBOUNCE_MS);
  const [filters, setFilters] = React.useState<StrainFilters>({});
  const [listState, setListState] = useState<StrainListState | null>(null);

  const resolvedCount = listState?.strains.length ?? 0;
  const resolvedOffline =
    listState?.isOffline ?? (!isConnected || !isInternetReachable);
  const hasFilters = hasActiveFilters(filters);

  useStrainSearchAnalytics({
    analytics,
    debouncedQuery,
    listState,
    resolvedOffline,
    hasAnalyticsConsent,
  });

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

  const listContentPadding = React.useMemo(
    () => ({ paddingBottom: grossHeight + LIST_BOTTOM_EXTRA }),
    [grossHeight]
  );

  const handleStateChange = useCallback(
    (
      state: Parameters<
        NonNullable<StrainsListWithCacheProps['onStateChange']>
      >[0]
    ) => {
      setListState({
        ...state,
        strains: { length: state.strains.length },
      });
    },
    []
  );

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
        hasActiveFilters={hasFilters}
        onFiltersPress={filterModal.openFilters}
      />

      <View
        className="z-10 -mt-6 flex-1 rounded-t-[32px] bg-white shadow-xl dark:bg-charcoal-900"
        accessible={true}
        accessibilityLabel="Strains list section"
        accessibilityHint="Browse and filter cannabis strains"
      >
        <View className="w-full items-center pb-2 pt-3">
          <View className="h-1.5 w-12 rounded-full bg-neutral-200 dark:bg-white/20" />
        </View>
        <View className="px-4">
          <ActiveFiltersRow filters={filters} onFilterChange={setFilters} />
          <StrainsOfflineBanner isVisible={resolvedOffline} />
        </View>
        <ComplianceBanner />
        <StrainsListWithCache
          searchQuery={debouncedQuery}
          filters={filters}
          onScroll={scrollHandler}
          listRef={listRef}
          contentContainerStyle={[
            styles.listContentContainer,
            listContentPadding,
          ]}
          testID="strains-list"
          onStateChange={handleStateChange}
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

const styles = StyleSheet.create({ listContentContainer: { paddingTop: 8 } });
