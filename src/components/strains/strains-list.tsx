/**
 * Luxury strains list component using horizontal list items
 */

import { useFocusEffect } from '@react-navigation/native';
import {
  FlashList,
  type FlashListProps,
  type FlashListRef,
} from '@shopify/flash-list';
import { useQueryClient } from '@tanstack/react-query';
import React, { useCallback, useMemo } from 'react';
import Animated from 'react-native-reanimated';
import type { ReanimatedScrollEvent } from 'react-native-reanimated/lib/typescript/hook/commonTypes';

import type { Strain } from '@/api';
import type { StrainFilters } from '@/api/strains/types';
import { useOfflineAwareStrains } from '@/api/strains/use-strains-infinite-with-cache';
import { StrainListItem } from '@/components/strains/strain-list-item';
import { createStaggeredFadeIn } from '@/lib/animations/stagger';
import {
  extractStrainKey,
  getStrainItemType,
} from '@/lib/strains/list-helpers';
import { getOptimizedFlashListConfig } from '@/lib/strains/measure-item-size';
import { useListScrolling } from '@/lib/strains/use-list-scrolling';
import { useStrainListState } from '@/lib/strains/use-strain-list-state';

type AnimatedScrollHandler = (event: ReanimatedScrollEvent) => void;

type AnimatedFlashListProps = Omit<FlashListProps<Strain>, 'onScroll'> & {
  onScroll?: AnimatedScrollHandler;
};

const MAX_ENTERING_ANIMATIONS = 8;
const LUXURY_ITEM_HEIGHT = 104;
const STAGGER_ANIMATIONS = Array.from(
  { length: MAX_ENTERING_ANIMATIONS },
  (_, i) =>
    createStaggeredFadeIn(i, { baseDelay: 0, staggerDelay: 50, duration: 250 })
);

const AnimatedFlashList = Animated.createAnimatedComponent(
  FlashList
) as unknown as React.ForwardRefExoticComponent<
  AnimatedFlashListProps & React.RefAttributes<FlashListRef<Strain>>
>;

export type StrainsListProps = {
  searchQuery?: string;
  filters?: StrainFilters;
  skipFirstItems?: number;
  onScroll?: AnimatedScrollHandler;
  listRef?: React.RefObject<FlashListRef<unknown> | null>;
  contentContainerStyle?: FlashListProps<Strain>['contentContainerStyle'];
  testID?: string;
  ListHeaderComponent?: React.ReactElement | null;
  ListEmptyComponent?: React.ReactElement | null;
  onFeaturedStrainChange?: (strain: Strain | null) => void;
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

// Custom hook to encapsulate data fetching logic
function useStrainsListData(
  searchQuery: string,
  filters: StrainFilters,
  onStateChange?: StrainsListProps['onStateChange']
) {
  const normalizedSearchQuery = useMemo(
    () => (searchQuery || '').trim(),
    [searchQuery]
  );
  const normalizedFilters = useMemo(() => filters || {}, [filters]);
  const queryClient = useQueryClient();

  const queryResult = useOfflineAwareStrains(
    {
      searchQuery: normalizedSearchQuery,
      filters: normalizedFilters,
      pageSize: 20,
    },
    true
  );

  const { refetch, queryKey } = queryResult;
  useFocusEffect(
    useCallback(() => {
      const queryState = queryClient.getQueryState(queryKey);
      const isStale =
        !queryState?.dataUpdatedAt ||
        Date.now() - queryState.dataUpdatedAt > 30_000;
      if (isStale) refetch();
      return () => {
        queryClient.cancelQueries({ queryKey });
      };
    }, [refetch, queryKey, queryClient])
  );

  const listState = useStrainListState({
    data: queryResult.data,
    searchQuery,
    filters,
    refetch: queryResult.refetch,
    fetchNextPage: queryResult.fetchNextPage,
    hasNextPage: queryResult.hasNextPage,
    isFetchingNextPage: queryResult.isFetchingNextPage,
    isOffline: queryResult.isOffline,
    isUsingCache: queryResult.isUsingCache,
    isLoading: queryResult.isLoading,
    isError: queryResult.isError,
    onStateChange,
  });

  return listState;
}

export function StrainsList({
  searchQuery = '',
  filters = {},
  skipFirstItems = 0,
  onScroll,
  listRef,
  contentContainerStyle,
  testID = 'strains-list',
  ListHeaderComponent,
  ListEmptyComponent,
  onFeaturedStrainChange,
  onStateChange,
}: StrainsListProps) {
  const { strains, onEndReached } = useStrainsListData(
    searchQuery,
    filters,
    onStateChange
  );

  const lastFeaturedIdRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    const featuredId = strains.length > 0 ? strains[0].id : null;
    if (featuredId === lastFeaturedIdRef.current) return;
    lastFeaturedIdRef.current = featuredId;
    onFeaturedStrainChange?.(strains.length > 0 ? strains[0] : null);
  }, [strains, onFeaturedStrainChange]);

  const displayStrains = useMemo(() => {
    return skipFirstItems > 0 && strains.length > skipFirstItems
      ? strains.slice(skipFirstItems)
      : strains;
  }, [strains, skipFirstItems]);

  const flashListConfig = useMemo(
    () => ({
      ...getOptimizedFlashListConfig(),
      estimatedItemSize: LUXURY_ITEM_HEIGHT,
    }),
    []
  );
  const { composedScrollHandler } = useListScrolling({
    onScroll,
    listSize: displayStrains.length,
  });

  const renderItem = useCallback(
    ({ item, index }: { item: Strain; index: number }) => (
      <Animated.View
        entering={
          index < MAX_ENTERING_ANIMATIONS
            ? STAGGER_ANIMATIONS[index]
            : undefined
        }
      >
        <StrainListItem strain={item} testID={`strain-list-item-${item.id}`} />
      </Animated.View>
    ),
    []
  );

  return (
    <AnimatedFlashList
      ref={listRef as React.Ref<FlashListRef<Strain>>}
      testID={testID}
      data={displayStrains}
      renderItem={renderItem}
      keyExtractor={extractStrainKey}
      getItemType={getStrainItemType}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.7}
      onScroll={composedScrollHandler}
      contentContainerStyle={contentContainerStyle}
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={ListEmptyComponent}
      {...flashListConfig}
    />
  );
}
