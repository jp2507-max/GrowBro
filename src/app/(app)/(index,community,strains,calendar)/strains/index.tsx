import { useFocusEffect, useScrollToTop } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, type TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Strain } from '@/api';
import type { StrainFilters } from '@/api/strains/types';
import {
  FilterModal,
  RaceFilterChips,
  type RaceFilterValue,
  SearchInput,
  StrainHeroCard,
  StrainsGradientBackground,
  StrainsHeader,
  StrainsList,
  type StrainsListProps,
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

type StrainsListHeaderProps = {
  featuredStrain: Strain | null;
  raceFilter: RaceFilterValue;
  resolvedOffline: boolean;
  showHero: boolean;
  searchValue: string;
  searchInputRef: React.RefObject<TextInput | null>;
  onRaceChange: (value: RaceFilterValue) => void;
  onSearchChange: (value: string) => void;
};

function StrainsListHeader({
  featuredStrain,
  raceFilter,
  resolvedOffline,
  showHero,
  searchValue,
  searchInputRef,
  onRaceChange,
  onSearchChange,
}: StrainsListHeaderProps): React.ReactElement {
  return (
    <View className="mb-4">
      {showHero && featuredStrain && (
        <View className="mb-8 mt-4">
          <StrainHeroCard strain={featuredStrain} />
        </View>
      )}

      <View className="px-5">
        <SearchInput
          value={searchValue}
          onChangeText={onSearchChange}
          inputRef={searchInputRef}
          testID="strains-search-input"
        />
      </View>

      <View className="mb-2">
        <RaceFilterChips value={raceFilter} onChange={onRaceChange} />
      </View>

      <View className="px-5">
        <StrainsOfflineBanner isVisible={resolvedOffline} />
      </View>
    </View>
  );
}

export default function StrainsScreen(): React.ReactElement {
  const { listRef, scrollHandler, resetScrollState } = useAnimatedScrollList();
  const insets = useSafeAreaInsets();
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
  const [searchValue, setSearchValue] = React.useState('');
  const searchInputRef = React.useRef<TextInput | null>(null);
  const debouncedQuery = useDebouncedValue(searchValue, SEARCH_DEBOUNCE_MS);
  const [filters, setFilters] = React.useState<StrainFilters>({});
  const [raceFilter, setRaceFilter] = useState<RaceFilterValue>('all');
  const [listState, setListState] = useState<StrainListState | null>(null);
  const [featuredStrain, setFeaturedStrain] = useState<Strain | null>(null);
  const resolvedOffline =
    listState?.isOffline ?? (!isConnected || !isInternetReachable);
  const hasFilters = hasActiveFilters(filters) || raceFilter !== 'all';
  useStrainSearchAnalytics({
    analytics,
    debouncedQuery,
    listState,
    resolvedOffline,
    hasAnalyticsConsent,
  });
  const combinedFilters = useMemo((): StrainFilters => {
    const combined: StrainFilters = { ...filters };

    if (
      raceFilter === 'indica' ||
      raceFilter === 'sativa' ||
      raceFilter === 'hybrid'
    ) {
      combined.race = raceFilter;
    } else if (raceFilter === 'highCbd') {
      combined.cbdMin = 10;
    }
    // 'all' doesn't add any race filter

    return combined;
  }, [filters, raceFilter]);
  const handleApplyFilters = React.useCallback(
    (newFilters: StrainFilters): void => {
      setFilters(newFilters);
      filterModal.closeFilters();
    },
    [filterModal]
  );

  const handleClearFilters = React.useCallback((): void => {
    setFilters({});
    setRaceFilter('all');
    filterModal.closeFilters();
  }, [filterModal]);
  const handleSearchPress = React.useCallback((): void => {
    searchInputRef.current?.focus();
  }, []);
  const handleSearchChange = React.useCallback((value: string): void => {
    setSearchValue(value);
  }, []);
  const listContentPadding = React.useMemo(
    () => ({ paddingBottom: grossHeight + LIST_BOTTOM_EXTRA }),
    [grossHeight]
  );
  const listContentStyle = React.useMemo(
    () => [styles.listContentContainer, listContentPadding],
    [listContentPadding]
  );

  const handleStateChange = useCallback(
    (
      state: Parameters<NonNullable<StrainsListProps['onStateChange']>>[0]
    ): void => {
      setListState({
        ...state,
        strains: { length: state.strains.length },
      });
    },
    []
  );
  const handleFeaturedStrainChange = useCallback(
    (strain: Strain | null): void => {
      setFeaturedStrain(strain);
    },
    []
  );
  const showHero = useMemo(
    () => !debouncedQuery && raceFilter === 'all' && !hasActiveFilters(filters),
    [debouncedQuery, raceFilter, filters]
  );
  const skipFirstItems = showHero ? 1 : 0;

  return (
    <StrainsGradientBackground testID="strains-screen">
      <FocusAwareStatusBar style="light" />
      <StrainsHeader
        insets={insets}
        onSearchPress={handleSearchPress}
        onFiltersPress={filterModal.openFilters}
        hasActiveFilters={hasFilters}
      />
      <StrainsList
        searchQuery={debouncedQuery}
        filters={combinedFilters}
        skipFirstItems={skipFirstItems}
        onScroll={scrollHandler}
        listRef={listRef}
        contentContainerStyle={listContentStyle}
        testID="strains-list"
        onStateChange={handleStateChange}
        onFeaturedStrainChange={handleFeaturedStrainChange}
        ListHeaderComponent={
          <StrainsListHeader
            featuredStrain={featuredStrain}
            raceFilter={raceFilter}
            resolvedOffline={resolvedOffline}
            showHero={showHero}
            searchValue={searchValue}
            searchInputRef={searchInputRef}
            onRaceChange={setRaceFilter}
            onSearchChange={handleSearchChange}
          />
        }
      />
      <FilterModal
        ref={filterModal.ref}
        filters={filters}
        onApply={handleApplyFilters}
        onClear={handleClearFilters}
      />
    </StrainsGradientBackground>
  );
}

const styles = StyleSheet.create({ listContentContainer: { paddingTop: 0 } });
