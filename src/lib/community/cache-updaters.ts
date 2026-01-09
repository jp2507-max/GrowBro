import type {
  InfiniteData,
  QueryClient,
  QueryKey,
} from '@tanstack/react-query';

import type { PaginateQuery } from '@/api/types';
import type { Post } from '@/types/community';

import {
  communityPostKey,
  isCommunityPostsInfiniteKey,
  isCommunityUserPostsKey,
} from './query-keys';

type PostUpdater = (post: Post) => Post;

function updatePaginatedPage(
  page: PaginateQuery<Post>,
  matchPostId: string,
  updater: PostUpdater
): { page: PaginateQuery<Post>; didUpdate: boolean } {
  let didUpdate = false;
  const results = page.results.map((post) => {
    if (post.id !== matchPostId) return post;
    didUpdate = true;
    return updater(post);
  });

  if (!didUpdate) return { page, didUpdate };
  return { page: { ...page, results }, didUpdate };
}

function updateInfiniteData(
  data: InfiniteData<PaginateQuery<Post>>,
  matchPostId: string,
  updater: PostUpdater
): InfiniteData<PaginateQuery<Post>> {
  let didUpdate = false;
  const pages = data.pages.map((page) => {
    const result = updatePaginatedPage(page, matchPostId, updater);
    if (result.didUpdate) didUpdate = true;
    return result.page;
  });

  if (!didUpdate) return data;
  return { ...data, pages };
}

type UpdateInfiniteQueriesParams = {
  queryClient: QueryClient;
  predicate: (queryKey: QueryKey) => boolean;
  matchPostId: string;
  updater: PostUpdater;
};

function updateInfiniteQueries(params: UpdateInfiniteQueriesParams): void {
  const { queryClient, predicate, matchPostId, updater } = params;
  queryClient.setQueriesData<InfiniteData<PaginateQuery<Post>>>(
    { predicate: (query) => predicate(query.queryKey) },
    (old) => {
      if (!old) return old;
      return updateInfiniteData(old, matchPostId, updater);
    }
  );
}

export function updatePostInInfiniteFeed(params: {
  queryClient: QueryClient;
  matchPostId: string;
  updater: PostUpdater;
}): void {
  updateInfiniteQueries({
    queryClient: params.queryClient,
    predicate: isCommunityPostsInfiniteKey,
    matchPostId: params.matchPostId,
    updater: params.updater,
  });
}

export function updatePostInUserPosts(params: {
  queryClient: QueryClient;
  matchPostId: string;
  updater: PostUpdater;
}): void {
  updateInfiniteQueries({
    queryClient: params.queryClient,
    predicate: isCommunityUserPostsKey,
    matchPostId: params.matchPostId,
    updater: params.updater,
  });
}

export function updateSinglePost(params: {
  queryClient: QueryClient;
  postId: string;
  updater: PostUpdater;
}): void {
  params.queryClient.setQueryData<Post>(
    communityPostKey(params.postId),
    (old) => {
      if (!old) return old;
      return params.updater(old);
    }
  );
}
