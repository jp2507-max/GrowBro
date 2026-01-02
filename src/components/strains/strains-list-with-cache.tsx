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
import Animated from 'react-native-reanimated';

import type { Strain } from '@/api';
import type { StrainFilters } from '@/api/strains/types';
import { useOfflineAwareStrains } from '@/api/strains/use-strains-infinite-with-cache';
import { applyStrainFilters } from '@/lib/strains/filtering';
import { prefetchStrainImages } from '@/lib/strains/image-optimization';
import { getOptimizedFlashListConfig } from '@/lib/strains/measure-item-size';
import { useFlashListPerformance } from '@/lib/strains/use-flashlist-performance';
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

// Pre-calculated item heights for overrideItemLayout
// Image: 208px (h-52) + Content padding: ~80px base + description ~40px + mb-5 (20px)
const ITEM_HEIGHTS = {
  'strain-desc-thc': 340, // Full card with description and THC badge
  'strain-desc-nothc': 330, // Description, no THC
  'strain-nodesc-thc': 300, // No description, has THC
  'strain-nodesc-nothc': 290, // Minimal card
} as const;

const DEFAULT_ITEM_HEIGHT = 320;

/**
 * Direct type alias for the animated scroll handler from FlashListProps.
 */
type AnimatedScrollHandler = FlashListProps<Strain>['onScroll'];

/**
 * Event type for the scroll callback, derived from AnimatedScrollHandler.
 * Uses Parameters utility type to extract the first argument type.
 */
type ScrollEventType = Parameters<NonNullable<AnimatedScrollHandler>>[0];

interface StrainsListWithCacheProps {
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
}

function generateQueryKey(params: {
  q: string;
  f: StrainFilters;
  s?: string;
  d?: string;
}): string {
  return JSON.stringify(params);
}

function useScrollRestoration(queryKey: string, strainsLength: number) {
  const { getInitialScrollOffset, getSavedScrollIndex } =
    useScrollPosition(queryKey);
  const initialScrollIndexRef = useRef<number | null>(null);
  const hasRestoredRef = useRef(false);

  useEffect(() => {
    if (strainsLength > 0 && !hasRestoredRef.current) {
      // Prefer saved index over estimated offset for accuracy
      const savedIndex = getSavedScrollIndex();
      if (savedIndex !== null && savedIndex >= 0) {
        initialScrollIndexRef.current = Math.min(savedIndex, strainsLength - 1);
        hasRestoredRef.current = true;
        return;
      }

      // Fallback to offset-based estimation using dynamic item height
      const savedOffset = getInitialScrollOffset();
      if (savedOffset > 0) {
        const estimatedIndex = Math.floor(savedOffset / DEFAULT_ITEM_HEIGHT);
        initialScrollIndexRef.current = Math.min(
          estimatedIndex,
          strainsLength - 1
        );
        hasRestoredRef.current = true;
      }
    }
  }, [strainsLength, getInitialScrollOffset, getSavedScrollIndex]);

  return { initialScrollIndexRef };
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

  const { initialScrollIndexRef } = useScrollRestoration(
    queryKey,
    strains.length
  );

  const onRetry = useCallback(() => {
    void refetch();
  }, [refetch]);

  // Prefetch images from last visible items before triggering next page fetch
  const prefetchUpcomingImages = useCallback(() => {
    if (!data?.pages) return;
    const lastPage = data.pages[data.pages.length - 1];
    if (lastPage?.data) {
      const imageUris = lastPage.data
        .slice(-12) // Prefetch last 12 items for aggressive pre-loading during fast scroll
        .map((strain) => strain.imageUrl)
        .filter(Boolean);
      if (imageUris.length > 0) {
        void prefetchStrainImages(imageUris, 'thumbnail');
      }
    }
  }, [data?.pages]);

  const onEndReached = useCallback(() => {
    // Prefetch images immediately when threshold is reached (before fetch completes)
    prefetchUpcomingImages();

    if (!hasNextPage || isFetchingNextPage || isOffline || isUsingCache) {
      return;
    }
    void fetchNextPage();
  }, [
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isOffline,
    isUsingCache,
    prefetchUpcomingImages,
  ]);

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

  // Pre-calculate exact item heights based on content type
  const overrideItemLayout = useCallback(
    (layout: { size?: number; span?: number }, item: Strain) => {
      const itemType = getItemType(item);
      layout.size =
        ITEM_HEIGHTS[itemType as keyof typeof ITEM_HEIGHTS] ??
        DEFAULT_ITEM_HEIGHT;
    },
    [getItemType]
  );

  // Get optimized configuration for device capabilities
  const flashListConfig = useMemo(() => getOptimizedFlashListConfig(), []);

  // Performance monitoring for production
  const {
    onScroll: onPerfScroll,
    startTracking,
    stopTracking,
  } = useFlashListPerformance({
    listSize: strains.length,
    enabled: __DEV__ || process.env.NODE_ENV === 'production',
  });

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

  // Combined scroll handler for external handler + performance tracking
  const handleScroll = useCallback(
    (event: ScrollEventType) => {
      onPerfScroll();
      // Forward to external handler if provided (preserves Reanimated worklet behavior)
      if (onScroll) {
        onScroll(event);
      }
    },
    [onScroll, onPerfScroll]
  );

  // Track blank areas during scroll for performance debugging
  const blankAreaRef = useRef<{ cumulative: number; max: number }>({
    cumulative: 0,
    max: 0,
  });

  const onBlankArea = useCallback(
    (event: { offsetStart: number; offsetEnd: number; blankArea: number }) => {
      // Track cumulative and max blank area for analytics
      blankAreaRef.current.cumulative += event.blankArea;
      blankAreaRef.current.max = Math.max(
        blankAreaRef.current.max,
        event.blankArea
      );

      // Log significant blank areas in dev mode for debugging
      if (__DEV__ && event.blankArea > 100) {
        console.debug('[FlashList] Blank area detected:', {
          blankArea: event.blankArea,
          offsetStart: event.offsetStart,
          offsetEnd: event.offsetEnd,
        });
      }
    },
    []
  );

  // Start/stop performance tracking based on list visibility
  useEffect(() => {
    if (strains.length > 0) {
      startTracking();
    }
    return () => {
      stopTracking();
    };
  }, [strains.length, startTracking, stopTracking]);

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
      // Pre-calculate item heights for smoother fast scrolling
      overrideItemLayout={overrideItemLayout}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.7}
      onScroll={handleScroll}
      // Track blank areas for performance monitoring
      onBlankArea={onBlankArea}
      scrollEventThrottle={flashListConfig.scrollEventThrottle}
      // Performance optimizations from device-adaptive config
      removeClippedSubviews={flashListConfig.removeClippedSubviews}
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
