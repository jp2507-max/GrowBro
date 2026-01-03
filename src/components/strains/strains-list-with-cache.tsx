/**
 * Enhanced strains list with offline cache support
 */

import {
  FlashList,
  type FlashListProps,
  type FlashListRef,
} from '@shopify/flash-list';
import React, { useCallback, useMemo } from 'react';
import Animated from 'react-native-reanimated';
import type { ReanimatedScrollEvent } from 'react-native-reanimated/lib/typescript/hook/commonTypes';

import type { Strain } from '@/api';
import type { StrainFilters } from '@/api/strains/types';
import { useOfflineAwareStrains } from '@/api/strains/use-strains-infinite-with-cache';
import {
  DEFAULT_ITEM_HEIGHT,
  extractStrainKey,
  getStrainItemType,
  overrideStrainItemLayout,
  renderStrainItem,
} from '@/lib/strains/list-helpers';
import { getOptimizedFlashListConfig } from '@/lib/strains/measure-item-size';
import { useListComponents } from '@/lib/strains/use-list-components';
import { useScrollRestoration } from '@/lib/strains/use-scroll-restoration';
import { useStrainListPerformance } from '@/lib/strains/use-strain-list-performance';
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
) as React.ComponentClass<AnimatedFlashListProps>;

/**
 * Event type for the scroll callback, derived from AnimatedScrollHandler.
 * Uses Parameters utility type to extract the first argument type.
 */
type ScrollEventType = Parameters<NonNullable<AnimatedScrollHandler>>[0];

export type StrainsListWithCacheProps = {
  searchQuery?: string;
  filters?: StrainFilters;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  /** Animated scroll handler from useAnimatedScrollHandler - passed directly to AnimatedFlashList */
  onScroll?: AnimatedScrollHandler;
  listRef?: React.Ref<FlashListRef<Strain> | FlashListRef<unknown> | null>;
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

  const { handleScroll: handlePerfScroll, onBlankArea } =
    useStrainListPerformance({
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

  const handleScroll = useCallback(
    (event: ScrollEventType) => {
      handlePerfScroll();
      if (onScroll) {
        onScroll(event);
      }
    },
    [onScroll, handlePerfScroll]
  );

  return (
    <AnimatedFlashList
      // @ts-expect-error - AnimatedFlashList ref type mismatch with FlashListRef
      ref={listRef}
      testID={testID}
      data={strains}
      renderItem={renderStrainItem}
      keyExtractor={extractStrainKey}
      getItemType={getStrainItemType}
      overrideItemLayout={overrideStrainItemLayout}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.7}
      onScroll={handleScroll}
      onBlankArea={onBlankArea}
      contentContainerStyle={contentContainerStyle}
      ListHeaderComponent={listHeader}
      ListEmptyComponent={listEmpty}
      ListFooterComponent={listFooter}
      initialScrollIndex={initialScrollIndexRef.current ?? undefined}
      {...flashListConfig}
    />
  );
}
