import { keepPreviousData } from '@tanstack/react-query';
import { createInfiniteQuery } from 'react-query-kit';

import { client, DEFAULT_LIMIT } from '@/api/common';
import { getNextPageParam, getPreviousPageParam } from '@/api/common/utils';
import type { Post } from '@/api/posts';
import type { PaginateQuery } from '@/api/types';

type Variables = {
  limit?: number;
  category?: string;
};

type PostPage = PaginateQuery<Post>;

// Helper function to extract cursor token from full URLs
const extractCursorToken = (cursor: string | undefined): string | undefined => {
  if (!cursor) return undefined;

  // If it's already a simple token (no URL structure), return as-is
  if (!cursor.includes('://') && !cursor.includes('?')) {
    return cursor;
  }

  try {
    // Parse as URL and extract cursor parameter
    const url = new URL(cursor, 'http://localhost');
    return url.searchParams.get('cursor') || cursor;
  } catch {
    // If URL parsing fails, try to extract from query string
    const queryMatch = cursor.match(/[?&]cursor=([^&#]*)/);
    return queryMatch ? decodeURIComponent(queryMatch[1]) : cursor;
  }
};

export const usePostsInfinite = createInfiniteQuery<
  PostPage,
  Variables,
  Error,
  string | undefined
>({
  queryKey: ['posts-infinite'],
  fetcher: async (vars: Variables, { pageParam, signal }) => {
    const cursor = extractCursorToken(pageParam);

    const params: Record<string, any> = {
      limit: vars?.limit ?? DEFAULT_LIMIT,
    };

    if (cursor) {
      params.cursor = cursor;
    }

    if (vars?.category) {
      params.category = vars.category;
    }

    const response = await client.get('posts', {
      params,
      signal,
    });
    return response.data as PostPage;
  },
  getNextPageParam,
  getPreviousPageParam,
  placeholderData: keepPreviousData,
  initialPageParam: undefined,
  // Remove maxPages until getPreviousPageParam is fully implemented
  // maxPages: 10,
});
