import { createQuery } from 'react-query-kit';

import { getStrainsApiClient } from './client';
import type { Strain } from './types';

/**
 * Query hook for fetching a single strain by ID
 * Implements 24-hour caching for optimal performance
 *
 * @example
 * ```tsx
 * const { data: strain, isLoading, error } = useStrain('og-kush-123');
 * ```
 */
export const useStrain = createQuery<Strain, { strainId: string }, Error>({
  queryKey: ['strain'],
  fetcher: async (variables, { signal }) => {
    const client = getStrainsApiClient();
    return await client.getStrain(variables.strainId, signal);
  },
  staleTime: 24 * 60 * 60 * 1000, // 24 hours
  gcTime: 2 * 24 * 60 * 60 * 1000, // 48 hours
  retry: (failureCount, error: any) => {
    // Don't retry on 404 (strain not found) or 429 (rate limited)
    const status = error?.response?.status;
    if (status === 404 || status === 429) {
      return false;
    }
    // Retry once for 5xx errors
    return failureCount < 1;
  },
});
