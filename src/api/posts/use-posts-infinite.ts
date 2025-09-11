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
      // NOTE: The server's next/previous cursor values historically contain
      // full pagination URLs (e.g. "https://api.example.com/posts?cursor=abc").
      // Passing those raw strings directly as the `cursor` query param will
      // produce requests like `GET /posts?cursor=https://.../posts?cursor=abc`,
      // which most cursor-based APIs will reject.
      //
      // Two safe approaches:
      // 1) Parse the token from the returned URL (preferred when API expects
      //    a token only). For example, use the URL constructor to extract the
      //    `cursor` query param and pass only that token here.
      // 2) Treat the returned value as a full URL and fetch that URL directly
      //    instead of calling `GET /posts?cursor=...` (useful when the server
      //    provides an absolute next-page URL).
      //
      // TODO: Update getNextPageParam/getPreviousPageParam or adapt this
      // queryFn to ensure pageParam is a raw token (not a full URL) before
      // sending it as `cursor`.
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
