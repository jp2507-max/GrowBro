import { keepPreviousData } from '@tanstack/react-query';
import { createInfiniteQuery } from 'react-query-kit';

import type { Plant } from '@/api/plants/types';
import type { PaginateQuery } from '@/api/types';
import { getOptionalAuthenticatedUserId } from '@/lib/auth';
import { listPlantsForUser, toPlant } from '@/lib/plants/plant-service';

type Variables = {
  cursor?: string;
  query?: string;
};

type PlantPage = PaginateQuery<Plant>;

export const usePlantsInfinite = createInfiniteQuery<
  PlantPage,
  Variables,
  Error,
  string | undefined
>({
  queryKey: ['plants-infinite'],
  fetcher: async (variables, { pageParam, signal }) => {
    // WatermelonDB local fetch: pagination not needed for local data
    // All plants are loaded in one pass since they're already on device
    void pageParam;
    void signal;

    const userId = await getOptionalAuthenticatedUserId();
    const allPlants = await listPlantsForUser({ userId: userId ?? undefined });
    const term = variables?.query?.toLowerCase().trim();
    const filtered = term
      ? allPlants.filter((plant) => {
          const name = plant.name?.toLowerCase?.() ?? '';
          const strain = plant.strain?.toLowerCase?.() ?? '';
          return name.includes(term) || strain.includes(term);
        })
      : allPlants;

    const results: Plant[] = filtered.map(toPlant);

    return {
      results,
      count: results.length,
      next: null,
      previous: null,
    };
  },
  getNextPageParam: () => null,
  placeholderData: keepPreviousData,
  initialPageParam: undefined,
});
