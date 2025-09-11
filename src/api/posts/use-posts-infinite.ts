import { useInfiniteQuery } from '@tanstack/react-query';

import { client, DEFAULT_LIMIT, getQueryKey } from '@/api/common';
import {
  getNextPageParam,
  getPreviousPageParam,
  keepPreviousData,
} from '@/api/common/utils';
import type { Post } from '@/api/posts';
import type { PaginateQuery } from '@/api/types';

type Variables = {
  limit?: number;
  category?: string;
};

export const usePostsInfinite = (params: Variables = {}) => {
  return useInfiniteQuery({
    queryKey: getQueryKey('posts-infinite', params),
    queryFn: async ({ pageParam, signal }) => {
      const response = await client.get('posts', {
        params: {
          cursor: pageParam,
          limit: params.limit || DEFAULT_LIMIT,
          category: params.category,
        },
        signal,
      });
      return response.data as PaginateQuery<Post>;
    },
    getNextPageParam,
    getPreviousPageParam,
    placeholderData: keepPreviousData,
    initialPageParam: null,
    // Remove maxPages until getPreviousPageParam is fully implemented
    // maxPages: 10,
  });
};
