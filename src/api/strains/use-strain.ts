import { useQuery } from '@tanstack/react-query';

import { getStrainsApiClient } from './client';

/**
 * Query hook for fetching a single strain by ID
 * Implements 24-hour caching for optimal performance
 *
 * @example
 * ```tsx
 * const { data: strain, isLoading, error } = useStrain({ strainId: 'og-kush-123' });
 * ```
 */
// TODO: Include strainId in query key to avoid cache collisions
// The useStrain hook stores every request under the fixed key ['strain']. If two different IDs are requested,
// the second fetch overwrites the first and any component using the hook can render the wrong strain or stale data.
// It also breaks the usePrefetchStrain helper, which prefetches under a key that includes the ID and therefore
// never matches this cache entry. The query key should incorporate strainId so each strain response is isolated
// and prefetched data can be reused.
export function useStrain({ strainId }: { strainId: string }) {
  return useQuery({
    queryKey: ['strain', { strainId }],
    queryFn: async ({ signal }) => {
      const client = getStrainsApiClient();
      return await client.getStrain(strainId, signal);
    },
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    gcTime: 2 * 24 * 60 * 60 * 1000, // 48 hours
    retry: (failureCount, error: unknown) => {
      // Don't retry on 404 (strain not found) or 429 (rate limited)
      const status =
        error &&
        typeof error === 'object' &&
        'response' in error &&
        error.response &&
        typeof error.response === 'object' &&
        'status' in error.response
          ? (error.response.status as number)
          : undefined;
      if (status === 404 || status === 429) {
        return false;
      }
      // Retry once for 5xx errors
      return failureCount < 1;
    },
  });
}
