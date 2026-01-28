/**
 * PostCard component - "Instagram Pro" clean design
 *
 * Clean separation layout for community posts:
 * - Row 1: Header (Avatar + Name + Time + MoreHorizontal)
 * - Row 2: Hero Image (100% width, 4/3 aspect ratio, no text overlays)
 * - Row 3: Action Bar (Heart, MessageCircle icons)
 * - Row 4: Content (caption limited to 3 lines with "more...")
 *
 * Container: bg-white dark:bg-charcoal-900 mx-5 mb-6 rounded-3xl shadow-sm border
 */

import { useRouter } from 'expo-router';
import React from 'react';

import { useUserProfile } from '@/api/community';
import type { Post as ApiPost } from '@/api/posts';
import { useAuth } from '@/lib/auth';
import { normalizePostUserId } from '@/lib/community/post-utils';
import { translate } from '@/lib/i18n';

import { PostCardView } from './post-card-view';
import type { PressEvent } from './types';
import { usePostSharing } from './use-post-sharing';

type PostCardProps = {
  post: ApiPost;
  onDelete?: (postId: number | string, undoExpiresAt: string) => void;
  displayUsername?: string | null;
  enableSharedTransition?: boolean;
  onCardPressIn?: (postId: number | string) => void;
  testID?: string;
};

function PostCardComponent({
  post,
  onDelete,
  displayUsername: displayUsernameOverride,
  enableSharedTransition,
  onCardPressIn,
  testID = 'post-card',
}: PostCardProps): React.ReactElement {
  const router = useRouter();
  const authStatus = useAuth.use.status();
  const currentUserId = useAuth.use.user()?.id ?? null;

  const normalizedPost = React.useMemo(() => normalizePostUserId(post), [post]);

  // Runtime validation: ensure userId is present and valid
  if (!normalizedPost.userId || normalizedPost.userId === 'invalid-user-id') {
    console.warn('Post has invalid userId, using fallback', {
      postId: normalizedPost.id,
    });
  }

  const postUserId =
    normalizedPost.userId === 'invalid-user-id'
      ? `unknown-user-${normalizedPost.id}`
      : String(normalizedPost.userId);
  const postId = normalizedPost.id;

  // Optimistic fetching of user profile to display proper username
  const { data: userProfile } = useUserProfile({
    variables: { userId: postUserId },
    enabled:
      displayUsernameOverride === undefined &&
      !!postUserId &&
      postUserId !== 'invalid-user-id' &&
      !postUserId.startsWith('unknown-'),
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const displayUsername =
    displayUsernameOverride ??
    userProfile?.username ??
    (postUserId.startsWith('unknown-')
      ? translate('accessibility.community.unknown_user')
      : translate('accessibility.community.anonymous_user'));

  const isOwnPost =
    authStatus !== 'idle' &&
    currentUserId !== null &&
    postUserId === currentUserId;

  const handleCommentPress = React.useCallback(
    (e: PressEvent) => {
      e.stopPropagation();
      router.push(`/feed/${postId}`);
    },
    [router, postId]
  );

  const handleAuthorPress = React.useCallback(
    (e: PressEvent) => {
      e.stopPropagation();
      router.push(`/community/${postUserId}`);
    },
    [router, postUserId]
  );

  const { handleSharePress } = usePostSharing(String(postId));

  return (
    <PostCardView
      post={post}
      postId={postId}
      displayUsername={displayUsername}
      isOwnPost={isOwnPost}
      onDelete={onDelete}
      enableSharedTransition={enableSharedTransition}
      onCardPressIn={onCardPressIn}
      testID={testID}
      handleAuthorPress={handleAuthorPress}
      handleCommentPress={handleCommentPress}
      onSharePress={handleSharePress}
    />
  );
}

// Memoize PostCard to prevent unnecessary re-renders
export const PostCard = React.memo(
  PostCardComponent,
  (prevProps, nextProps) => {
    return (
      prevProps.post.id === nextProps.post.id &&
      prevProps.post.body === nextProps.post.body &&
      prevProps.post.media_uri === nextProps.post.media_uri &&
      prevProps.post.media_resized_uri === nextProps.post.media_resized_uri &&
      prevProps.post.media_thumbnail_uri ===
        nextProps.post.media_thumbnail_uri &&
      prevProps.post.media_blurhash === nextProps.post.media_blurhash &&
      prevProps.post.media_thumbhash === nextProps.post.media_thumbhash &&
      prevProps.post.like_count === nextProps.post.like_count &&
      prevProps.post.comment_count === nextProps.post.comment_count &&
      prevProps.post.user_has_liked === nextProps.post.user_has_liked &&
      prevProps.post.created_at === nextProps.post.created_at &&
      prevProps.post.userId === nextProps.post.userId &&
      prevProps.onDelete === nextProps.onDelete &&
      prevProps.displayUsername === nextProps.displayUsername &&
      prevProps.enableSharedTransition === nextProps.enableSharedTransition &&
      prevProps.onCardPressIn === nextProps.onCardPressIn &&
      prevProps.testID === nextProps.testID
    );
  }
);
