/**
 * Enhanced strains list with offline cache support
 */

import {
  FlashList,
  type FlashListProps,
  type FlashListRef,
  type ListRenderItemInfo,
} from '@shopify/flash-list';
import { useQueryClient } from '@tanstack/react-query';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Animated from 'react-native-reanimated';

import type { Strain } from '@/api';
import type { StrainFilters } from '@/api/strains/types';
import { useOfflineAwareStrains } from '@/api/strains/use-strains-infinite-with-cache';
import { applyStrainFilters } from '@/lib/strains/filtering';
import { prefetchStrainImages } from '@/lib/strains/image-optimization';
import { getOptimizedFlashListConfig } from '@/lib/strains/measure-item-size';
import { useScrollPosition } from '@/lib/strains/use-scroll-position';

import { StrainCard } from './strain-card';
import { StrainsCacheIndicator } from './strains-cache-indicator';
import { StrainsEmptyState } from './strains-empty-state';
import { StrainsErrorCard } from './strains-error-card';
import { StrainsFooterLoader } from './strains-footer-loader';
import { StrainsSkeletonList } from './strains-skeleton-list';

const AnimatedFlashList = Animated.createAnimatedComponent(
  FlashList
) as React.ComponentClass<FlashListProps<Strain>>;

interface StrainsListWithCacheProps {
  searchQuery?: string;
  filters?: StrainFilters;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  onScroll?: (
    event: NativeSyntheticEvent<NativeScrollEvent> | Record<string, unknown>
  ) => void;
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
}

function generateQueryKey(params: {
  q: string;
  f: StrainFilters;
  s?: string;
  d?: string;
}): string {
  return JSON.stringify(params);
}

function useScrollRestoration(
  queryKey: string,
  strainsLength: number,
  onScroll?: (
    event: NativeSyntheticEvent<NativeScrollEvent> | Record<string, unknown>
  ) => void
) {
  const { saveScrollPosition, getInitialScrollOffset } =
    useScrollPosition(queryKey);
  const initialScrollIndexRef = useRef<number | null>(null);
  const hasRestoredRef = useRef(false);

  useEffect(() => {
    if (strainsLength > 0 && !hasRestoredRef.current) {
      const savedOffset = getInitialScrollOffset();
      if (savedOffset > 0) {
        const estimatedIndex = Math.floor(savedOffset / 280);
        initialScrollIndexRef.current = Math.min(
          estimatedIndex,
          strainsLength - 1
        );
        hasRestoredRef.current = true;
      }
    }
  }, [strainsLength, getInitialScrollOffset]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offset = event.nativeEvent.contentOffset.y;
      saveScrollPosition(offset);
      if (onScroll && typeof onScroll === 'function') {
        onScroll(event);
      }
    },
    [saveScrollPosition, onScroll]
  );

  return { initialScrollIndexRef, handleScroll };
}

