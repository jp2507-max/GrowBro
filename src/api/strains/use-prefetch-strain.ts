import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { getStrainsApiClient } from './client';
import type { GetStrainsParams } from './types';

type PrefetchStrainsPageParams = Omit<GetStrainsParams, 'signal' | 'page'>;

/**
 * Hook for prefetching strain details
 * Useful for optimistically loading strain data when user hovers/focuses on a strain card
 *
 * @example
 * ```tsx
 * const prefetchStrain = usePrefetchStrain();
 *
 * <Pressable
 *   onPressIn={() => prefetchStrain('og-kush-123')}
 *   onPress={() => navigate(`/strains/${strainId}`)}
 * >
 * ```
 */
export function usePrefetchStrain() {
  const queryClient = useQueryClient();

  const prefetchStrain = useCallback(
    async (strainId: string) => {
      const client = getStrainsApiClient();

      await queryClient.prefetchQuery({
        queryKey: ['strain', { strainId }],
        queryFn: async ({ signal }) => {
          return await client.getStrain(strainId, signal);
        },
        staleTime: 24 * 60 * 60 * 1000, // 24 hours - match useStrain config
        gcTime: 2 * 24 * 60 * 60 * 1000, // 48 hours
      });
    },
    [queryClient]
  );

  return prefetchStrain;
}

/**
 * Hook for prefetching multiple strain pages
 * Useful for preloading next page before user reaches the end
 *
 * @example
 * ```tsx
 * const prefetchStrainsPage = usePrefetchStrainsPage();
 *
 * useEffect(() => {
 *   if (hasNextPage && nextCursor) {
 *     prefetchStrainsPage({ cursor: nextCursor, searchQuery, filters });
 *   }
 * }, [hasNextPage, nextCursor]);
 * ```
 */
export function usePrefetchStrainsPage() {
  const queryClient = useQueryClient();

  const prefetchPage = useCallback(
    async (params: PrefetchStrainsPageParams) => {
      const client = getStrainsApiClient();

      await queryClient.prefetchInfiniteQuery({
        queryKey: [
          'strains-infinite',
          params.searchQuery,
          params.filters,
          params.pageSize ?? 20,
        ],
        queryFn: async ({ pageParam, signal }) => {
          return await client.getStrains({
            ...params,
            cursor: pageParam ?? params.cursor,
            signal,
          });
        },
        initialPageParam: undefined,
        staleTime: 5 * 60 * 1000, // 5 minutes - match useStrainsInfinite config
        gcTime: 10 * 60 * 1000,
      });
    },
    [queryClient]
  );

  return prefetchPage;
}
