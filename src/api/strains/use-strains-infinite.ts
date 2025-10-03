import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';

import { getStrainsApiClient } from './client';
import type { StrainFilters } from './types';

/**
 * Parameters for infinite strains query
 */
export type UseStrainsInfiniteParams = {
  searchQuery?: string;
  filters?: StrainFilters;
  pageSize?: number;
};

/**
 * Infinite query hook for browsing strains with search and filters
 * Implements React Query v5 patterns with cursor-based pagination
 *
 * @example
 * ```tsx
 * const { data, fetchNextPage, hasNextPage, isLoading } = useStrainsInfinite({
 *   variables: {
 *     searchQuery: 'og kush',
 *     filters: { race: 'hybrid' },
 *     pageSize: 20
 *   }
 * });
 * ```
 */
export function useStrainsInfinite({
  variables,
}: {
  variables?: UseStrainsInfiniteParams;
} = {}) {
  return useInfiniteQuery({
    queryKey: [
      'strains-infinite',
      variables?.searchQuery,
      variables?.filters,
      variables?.pageSize ?? 20,
    ],
    queryFn: async ({ pageParam, signal }) => {
      const client = getStrainsApiClient();

      const response = await client.getStrains({
        searchQuery: variables?.searchQuery,
        filters: variables?.filters,
        pageSize: variables?.pageSize ?? 20,
        cursor: pageParam,
        signal,
      });

      return response;
    },
    getNextPageParam: (lastPage) => {
      // Return cursor if more pages available, undefined to stop pagination
      return lastPage.hasMore ? lastPage.nextCursor : undefined;
    },
    placeholderData: keepPreviousData,
    initialPageParam: undefined,
    staleTime: 5 * 60 * 1000, // 5 minutes - prevents unnecessary refetches
    gcTime: 10 * 60 * 1000, // 10 minutes - cache garbage collection
  });
}
