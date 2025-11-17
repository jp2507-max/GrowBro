import { useQuery } from '@tanstack/react-query';

import { isAxiosErrorWithNumericStatus } from '@/lib/error-handling';

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
      if (isAxiosErrorWithNumericStatus(error)) {
        const status = error.response.status;
        if (status === 404 || status === 429) {
          return false;
        }
      }
      // Retry once for 5xx errors
      return failureCount < 1;
    },
  });
}
