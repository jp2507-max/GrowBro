/**
 * Enhanced infinite query hook with offline cache support
 * Integrates WatermelonDB cache for offline browsing
 */

import { keepPreviousData, useQueryClient } from '@tanstack/react-query';
import React, { useEffect, useMemo } from 'react';
import { createInfiniteQuery } from 'react-query-kit';

import { useNetworkStatus } from '@/lib/hooks/use-network-status';
import { database } from '@/lib/watermelon';
import { CachedStrainsRepository } from '@/lib/watermelon-models/cached-strains-repository';

import { getStrainsApiClient } from './client';
import type { StrainFilters, StrainsResponse } from './types';

export type UseStrainsInfiniteWithCacheParams = {
  searchQuery?: string;
  filters?: StrainFilters;
  pageSize?: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
};

let cacheRepo: CachedStrainsRepository | null = null;

function getCacheRepository(): CachedStrainsRepository {
  if (!cacheRepo) {
    cacheRepo = new CachedStrainsRepository(database);
  }
  return cacheRepo;
}

async function tryGetCachedData(
  repo: CachedStrainsRepository,
  params: any,
  pageParam: string | number | undefined
): Promise<(StrainsResponse & { fromCache: boolean }) | null> {
  const cachedStrains = await repo.getCachedStrains(
    params,
    typeof pageParam === 'number' ? pageParam : 0
  );

  if (cachedStrains && cachedStrains.length > 0) {
    return {
      data: cachedStrains,
      hasMore: false,
      nextCursor: undefined,
      fromCache: true,
    };
  }

  return null;
}

async function fetchAndCache(params: {
  client: ReturnType<typeof getStrainsApiClient>;
  repo: CachedStrainsRepository;
  vars: UseStrainsInfiniteWithCacheParams | undefined;
  pageParam: string | number | undefined;
  signal: AbortSignal | undefined;
}): Promise<StrainsResponse & { fromCache: boolean }> {
  const { client, repo, vars, pageParam, signal } = params;

  const response = await client.getStrains({
    searchQuery: vars?.searchQuery,
    filters: vars?.filters,
    pageSize: vars?.pageSize ?? 20,
    page: typeof pageParam === 'number' ? pageParam : 0,
    cursor: typeof pageParam === 'string' ? pageParam : undefined,
    signal,
  });

  if (response.data && response.data.length > 0) {
    const cacheParams = {
      searchQuery: vars?.searchQuery,
      filters: vars?.filters,
      sortBy: vars?.sortBy,
      sortDirection: vars?.sortDirection,
    };

    await repo
      .cachePage(
        cacheParams,
        typeof pageParam === 'number' ? pageParam : 0,
        response.data
      )
      .catch((err) => {
        console.warn('[fetchAndCache] Cache write failed:', err);
      });
  }

  return { ...response, fromCache: false };
}

export const useStrainsInfiniteWithCache = createInfiniteQuery<
  StrainsResponse & { fromCache?: boolean },
  UseStrainsInfiniteWithCacheParams,
  Error,
  string | number | undefined
>({
  queryKey: ['strains-with-cache'],
  fetcher: async (variables, { pageParam = 0, signal }) => {
    const client = getStrainsApiClient();
    const repo = getCacheRepository();

    const cacheParams = {
      searchQuery: variables?.searchQuery,
      filters: variables?.filters,
      sortBy: variables?.sortBy,
      sortDirection: variables?.sortDirection,
    };

    try {
      return await fetchAndCache({
        client,
        repo,
        vars: variables,
        pageParam, // ✅ FIXED: Now passes string | number | undefined, fetchAndCache handles both
        signal,
      });
    } catch (error) {
      const cached = await tryGetCachedData(repo, cacheParams, pageParam);
      if (cached) {
        console.info('[useStrainsInfiniteWithCache] Using cache fallback');
        return cached;
      }
      throw error;
    }
  },
  // ✅ FIXED: Prioritizes API cursor tokens, falls back to page numbers
  // Supports both cursor-based and page-based pagination
  getNextPageParam: (lastPage, allPages) => {
    if (lastPage.fromCache) return undefined;
    if (lastPage.nextCursor) return lastPage.nextCursor;
    return lastPage.hasMore ? allPages.length : undefined;
  },
  placeholderData: keepPreviousData,
  initialPageParam: 0, // ✅ Good: Starts with page 0 for initial load
  staleTime: 5 * 60 * 1000, // ✅ Good: 5min stale time for reasonable freshness
  gcTime: 10 * 60 * 1000, // ✅ Good: 10min garbage collection time
  retry: (failureCount, error) => {
    if (error.message.includes('No network connection')) return false; // ✅ Good: No retry on network issues
    return failureCount < 1; // ⚠️ Conservative: Only 1 retry, may be too aggressive
  },
});

export function useCacheStats() {
  const [stats, setStats] = React.useState<{
    totalEntries: number;
    totalSize: number;
    expiredEntries: number;
    oldestEntry: Date | null;
    newestEntry: Date | null;
  } | null>(null);

  useEffect(() => {
    const repo = getCacheRepository();
    repo
      .getCacheStats()
      .then(setStats)
      .catch((err) => {
        console.error('[useCacheStats] Failed to get stats:', err);
      });
  }, []);

  return stats;
}

export function useClearExpiredCache() {
  const queryClient = useQueryClient();

  return async () => {
    const repo = getCacheRepository();
    const cleared = await repo.clearExpiredCache();
    console.info(`[useClearExpiredCache] Cleared ${cleared} expired entries`);
    await queryClient.invalidateQueries({ queryKey: ['strains-with-cache'] });
    return cleared;
  };
}

export function useClearAllCache() {
  const queryClient = useQueryClient();

  return async () => {
    const repo = getCacheRepository();
    const cleared = await repo.clearAllCache();
    console.info(`[useClearAllCache] Cleared ${cleared} cache entries`);
    await queryClient.invalidateQueries({ queryKey: ['strains-with-cache'] });
    return cleared;
  };
}

export function useOfflineAwareStrains(
  params: UseStrainsInfiniteWithCacheParams
) {
  const { isInternetReachable } = useNetworkStatus();
  const query = useStrainsInfiniteWithCache({ variables: params });

  const isOffline = !isInternetReachable;
  const isUsingCache = useMemo(() => {
    return query.data?.pages.some((page) => page.fromCache) ?? false;
  }, [query.data]);

  return {
    ...query,
    isOffline,
    isUsingCache,
  };
}