// eslint-disable-next-line max-lines-per-function
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
  const queryKey = generateQueryKey({
    q: searchQuery,
    f: filters,
    s: sortBy,
    d: sortDirection,
  });

  const queryClient = useQueryClient();
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

  // Get raw strains from paginated API/cache response
  const rawStrains = useMemo<Strain[]>(() => {
    if (!data?.pages?.length) return [];
    return data.pages.flatMap((page) => page.data);
  }, [data?.pages]);

  // Apply client-side filters to guarantee UI matches selected filters
  // This ensures correct behavior for both online and cached/offline data
  const strains = useMemo(
    () =>
      // Pass searchQuery through so client-side filtering matches API results
      applyStrainFilters(rawStrains, filters || {}, searchQuery || ''),
    [rawStrains, filters, searchQuery]
  );

  const { initialScrollIndexRef, handleScroll } = useScrollRestoration(
    queryKey,
    strains.length,
    onScroll
  );

  const onRetry = useCallback(() => {
    void refetch();
  }, [refetch]);

  const onEndReached = useCallback(() => {
    if (!hasNextPage || isFetchingNextPage || isOffline || isUsingCache) {
      return;
    }
    void fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, isOffline, isUsingCache]);

  // Prefetch images for next page when approaching end
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && data?.pages) {
      const lastPage = data.pages[data.pages.length - 1];
      if (lastPage?.data) {
        // Prefetch images from the last page (they'll be visible soon)
        const imageUris = lastPage.data
          .slice(-5) // Last 5 items
          .map((strain) => strain.imageUrl)
          .filter(Boolean);

        if (imageUris.length > 0) {
          void prefetchStrainImages(imageUris, 'thumbnail');
        }
      }
    }
  }, [data?.pages, hasNextPage, isFetchingNextPage]);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Strain>) => (
      <StrainCard strain={item} testID={`strain-card-${item.id}`} />
    ),
    []
  );

  const keyExtractor = useCallback((item: Strain) => item.id, []);

  // Optimized getItemType for heterogeneous content
  const getItemType = useCallback((item: Strain) => {
    // Differentiate items based on content characteristics
    // This helps FlashList optimize recycling
    const hasDescription = item.description?.[0]?.length > 0;
    const hasTHC = !!item.thc_display;
    return `strain-${hasDescription ? 'desc' : 'nodesc'}-${hasTHC ? 'thc' : 'nothc'}`;
  }, []);

  // Get optimized configuration for device capabilities
  const flashListConfig = useMemo(() => getOptimizedFlashListConfig(), []);

  const listEmpty = useMemo(() => {
    if (isLoading && strains.length === 0) {
      return <StrainsSkeletonList />;
    }

    if (isError && !isOffline) {
      return <StrainsErrorCard onRetry={onRetry} />;
    }

    return (
      <StrainsEmptyState
        query={searchQuery}
        showOfflineNotice={isOffline && strains.length === 0}
      />
    );
  }, [isLoading, isError, isOffline, strains.length, searchQuery, onRetry]);

  const listHeader = useMemo(() => {
    return <StrainsCacheIndicator isUsingCache={isUsingCache} />;
  }, [isUsingCache]);

  const listFooter = useCallback(
    () => <StrainsFooterLoader isVisible={isFetchingNextPage} />,
    [isFetchingNextPage]
  );

  // Mirror data into the legacy query key so useStrain can find cached items.
  useEffect(() => {
    if (!data) return;
    queryClient.setQueryData(
      ['strains-infinite', searchQuery || '', filters || {}, 20],
      {
        pages: data.pages.map((page) => ({ data: page.data })),
        pageParams: data.pageParams,
      }
    );
  }, [data, filters, queryClient, searchQuery]);

  // Expose state to parent (for analytics/UX such as placeholder counts).
  // Guard against triggering on every render by comparing to the last snapshot.
  const stateSnapshot = useMemo(
    () => ({
      length: strains.length,
      isOffline,
      isUsingCache,
      isLoading,
      isError,
      isFetchingNextPage,
      hasNextPage: Boolean(hasNextPage),
    }),
    [
      strains.length,
      isOffline,
      isUsingCache,
      isLoading,
      isError,
      isFetchingNextPage,
      hasNextPage,
    ]
  );

  const lastStateRef = useRef<typeof stateSnapshot | null>(null);

  useEffect(() => {
    if (!onStateChange) return;
    const last = lastStateRef.current;
    const changed =
      !last ||
      last.length !== stateSnapshot.length ||
      last.isOffline !== stateSnapshot.isOffline ||
      last.isUsingCache !== stateSnapshot.isUsingCache ||
      last.isLoading !== stateSnapshot.isLoading ||
      last.isError !== stateSnapshot.isError ||
      last.isFetchingNextPage !== stateSnapshot.isFetchingNextPage ||
      last.hasNextPage !== stateSnapshot.hasNextPage;

    if (changed) {
      lastStateRef.current = stateSnapshot;
      onStateChange({
        strains,
        isOffline: stateSnapshot.isOffline,
        isUsingCache: stateSnapshot.isUsingCache,
        isLoading: stateSnapshot.isLoading,
        isError: stateSnapshot.isError,
        isFetchingNextPage: stateSnapshot.isFetchingNextPage,
        hasNextPage: stateSnapshot.hasNextPage,
      });
    }
  }, [onStateChange, stateSnapshot, strains]);

  return (
    <AnimatedFlashList
      // @ts-expect-error - AnimatedFlashList ref type mismatch with FlashListRef
      ref={listRef}
      testID={testID}
      data={strains}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      getItemType={getItemType}
      // FlashList v2: Auto-calculates item sizes - no manual override needed
      // Fine-tuned performance based on device capabilities
      onEndReached={onEndReached}
      onEndReachedThreshold={0.7}
      onScroll={handleScroll}
      scrollEventThrottle={16}
      removeClippedSubviews={flashListConfig.removeClippedSubviews}
      // Performance optimizations for low-memory devices
      drawDistance={flashListConfig.drawDistance}
      contentContainerStyle={contentContainerStyle}
      ListHeaderComponent={listHeader}
      ListEmptyComponent={listEmpty}
      ListFooterComponent={listFooter}
      initialScrollIndex={initialScrollIndexRef.current ?? undefined}
    />
  );
}
