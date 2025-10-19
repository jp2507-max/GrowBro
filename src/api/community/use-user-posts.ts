import { createInfiniteQuery } from 'react-query-kit';

import type { PaginateQuery } from '@/api/types';

import { getCommunityApiClient } from './client';
import type { Post } from './types';

type Variables = { userId: string; limit?: number };
type Response = PaginateQuery<Post>;

export const useUserPosts = createInfiniteQuery<
  Response,
  Variables,
  Error,
  string | undefined
>({
  queryKey: ['user-posts'],
  fetcher: async (variables, { pageParam }) => {
    const client = getCommunityApiClient();
    return client.getUserPosts(
      variables.userId,
      pageParam,
      variables.limit ?? 20
    );
  },
  getNextPageParam: (lastPage) => lastPage.next ?? undefined,
  initialPageParam: undefined,
});
