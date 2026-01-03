import type { InfiniteData } from '@tanstack/react-query';
import { QueryClient } from '@tanstack/react-query';

import type { PaginateQuery } from '@/api/types';
import type { Post } from '@/types/community';

import {
  updatePostInInfiniteFeed,
  updatePostInUserPosts,
  updateSinglePost,
} from './cache-updaters';
import { communityPostKey } from './query-keys';

describe('community cache updaters', () => {
  let queryClient: QueryClient;
  const basePage: PaginateQuery<Post> = {
    results: [
      {
        id: 'post-1',
        userId: 'user-1',
        body: 'First post',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        like_count: 1,
        comment_count: 0,
        user_has_liked: false,
      },
      {
        id: 'post-2',
        userId: 'user-2',
        body: 'Second post',
        created_at: '2024-01-02T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
        like_count: 3,
        comment_count: 1,
        user_has_liked: false,
      },
    ],
    count: 2,
    next: null,
    previous: null,
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  test('updatePostInInfiniteFeed updates matching post', () => {
    queryClient.setQueryData<InfiniteData<PaginateQuery<Post>>>(
      ['community-posts', 'infinite'],
      {
        pages: [basePage],
        pageParams: [undefined],
      }
    );

    updatePostInInfiniteFeed({
      queryClient,
      matchPostId: 'post-1',
      updater: (post) => ({
        ...post,
        like_count: (post.like_count ?? 0) + 1,
        user_has_liked: true,
      }),
    });

    const updated = queryClient.getQueryData<InfiniteData<PaginateQuery<Post>>>(
      ['community-posts', 'infinite']
    );

    expect(updated?.pages[0].results[0].like_count).toBe(2);
    expect(updated?.pages[0].results[0].user_has_liked).toBe(true);
  });

  test('updatePostInUserPosts updates matching post', () => {
    queryClient.setQueryData<InfiniteData<PaginateQuery<Post>>>(
      ['community-user-posts', { userId: 'user-1', limit: 20 }],
      {
        pages: [basePage],
        pageParams: [undefined],
      }
    );

    updatePostInUserPosts({
      queryClient,
      matchPostId: 'post-2',
      updater: (post) => ({
        ...post,
        comment_count: (post.comment_count ?? 0) + 1,
      }),
    });

    const updated = queryClient.getQueryData<InfiniteData<PaginateQuery<Post>>>(
      ['community-user-posts', { userId: 'user-1', limit: 20 }]
    );

    expect(updated?.pages[0].results[1].comment_count).toBe(2);
  });

  test('updateSinglePost updates post detail cache', () => {
    const postDetail: Post = {
      id: 'post-1',
      userId: 'user-1',
      body: 'Detail post',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      like_count: 1,
      comment_count: 0,
      user_has_liked: false,
    };

    queryClient.setQueryData(communityPostKey('post-1'), postDetail);

    updateSinglePost({
      queryClient,
      postId: 'post-1',
      updater: (post) => ({ ...post, user_has_liked: true }),
    });

    const updated = queryClient.getQueryData<Post>(communityPostKey('post-1'));

    expect(updated?.user_has_liked).toBe(true);
  });
});
