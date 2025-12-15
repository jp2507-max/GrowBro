import { useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { database } from '@/lib/watermelon';
import { CachedStrainsRepository } from '@/lib/watermelon-models/cached-strains-repository';

import { getStrainsApiClient } from './client';
import { mapSupabaseRowToStrain } from './supabase-list';
import type { Strain } from './types';

/**
 * Find a strain by slug or ID from the cached infinite query data
 */
function findStrainInCache(
  queryClient: ReturnType<typeof useQueryClient>,
  slugOrId: string
): Strain | undefined {
  // Get all queries that match 'strains-infinite'
  const queries = queryClient.getQueriesData<{
    pages?: { data?: Strain[] }[];
  }>({
    queryKey: ['strains-infinite'],
  });

  // Search through all cached pages for the strain (by slug or ID)
  for (const [, data] of queries) {
    if (data?.pages) {
      for (const page of data.pages) {
        if (page?.data) {
          const found = page.data.find(
            (s) => s.slug === slugOrId || s.id === slugOrId
          );
          if (found) {
            return found;
          }
        }
      }
    }
  }

  return undefined;
}

let cacheRepo: CachedStrainsRepository | null = null;

function getCacheRepository(): CachedStrainsRepository {
  if (!cacheRepo) {
    cacheRepo = new CachedStrainsRepository(database);
  }
  return cacheRepo;
}

async function findStrainInLocalCache(
  idOrSlug: string
): Promise<Strain | undefined> {
  try {
    const repo = getCacheRepository();
    const match = await repo.findStrainByIdOrSlug(idOrSlug);
    return match ?? undefined;
  } catch (error) {
    console.debug('[useStrain] local cache lookup failed', error);
    return undefined;
  }
}

async function findStrainInSupabase(
  idOrSlug: string
): Promise<Strain | undefined> {
  try {
    const { data, error } = await supabase
      .from('strain_cache')
      .select('id, slug, name, race, data')
      .or(`id.eq.${idOrSlug},slug.eq.${idOrSlug}`)
      .limit(1);

    if (error) {
      throw error;
    }

    const row = data?.[0];
    if (!row) {
      return undefined;
    }

    return mapSupabaseRowToStrain(row);
  } catch (error) {
    console.debug('[useStrain] Supabase lookup failed', error);
    return undefined;
  }
}

/**
 * Query hook for fetching a single strain by slug or ID
 *
 * Data flow:
 * 1. Check React Query cache (from infinite list data)
 * 2. Check Watermelon cached pages (offline list cache)
 * 3. If not found, call API which checks Supabase strain_cache
 * 4. If not in Supabase, fetches from external API and caches
 *
 * This enables deep links to work - users can share strain URLs
 * and the strain will be fetched even if not previously viewed.
 *
 * @example
 * ```tsx
 * const { data: strain, isLoading, error } = useStrain({ strainIdOrSlug: 'og-kush' });
 * ```
 */
export function useStrain({
  strainIdOrSlug,
  enabled = true,
}: {
  strainIdOrSlug: string | undefined;
  /** Set to false to skip fetching (e.g., when strain is already provided) */
  enabled?: boolean;
}) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['strain', { strainIdOrSlug }],
    queryFn: async ({ signal }) => {
      // First, look up strain from cached list data (instant, no API call)
      const cachedStrain = findStrainInCache(queryClient, strainIdOrSlug!);

      if (cachedStrain) {
        return cachedStrain;
      }

      const offlineStrain = await findStrainInLocalCache(strainIdOrSlug!);
      if (offlineStrain) {
        return offlineStrain;
      }

      const supabaseStrain = await findStrainInSupabase(strainIdOrSlug!);
      if (supabaseStrain) {
        return supabaseStrain;
      }

      // Not in React Query cache - fetch from API
      // The API will check Supabase strain_cache first (free)
      // If not there, it fetches from external API and caches for future
      const apiClient = getStrainsApiClient();
      return apiClient.getStrain(strainIdOrSlug!, signal);
    },
    enabled: enabled && !!strainIdOrSlug,
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    gcTime: 2 * 24 * 60 * 60 * 1000, // 48 hours
    retry: 1, // Retry once for network errors
  });
}
