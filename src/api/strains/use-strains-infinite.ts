import { keepPreviousData } from '@tanstack/react-query';
import { createInfiniteQuery } from 'react-query-kit';

import { client, DEFAULT_LIMIT } from '@/api/common';
import { getNextPageParam } from '@/api/common/utils';
import type { Strain } from '@/api/strains/types';
import type { PaginateQuery } from '@/api/types';

type Variables = {
  cursor?: string;
  query?: string;
};

type StrainPage = PaginateQuery<Strain>;

export const useStrainsInfinite = createInfiniteQuery<
  StrainPage,
  Variables,
  Error,
  string | undefined
>({
  queryKey: ['strains-infinite'],
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

    const response = await client.get('strains', { params, signal });
    return response.data as StrainPage;
  },
  getNextPageParam,
  placeholderData: keepPreviousData,
  initialPageParam: undefined,
});
