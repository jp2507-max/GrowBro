/**
 * Hook to manage strain list state, callbacks, and side effects
 */

import type { InfiniteData } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import type { Strain } from '@/api';
import type { StrainFilters } from '@/api/strains/types';
import { applyStrainFilters } from '@/lib/strains/filtering';
import { prefetchStrainImages } from '@/lib/strains/image-optimization';

import { useLegacyQuerySync } from './use-legacy-query-sync';
import { useStateChangeNotification } from './use-state-change-notification';

interface UseStrainListStateOptions {
  data?: InfiniteData<{ data: Strain[] }>;
  searchQuery?: string;
  filters?: StrainFilters;
  refetch: () => Promise<unknown>;
  fetchNextPage: () => Promise<unknown>;
  hasNextPage?: boolean;
  isFetchingNextPage: boolean;
  isOffline: boolean;
  isUsingCache: boolean;
  isLoading: boolean;
  isError: boolean;
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

interface UseStrainListStateReturn {
  strains: Strain[];
  onRetry: () => void;
  onEndReached: () => void;
}

/**
 * Manages strain list state including filtering, callbacks, and state notifications
 */
export function useStrainListState({
  data,
  searchQuery = '',
  filters = {},
  refetch,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
  isOffline,
  isUsingCache,
  isLoading,
  isError,
  onStateChange,
}: UseStrainListStateOptions): UseStrainListStateReturn {
  const rawStrains = useMemo<Strain[]>(() => {
    if (!data?.pages?.length) return [];
    return data.pages.flatMap((page) => page.data);
  }, [data?.pages]);

  const strains = useMemo(
    () => applyStrainFilters(rawStrains, filters, searchQuery),
    [rawStrains, filters, searchQuery]
  );

  const prefetchUpcomingImages = useCallback(() => {
    if (!data?.pages) return;
    const lastPage = data.pages[data.pages.length - 1];
    if (lastPage?.data) {
      const imageUris = lastPage.data
        .slice(-12)
        .map((strain) => strain.imageUrl)
        .filter(Boolean);
      if (imageUris.length > 0) {
        void prefetchStrainImages(imageUris, 'thumbnail');
      }
    }
  }, [data?.pages]);

  const onEndReached = useCallback(() => {
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

  const onRetry = useCallback(() => {
    void refetch();
  }, [refetch]);

  useLegacyQuerySync({ data, searchQuery, filters });

  useStateChangeNotification({
    strains,
    isOffline,
    isUsingCache,
    isLoading,
    isError,
    isFetchingNextPage,
    hasNextPage,
    onStateChange,
  });

  return {
    strains,
    onRetry,
    onEndReached,
  };
}
