import { keepPreviousData } from '@tanstack/react-query';
import { createInfiniteQuery } from 'react-query-kit';

import type { PaginateQuery } from '@/api/types';

import { getCommunityApiClient } from './client';
import type { CommunityPostSort, Post } from './types';

type Variables = {
  query?: string;
  sort?: CommunityPostSort;
  photosOnly?: boolean;
  mineOnly?: boolean;
  limit?: number;
  category?: string | null;
};

type PostPage = PaginateQuery<Post>;

export const useCommunityPostsInfinite = createInfiniteQuery<
  PostPage,
  Variables,
  Error,
  string | undefined
>({
  queryKey: ['community-posts', 'infinite'],
  fetcher: async (variables, { pageParam }): Promise<PostPage> => {
    const client = getCommunityApiClient();
    return client.getPostsDiscover({
      query: variables?.query,
      cursor: pageParam,
      limit: variables?.limit,
      sort: variables?.sort,
      photosOnly: variables?.photosOnly,
      mineOnly: variables?.mineOnly,
      category: variables?.category,
    });
  },
  getNextPageParam: (lastPage): string | undefined =>
    lastPage.next ?? undefined,
  placeholderData: keepPreviousData,
  initialPageParam: undefined,
});
