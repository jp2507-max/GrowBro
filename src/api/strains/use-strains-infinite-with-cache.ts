/**
 * Enhanced infinite query hook with offline cache support
 * Integrates WatermelonDB cache for offline browsing
 */

import {
  keepPreviousData,
  useInfiniteQuery,
  useQueryClient,
} from '@tanstack/react-query';
import React, { useEffect, useMemo } from 'react';
import { InteractionManager } from 'react-native';

import { useNetworkStatus } from '@/lib/hooks/use-network-status';
import { isEnvFlagEnabled } from '@/lib/utils/env-flags';
import { database } from '@/lib/watermelon';
import { CachedStrainsRepository } from '@/lib/watermelon-models/cached-strains-repository';

import { getStrainsApiClient } from './client';
import { fetchStrainsFromSupabase } from './supabase-list';
import type { GetStrainsParams, StrainFilters, StrainsResponse } from './types';

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

type CacheWriteParams = {
  searchQuery?: string;
  filters?: StrainFilters;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
};

type CacheWriteTask = {
  repo: CachedStrainsRepository;
  params: CacheWriteParams;
  pageNumber: number;
  strains: StrainsResponse['data'];
};

type CacheWriteQueueState = {
  scheduled: ReturnType<typeof InteractionManager.runAfterInteractions> | null;
  queued: Map<string, CacheWriteTask>;
};

const CACHE_WRITE_QUEUE_MAX_SIZE = 4;

const CACHE_WRITE_QUEUE: CacheWriteQueueState = {
  scheduled: null,
  queued: new Map<string, CacheWriteTask>(),
};

function trimCacheQueueToMaxSize(): void {
  while (CACHE_WRITE_QUEUE.queued.size > CACHE_WRITE_QUEUE_MAX_SIZE) {
    const firstKey = CACHE_WRITE_QUEUE.queued.keys().next().value as
      | string
      | undefined;
    if (!firstKey) break;
    CACHE_WRITE_QUEUE.queued.delete(firstKey);
  }
}

function createCacheWriteKey(task: CacheWriteTask): string {
  return JSON.stringify({ ...task.params, pageNumber: task.pageNumber });
}

async function flushCacheQueueOnce(): Promise<void> {
  const first = CACHE_WRITE_QUEUE.queued.entries().next().value as
    | [string, CacheWriteTask]
    | undefined;
  if (!first) return;

  const [key, task] = first;
  CACHE_WRITE_QUEUE.queued.delete(key);

  try {
    await task.repo.cachePage(task.params, task.pageNumber, task.strains);
  } catch (error) {
    console.warn('[strains-cache] Cache write failed:', error);
  }

  if (CACHE_WRITE_QUEUE.queued.size > 0) scheduleCacheFlush();
}

function scheduleCacheFlush(): void {
  if (CACHE_WRITE_QUEUE.scheduled) return;

  CACHE_WRITE_QUEUE.scheduled = InteractionManager.runAfterInteractions(() => {
    CACHE_WRITE_QUEUE.scheduled = null;
    void flushCacheQueueOnce();
  });
}

function enqueueCacheWrite(task: CacheWriteTask): void {
  CACHE_WRITE_QUEUE.queued.set(createCacheWriteKey(task), task);
  trimCacheQueueToMaxSize();
  scheduleCacheFlush();
}

type PageParamShape = { index: number; cursor?: string };

