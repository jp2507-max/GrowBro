/**
 * Hook to manage data synchronization with legacy query keys
 */

import type { InfiniteData } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import type { Strain } from '@/api';
import type { StrainFilters } from '@/api/strains/types';

interface UseLegacyQuerySyncOptions {
  data?: InfiniteData<{ data: Strain[] }>;
  searchQuery?: string;
  filters?: StrainFilters;
}

/**
 * Mirrors data into legacy query key for backward compatibility
 * Ensures useStrain can find cached items
 */
export function useLegacyQuerySync({
  data,
  searchQuery = '',
  filters = {},
}: UseLegacyQuerySyncOptions): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!data) return;
    queryClient.setQueryData(
      ['strains-infinite', searchQuery || '', filters || {}, 20],
      {
        pages: data.pages.map((page) => ({ data: page.data })),
        pageParams: data.pageParams,
      }
    );
  }, [data, filters, queryClient, searchQuery]);
}
