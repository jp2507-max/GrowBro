import { createInfiniteQuery } from 'react-query-kit';

import type { PaginateQuery } from '@/api/types';
import { communityUserPostsKey } from '@/lib/community/query-keys';

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
  queryKey: communityUserPostsKey(),
  fetcher: async (variables, { pageParam }): Promise<Response> => {
    const client = getCommunityApiClient();
    return client.getUserPosts(
      variables.userId,
      pageParam,
      variables.limit ?? 20
    );
  },
  getNextPageParam: (lastPage): string | undefined =>
    lastPage.next ?? undefined,
  initialPageParam: undefined,
});