async function tryGetCachedData(
  repo: CachedStrainsRepository,
  params: UseStrainsInfiniteWithCacheParams | undefined,
  pageParam: PageParamShape | undefined
): Promise<(StrainsResponse & { fromCache: boolean }) | null> {
  if (!params) return null;
  const pageIndex = pageParam?.index ?? 0;
  const cachedStrains = await repo.getCachedStrains(params, pageIndex);

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
  pageParam: PageParamShape | undefined;
  signal: AbortSignal | undefined;
}): Promise<StrainsResponse & { fromCache: boolean }> {
  const { client, repo, vars, pageParam, signal } = params;

  const response = await client.getStrains({
    searchQuery: vars?.searchQuery,
    filters: vars?.filters,
    pageSize: vars?.pageSize ?? 20,
    page: pageParam?.index ?? 0,
    cursor: pageParam?.cursor ?? undefined,
    signal,
  });

  if (
    !isEnvFlagEnabled('EXPO_PUBLIC_DISABLE_STRAINS_CACHE_WRITES') &&
    response.data &&
    response.data.length > 0
  ) {
    const cacheParams = {
      searchQuery: vars?.searchQuery,
      filters: vars?.filters,
      sortBy: vars?.sortBy,
      sortDirection: vars?.sortDirection,
    };

    const pageIndex = pageParam?.index ?? 0;
    enqueueCacheWrite({
      repo,
      params: cacheParams,
      pageNumber: pageIndex,
      strains: response.data,
    });
  }

  return { ...response, fromCache: false };
}

// eslint-disable-next-line max-lines-per-function
export function useStrainsInfiniteWithCache({
  variables,
  enabled = true,
}: {
  variables?: UseStrainsInfiniteWithCacheParams;
  enabled?: boolean;
} = {}) {
  return useInfiniteQuery({
    queryKey: [
      'strains-with-cache',
      variables?.searchQuery,
      variables?.filters,
      variables?.pageSize ?? 20,
      variables?.sortBy,
      variables?.sortDirection,
    ],
    enabled,
    queryFn: async ({ pageParam = { index: 0 }, signal }) => {
      const client = getStrainsApiClient();
      const repo = getCacheRepository();
      const pageIndex = pageParam?.index ?? 0;
      const pageSize = variables?.pageSize ?? 20;

      const cacheParams = {
        searchQuery: variables?.searchQuery,
        filters: variables?.filters,
        sortBy: variables?.sortBy,
        sortDirection: variables?.sortDirection,
      };

      try {
        const supabasePage = await fetchStrainsFromSupabase({
          searchQuery: variables?.searchQuery,
          filters: variables?.filters,
          pageSize,
          page: pageIndex,
          sortBy: variables?.sortBy as GetStrainsParams['sortBy'] | undefined,
          sortDirection: variables?.sortDirection,
          signal,
        });

        if (
          !isEnvFlagEnabled('EXPO_PUBLIC_DISABLE_STRAINS_CACHE_WRITES') &&
          supabasePage.data?.length
        ) {
          enqueueCacheWrite({
            repo,
            params: cacheParams,
            pageNumber: pageIndex,
            strains: supabasePage.data,
          });
        }
        return { ...supabasePage, fromCache: false };
      } catch (error) {
        console.info(
          '[useStrainsInfiniteWithCache] Supabase fetch failed, falling back to API',
          error
        );
      }

      try {
        const result = await fetchAndCache({
          client,
          repo,
          vars: variables,
          pageParam, // Now a PageParamShape | undefined; fetchAndCache handles index/cursor
          signal,
        });
        return result;
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
      const nextIndex = allPages.length; // next page index (0-based)
      if (lastPage.nextCursor)
        return { index: nextIndex, cursor: lastPage.nextCursor };
      return lastPage.hasMore ? { index: nextIndex } : undefined;
    },
    placeholderData: keepPreviousData,
    initialPageParam: { index: 0 }, // Starts with page 0 for initial load
    staleTime: 5 * 60 * 1000, // ✅ Good: 5min stale time for reasonable freshness
    gcTime: 10 * 60 * 1000, // ✅ Good: 10min garbage collection time
    retry: (failureCount, error: Error) => {
      if (error?.message?.includes('No network connection')) return false; // ✅ Good: No retry on network issues
      return failureCount < 2; // ✅ Allow 2 retries (3 total attempts) for transient errors
    },
  });
}

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
  params: UseStrainsInfiniteWithCacheParams,
  enabled = true
) {
  const { isInternetReachable } = useNetworkStatus();
  const query = useStrainsInfiniteWithCache({ variables: params, enabled });

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
