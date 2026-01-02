import type { CommunityPostSort } from '@/api/community/types';

export type CommunityPostsQueryParams = {
  query?: string;
  sort?: CommunityPostSort;
  photosOnly?: boolean;
  mineOnly?: boolean;
  limit?: number;
};

const COMMUNITY_POSTS_INFINITE_KEY = ['community-posts', 'infinite'] as const;
const COMMUNITY_USER_POSTS_KEY = ['community-user-posts'] as const;
const COMMUNITY_COMMENTS_KEY = ['community-comments'] as const;
const COMMUNITY_POSTS_PAGE_KEY = ['community-posts', 'page'] as const;
const COMMUNITY_USER_PROFILE_KEY = ['community-user-profile'] as const;

export function communityPostsInfiniteKey(
  params?: CommunityPostsQueryParams
): readonly unknown[] {
  if (!params) return COMMUNITY_POSTS_INFINITE_KEY;
  return [...COMMUNITY_POSTS_INFINITE_KEY, params];
}

export function communityPostsPageKey(options: {
  cursor?: string;
  limit?: number;
}): readonly unknown[] {
  return [
    ...COMMUNITY_POSTS_PAGE_KEY,
    options.cursor ?? null,
    options.limit ?? null,
  ];
}

export function communityPostKey(postId: string): readonly [string, unknown] {
  return ['community-post', { postId }];
}

export function communityCommentsKey(options: {
  postId: string;
  cursor?: string;
  limit?: number;
}): readonly unknown[] {
  return [
    ...COMMUNITY_COMMENTS_KEY,
    options.postId,
    options.cursor ?? null,
    options.limit ?? null,
  ];
}

export function communityUserProfileKey(
  userId: string
): readonly [string, unknown] {
  return [...COMMUNITY_USER_PROFILE_KEY, { userId }];
}

export function communityUserPostsKey(options?: {
  userId?: string;
  limit?: number;
}): readonly unknown[] {
  if (!options?.userId && options?.limit == null) {
    return COMMUNITY_USER_POSTS_KEY;
  }

  return [
    ...COMMUNITY_USER_POSTS_KEY,
    { userId: options.userId, limit: options.limit },
  ];
}

export function isCommunityPostsInfiniteKey(
  queryKey: readonly unknown[]
): boolean {
  return (
    queryKey.length >= COMMUNITY_POSTS_INFINITE_KEY.length &&
    COMMUNITY_POSTS_INFINITE_KEY.every(
      (part, index) => queryKey[index] === part
    )
  );
}

export function isCommunityUserPostsKey(queryKey: readonly unknown[]): boolean {
  return (
    queryKey.length >= COMMUNITY_USER_POSTS_KEY.length &&
    COMMUNITY_USER_POSTS_KEY.every((part, index) => queryKey[index] === part)
  );
}

export function isCommunityCommentsKey(queryKey: readonly unknown[]): boolean {
  return (
    queryKey.length >= COMMUNITY_COMMENTS_KEY.length &&
    COMMUNITY_COMMENTS_KEY.every((part, index) => queryKey[index] === part)
  );
}
