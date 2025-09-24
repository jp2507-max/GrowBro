import { keepPreviousData } from '@tanstack/react-query';
import { createInfiniteQuery } from 'react-query-kit';

import { client, DEFAULT_LIMIT } from '@/api/common';
import { getNextPageParam } from '@/api/common/utils';
import type { Plant } from '@/api/plants/types';
import type { PaginateQuery } from '@/api/types';

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
    const params: Record<string, string> = {
      limit: String(DEFAULT_LIMIT),
    };

    if (variables?.query) {
      params.search = variables.query;
    }

    const cursor = pageParam ?? variables?.cursor;
    if (cursor) {
      params.cursor = cursor;
    }

    const response = await client.get('plants', { params, signal });
    return response.data as PlantPage;
  },
  getNextPageParam,
  placeholderData: keepPreviousData,
  initialPageParam: undefined,
});
