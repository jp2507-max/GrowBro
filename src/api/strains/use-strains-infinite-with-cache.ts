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
  pageParam: number
): Promise<(StrainsResponse & { fromCache: boolean }) | null> {
  const cachedStrains = await repo.getCachedStrains(params, pageParam);

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
  pageParam: number;
  signal: AbortSignal | undefined;
}): Promise<StrainsResponse & { fromCache: boolean }> {
  const { client, repo, vars, pageParam, signal } = params;

  const response = await client.getStrains({
    searchQuery: vars?.searchQuery,
    filters: vars?.filters,
    pageSize: vars?.pageSize ?? 20,
    cursor: String(pageParam),
    signal,
  });

  if (response.data && response.data.length > 0) {
    const cacheParams = {
      searchQuery: vars?.searchQuery,
      filters: vars?.filters,
      sortBy: vars?.sortBy,
      sortDirection: vars?.sortDirection,
    };

    await repo.cachePage(cacheParams, pageParam, response.data).catch((err) => {
      console.warn('[fetchAndCache] Cache write failed:', err);
    });
  }

  return { ...response, fromCache: false };
}

export const useStrainsInfiniteWithCache = createInfiniteQuery<
  StrainsResponse & { fromCache?: boolean },
  UseStrainsInfiniteWithCacheParams,
  Error,
  number
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
        pageParam,
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
  getNextPageParam: (lastPage, allPages) => {
    if (lastPage.fromCache) return undefined;
    return lastPage.hasMore ? allPages.length : undefined;
  },
  placeholderData: keepPreviousData,
  initialPageParam: 0,
  staleTime: 5 * 60 * 1000,
  gcTime: 10 * 60 * 1000,
  retry: (failureCount, error) => {
    if (error.message.includes('No network connection')) return false;
    return failureCount < 1;
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
