import { keepPreviousData } from '@tanstack/react-query';
import { createInfiniteQuery } from 'react-query-kit';

import { getStrainsApiClient } from './client';
import type { StrainFilters, StrainsResponse } from './types';

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
export const useStrainsInfinite = createInfiniteQuery<
  StrainsResponse,
  UseStrainsInfiniteParams,
  Error,
  string | undefined
>({
  queryKey: ['strains-infinite'],
  fetcher: async (variables, { pageParam, signal }) => {
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
