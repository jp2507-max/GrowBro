/**
 * Enhanced strains list with offline cache support
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
import { StrainCard } from '@/components/strains/strain-card';
import { createStaggeredFadeIn } from '@/lib/animations/stagger';
import {
  DEFAULT_ITEM_HEIGHT,
  extractStrainKey,
  getStrainItemType,
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

const MAX_ENTERING_ANIMATIONS = 8;

// Pre-compute animation configs to avoid recreation on each render
const STAGGER_ANIMATIONS = Array.from(
  { length: MAX_ENTERING_ANIMATIONS },
  (_, i) =>
    createStaggeredFadeIn(i, { baseDelay: 0, staggerDelay: 60, duration: 300 })
);

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

  // Normalize search inputs once to ensure consistency between queryKey and data fetching
  const normalizedSearchQuery = useMemo(
    () => (searchQuery || '').trim(),
    [searchQuery]
  );
  const normalizedFilters = useMemo(() => filters || {}, [filters]);

  // Memoize queryKey to avoid JSON.stringify on every render
  const queryKey = useMemo(
    () =>
      JSON.stringify({
        q: normalizedSearchQuery,
        f: normalizedFilters,
        s: sortBy,
        d: sortDirection,
      }),
    [normalizedSearchQuery, normalizedFilters, sortBy, sortDirection]
  );

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
    queryKey: strainsQueryKey,
  } = useOfflineAwareStrains(
    {
      searchQuery: normalizedSearchQuery,
      filters: normalizedFilters,
      sortBy,
      sortDirection,
      pageSize: 20,
    },
    true
  );

  const queryClient = useQueryClient();

  useFocusEffect(
    useCallback(() => {
      const queryState = queryClient.getQueryState(strainsQueryKey);
      const isStale =
        !queryState?.dataUpdatedAt ||
        Date.now() - queryState.dataUpdatedAt > 30_000; // 30s stale time

      if (isStale) {
        refetch();
      }
      return () => {
        // Cancel pending requests when screen loses focus
        queryClient.cancelQueries({ queryKey: strainsQueryKey });
      };
    }, [refetch, strainsQueryKey, queryClient])
  );

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

  // Keep a ref to the latest factory so stable handlers always use fresh state/logic
  const latestFactoryRef = React.useRef(createToggleHandler);
  // biome-ignore lint/correctness/useExhaustiveDependencies: ensure ref is always current
  React.useLayoutEffect(() => {
    latestFactoryRef.current = createToggleHandler;
  });

  // Map to store stable handlers keyed by strain ID
  const toggleHandlersRef = React.useRef(new Map<string, () => void>());

  // Cleanup stale handlers when strains list changes to prevent memory leak
  React.useEffect(() => {
    const currentIds = new Set(strains.map((s) => s.id));
    const map = toggleHandlersRef.current;
    for (const id of map.keys()) {
      if (!currentIds.has(id)) {
        map.delete(id);
      }
    }
  }, [strains]);

  const getStableToggleHandler = React.useCallback((item: Strain) => {
    const map = toggleHandlersRef.current;
    if (!map.has(item.id)) {
      // Create a stable wrapper that delegates to the latest factory logic
      map.set(item.id, () => {
        const handler = latestFactoryRef.current(item);
        handler();
      });
    }
    return map.get(item.id)!;
  }, []);

  const renderItem = React.useCallback(
    ({ item, index }: { item: Strain; index: number }) => (
      <Animated.View
        entering={
          index < MAX_ENTERING_ANIMATIONS
            ? STAGGER_ANIMATIONS[index]
            : undefined
        }
      >
        <StrainCard
          strain={item}
          testID={`strain-card-${item.id}`}
          enableSharedTransition={item.id === activeStrainId}
          onStartNavigation={handleStrainPressIn}
          isFavorite={isFavorite(item)}
          onToggleFavorite={getStableToggleHandler(item)}
        />
      </Animated.View>
    ),
    [activeStrainId, handleStrainPressIn, isFavorite, getStableToggleHandler]
  );

  return (
    <AnimatedFlashList
      ref={listRef as React.Ref<FlashListRef<Strain>>}
      testID={testID}
      data={strains}
      renderItem={renderItem}
      keyExtractor={extractStrainKey}
      getItemType={getStrainItemType}
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
