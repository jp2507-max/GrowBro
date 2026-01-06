/**
 * Enhanced strains list with offline cache support
 */

import {
  FlashList,
  type FlashListProps,
  type FlashListRef,
} from '@shopify/flash-list';
import React, { useMemo } from 'react';
import Animated, {
  runOnJS,
  useAnimatedScrollHandler,
  useComposedEventHandler,
} from 'react-native-reanimated';
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

  // Note: onBlankArea is deprecated in FlashList v2, so we only use handleScroll
  const { handleScroll: handlePerfScroll } = useStrainListPerformance({
    listSize: strains.length,
  });

  const perfScrollHandler = useAnimatedScrollHandler({
    onEnd: () => {
      runOnJS(handlePerfScroll)();
    },
  });

  // Filter out undefined handlers for TypeScript-safe composition
  const scrollHandlers = [onScroll, perfScrollHandler].filter(
    (handler): handler is AnimatedScrollHandler => handler !== undefined
  );

  const composedScrollHandler = useComposedEventHandler(scrollHandlers);

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

  return (
    <AnimatedFlashList
      ref={listRef as React.Ref<FlashListRef<Strain>>}
      testID={testID}
      data={strains}
      renderItem={renderStrainItem}
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
