import { createQuery } from 'react-query-kit';

import type { Plant } from '@/api/plants/types';
import { getOptionalAuthenticatedUserId } from '@/lib/auth';
import { getPlantById, toPlant } from '@/lib/plants/plant-service';

const _usePlant = createQuery<Plant, { id: string }>({
  queryKey: ['plant'],
  fetcher: async ({ id }, { signal }) => {
    // signal unused because Watermelon is local
    void signal;
    const userId = await getOptionalAuthenticatedUserId();
    const model = await getPlantById(id);
    if (!model) {
      throw new Error('Plant not found');
    }
    if (userId && model.userId && model.userId !== userId) {
      throw new Error('Plant belongs to a different user');
    }
    return toPlant(model);
  },
});

type UsePlantOptions = Omit<Parameters<typeof _usePlant>[0], 'variables'>;

export const usePlant = Object.assign(
  (variables: { id: string }, options?: UsePlantOptions) =>
    _usePlant({ ...options, variables }),
  _usePlant
);
