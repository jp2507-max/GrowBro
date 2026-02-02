/**
 * usePostCard - Hook for PostCard logic
 *
 * Extracts state management and callbacks from the main component
 * to reduce function length.
 */

import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useRouter } from 'expo-router';
import React from 'react';

import { useDeletePost, useUserProfile } from '@/api/community';
import type { Post as ApiPost } from '@/api/posts';
import { useAuth } from '@/lib/auth';
import { normalizePostUserId } from '@/lib/community/post-utils';
import { formatRelativeTimeTranslated } from '@/lib/datetime/format-relative-time';
import { translate } from '@/lib/i18n';

import { useCardAnimation } from './use-card-animation';
import { useCardInteractions } from './use-card-interactions';
import { usePostSharing } from './use-post-sharing';

type UsePostCardOptions = {
  post: ApiPost;
  onDelete?: (postId: number | string, undoExpiresAt: string) => void;
  displayUsernameOverride?: string | null;
  onCardPressIn?: (postId: number | string) => void;
};

type UsePostCardReturn = {
  postId: number | string;
  postUserId: string;
  displayUsername: string;
  avatarUrl: string | null;
  isOwnPost: boolean;
  animatedStyle: ReturnType<typeof useCardAnimation>['animatedStyle'];
  onPressOut: () => void;
  handlePressIn: () => void;
  handleCommentPress: () => void;
  handleSharePress: () => Promise<void>;
  relativeTime: string;
  optionsSheetRef: React.RefObject<BottomSheetModal>;
  handleDeleteConfirm: () => Promise<void>;
  deleteMutation: ReturnType<typeof useDeletePost>;
};

export function usePostCard({
  post,
  onDelete,
  displayUsernameOverride,
  onCardPressIn,
}: UsePostCardOptions): UsePostCardReturn {
  const router = useRouter();
  const authStatus = useAuth((s) => s.status);
  const currentUserId = useAuth((s) => s.user?.id ?? null);

  const normalizedPost = React.useMemo(() => normalizePostUserId(post), [post]);
  const postUserId =
    normalizedPost.userId === 'invalid-user-id'
      ? `unknown-user-${normalizedPost.id}`
      : String(normalizedPost.userId);
  const postId = normalizedPost.id;

  const { data: userProfile } = useUserProfile({
    variables: { userId: postUserId },
    enabled:
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

  const avatarUrl = userProfile?.avatar_url ?? null;

  const isOwnPost =
    authStatus === 'signIn' &&
    currentUserId !== null &&
    postUserId === currentUserId;

  const deleteMutation = useDeletePost();
  const { animatedStyle, onPressIn, onPressOut } = useCardAnimation(postId);
  const { optionsSheetRef, handleDeleteConfirm } = useCardInteractions({
    postId,
    onDelete,
    deleteMutation,
  });
  const { handleSharePress } = usePostSharing(String(postId));

  const handlePressIn = React.useCallback(() => {
    onPressIn();
    onCardPressIn?.(postId);
  }, [onPressIn, onCardPressIn, postId]);

  const handleCommentPress = React.useCallback(
    () => router.push(`/feed/${postId}`),
    [router, postId]
  );

  const relativeTime = React.useMemo(
    () => formatRelativeTimeTranslated(post.created_at, 'common.time_ago'),
    [post.created_at]
  );

  return {
    postId,
    postUserId,
    displayUsername,
    avatarUrl,
    isOwnPost,
    animatedStyle,
    onPressOut,
    handlePressIn,
    handleCommentPress,
    handleSharePress,
    relativeTime,
    optionsSheetRef,
    handleDeleteConfirm,
    deleteMutation,
  };
}
