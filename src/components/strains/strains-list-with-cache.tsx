/**
 * Enhanced strains list with offline cache support
 */

import { FlashList } from '@shopify/flash-list';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { type ListRenderItemInfo } from 'react-native';
import Animated from 'react-native-reanimated';

import type { Strain } from '@/api';
import type { StrainFilters } from '@/api/strains/types';
import { useOfflineAwareStrains } from '@/api/strains/use-strains-infinite-with-cache';
import { prefetchStrainImages } from '@/lib/strains/image-optimization';
import { getOptimizedFlashListConfig } from '@/lib/strains/measure-item-size';
import { useScrollPosition } from '@/lib/strains/use-scroll-position';

import { StrainCard } from './strain-card';
import { StrainsCacheIndicator } from './strains-cache-indicator';
import { StrainsEmptyState } from './strains-empty-state';
import { StrainsErrorCard } from './strains-error-card';
import { StrainsFooterLoader } from './strains-footer-loader';
import { StrainsSkeletonList } from './strains-skeleton-list';

const AnimatedFlashList = Animated.createAnimatedComponent(FlashList as any);

interface StrainsListWithCacheProps {
  searchQuery?: string;
  filters?: StrainFilters;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  onScroll?: any;
  listRef?: React.RefObject<any>;
  contentContainerStyle?: any;
  testID?: string;
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
  onScroll?: any
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
    (event: any) => {
      const offset = event.nativeEvent.contentOffset.y;
      saveScrollPosition(offset);
      if (onScroll) onScroll(event);
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
}: StrainsListWithCacheProps) {
  const queryKey = generateQueryKey({
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

  const strains = useMemo<Strain[]>(() => {
    if (!data?.pages?.length) return [];
    return data.pages.flatMap((page) => page.data);
  }, [data?.pages]);

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

  return (
    <AnimatedFlashList
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
      maxToRenderPerBatch={flashListConfig.maxToRenderPerBatch}
      windowSize={flashListConfig.windowSize}
      updateCellsBatchingPeriod={flashListConfig.updateCellsBatchingPeriod}
      contentContainerStyle={contentContainerStyle}
      ListHeaderComponent={listHeader}
      ListEmptyComponent={listEmpty}
      ListFooterComponent={listFooter}
      initialScrollIndex={initialScrollIndexRef.current ?? undefined}
    />
  );
}
