import { createInfiniteQuery } from 'react-query-kit';

import { getCommunityApiClient } from './client';
import type { PaginatedResponse, Post } from './types';

type Variables = { userId: string; limit?: number };
type Response = PaginatedResponse<Post>;

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
