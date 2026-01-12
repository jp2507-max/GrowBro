/**
 * Enhanced strains list with offline cache support
 */

import {
  FlashList,
  type FlashListProps,
  type FlashListRef,
} from '@shopify/flash-list';
import React, { useMemo } from 'react';
import Animated from 'react-native-reanimated';
import type { ReanimatedScrollEvent } from 'react-native-reanimated/lib/typescript/hook/commonTypes';

import type { Strain } from '@/api';
import type { StrainFilters } from '@/api/strains/types';
import { useOfflineAwareStrains } from '@/api/strains/use-strains-infinite-with-cache';
import { StrainCard } from '@/components/strains/strain-card';
import {
  DEFAULT_ITEM_HEIGHT,
  extractStrainKey,
  getStrainItemType,
  overrideStrainItemLayout,
} from '@/lib/strains/list-helpers';
import { getOptimizedFlashListConfig } from '@/lib/strains/measure-item-size';
import { useListComponents } from '@/lib/strains/use-list-components';
import { useListFavorites } from '@/lib/strains/use-list-favorites';
import { useListScrolling } from '@/lib/strains/use-list-scrolling';
import { useScrollRestoration } from '@/lib/strains/use-scroll-restoration';
import { useStrainListState } from '@/lib/strains/use-strain-list-state';

/**
 * Direct type alias for the animated scroll handler from Reanimated.
 */
type AnimatedScrollHandler = (event: ReanimatedScrollEvent) => void;

type AnimatedFlashListProps = Omit<FlashListProps<Strain>, 'onScroll'> & {
  onScroll?: AnimatedScrollHandler;
};

const AnimatedFlashList = Animated.createAnimatedComponent(
  FlashList
) as unknown as React.ForwardRefExoticComponent<
  AnimatedFlashListProps & React.RefAttributes<FlashListRef<Strain>>
>;

export type StrainsListWithCacheProps = {
  searchQuery?: string;
  filters?: StrainFilters;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  /** Animated scroll handler from useAnimatedScrollHandler - passed directly to AnimatedFlashList */
  onScroll?: AnimatedScrollHandler;
  listRef?: React.RefObject<FlashListRef<unknown> | null>;
  contentContainerStyle?: FlashListProps<Strain>['contentContainerStyle'];
  testID?: string;
  onStateChange?: (state: {
    strains: Strain[];
    isOffline: boolean;
    isUsingCache: boolean;
    isLoading: boolean;
    isError: boolean;
    isFetchingNextPage: boolean;
    hasNextPage: boolean;
  }) => void;
};

// eslint-disable-next-line max-lines-per-function -- Complex list component with many hooks for data, scroll, favorites, components
export function StrainsListWithCache({
  searchQuery = '',
  filters = {},
  sortBy,
  sortDirection,
  onScroll,
  listRef,
  contentContainerStyle,
  testID = 'strains-list-with-cache',
  onStateChange,
}: StrainsListWithCacheProps) {
  const [activeStrainId, setActiveStrainId] = React.useState<string | null>(
    null
  );
  const queryKey = JSON.stringify({
    q: searchQuery,
    f: filters,
    s: sortBy,
    d: sortDirection,
  });

  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    isOffline,
    isUsingCache,
  } = useOfflineAwareStrains({
    searchQuery: (searchQuery || '').trim(),
    filters: filters || {},
    sortBy,
    sortDirection,
    pageSize: 20,
  });

  const { strains, onRetry, onEndReached } = useStrainListState({
    data,
    searchQuery,
    filters,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isOffline,
    isUsingCache,
    isLoading,
    isError,
    onStateChange,
  });

  const { initialScrollIndexRef } = useScrollRestoration({
    queryKey,
    strainsLength: strains.length,
    defaultItemHeight: DEFAULT_ITEM_HEIGHT,
  });

  const flashListConfig = useMemo(() => getOptimizedFlashListConfig(), []);

  const { composedScrollHandler } = useListScrolling({
    onScroll,
    listSize: strains.length,
  });

  const { listEmpty, listHeader, listFooter } = useListComponents({
    isLoading,
    isError,
    isOffline,
    isUsingCache,
    isFetchingNextPage,
    strainsLength: strains.length,
    searchQuery,
    onRetry,
  });

  const handleStrainPressIn = React.useCallback((strainId: string) => {
    setActiveStrainId(strainId);
  }, []);

  // Lift favorites subscription to list level - single subscription instead of N per row
  const { isFavorite, createToggleHandler } = useListFavorites();

  const renderItem = React.useCallback(
    ({ item }: { item: Strain }) => (
      <StrainCard
        strain={item}
        testID={`strain-card-${item.id}`}
        enableSharedTransition={item.id === activeStrainId}
        onStartNavigation={handleStrainPressIn}
        isFavorite={isFavorite(item)}
        onToggleFavorite={createToggleHandler(item)}
      />
    ),
    [activeStrainId, handleStrainPressIn, isFavorite, createToggleHandler]
  );

  return (
    <AnimatedFlashList
      ref={listRef as React.Ref<FlashListRef<Strain>>}
      testID={testID}
      data={strains}
      renderItem={renderItem}
      keyExtractor={extractStrainKey}
      getItemType={getStrainItemType}
      overrideItemLayout={overrideStrainItemLayout}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.7}
      onScroll={composedScrollHandler}
      contentContainerStyle={contentContainerStyle}
      ListHeaderComponent={listHeader}
      ListEmptyComponent={listEmpty}
      ListFooterComponent={listFooter}
      initialScrollIndex={initialScrollIndexRef.current ?? undefined}
      {...flashListConfig}
    />
  );
}
