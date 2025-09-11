import { useInfiniteQuery } from '@tanstack/react-query';

import { client } from '../common';
import {
  getNextPageParam,
  getPreviousPageParam,
  keepPreviousData,
} from '../common/utils';
import type { Post } from './types';

type Variables = {
  limit?: number;
  category?: string;
};

export const usePostsInfinite = (params: Variables = {}) => {
  return useInfiniteQuery({
    queryKey: ['posts-infinite', params],
    queryFn: async ({ pageParam }) => {
      const response = await client.get('posts', {
        params: {
          cursor: pageParam,
          limit: params.limit || 10,
          category: params.category,
        },
      });
      return response.data as {
        results: Post[];
        count: number;
        next: string | null;
        previous: string | null;
      };
    },
    getNextPageParam,
    getPreviousPageParam,
    placeholderData: keepPreviousData,
    initialPageParam: null,
    // Remove maxPages until getPreviousPageParam is fully implemented
    // maxPages: 10,
  });
};
