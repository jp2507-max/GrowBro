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

import { Link, useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import React from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { useDeletePost, useUserProfile } from '@/api/community';
import type { Post as ApiPost } from '@/api/posts';
import { OptimizedImage, Pressable, Text, View } from '@/components/ui';
import colors from '@/components/ui/colors';
import { MessageCircle, MoreHorizontal } from '@/components/ui/icons';
import { getOptionalAuthenticatedUserId } from '@/lib/auth/user-utils';
import { normalizePostUserId } from '@/lib/community/post-utils';
import { formatRelativeTimeTranslated } from '@/lib/datetime/format-relative-time';
import { showErrorMessage } from '@/lib/flash-message';
import { haptics } from '@/lib/haptics';
import { translate, type TxKeyPath } from '@/lib/i18n';

import { LikeButton } from './like-button';
import {
  PostOptionsSheet,
  type PostOptionsSheetRef,
} from './post-options-sheet';

const cardStyles = StyleSheet.create({
  image: {
    // 4:3 aspect ratio for clean visual-first design
    aspectRatio: 4 / 3,
    width: '100%' as const,
  },
  shadow: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
});

type PostCardProps = {
  post: ApiPost;
  onDelete?: (postId: number | string, undoExpiresAt: string) => void;
  testID?: string;
};

function PostCardComponent({
  post,
  onDelete,
  testID = 'post-card',
}: PostCardProps): React.ReactElement {
  const router = useRouter();
  const [currentUserId, setCurrentUserId] = React.useState<
    string | null | undefined
  >(undefined);

  React.useEffect(() => {
    getOptionalAuthenticatedUserId().then(setCurrentUserId);
  }, []);

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
      !!postUserId &&
      postUserId !== 'invalid-user-id' &&
      !postUserId.startsWith('unknown-'),
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  const displayUsername =
    userProfile?.username ||
    (postUserId.startsWith('unknown-')
      ? translate('accessibility.community.unknown_user')
      : postUserId.slice(0, 8));

  const isOwnPost =
    currentUserId !== undefined &&
    currentUserId !== null &&
    postUserId === currentUserId;

  const handleCommentPress = React.useCallback(
    (e: { stopPropagation: () => void; preventDefault: () => void }) => {
      e.stopPropagation();
      e.preventDefault();
      router.push(`/feed/${postId}`);
    },
    [router, postId]
  );

  const handleAuthorPress = React.useCallback(
    (e: { stopPropagation: () => void; preventDefault: () => void }) => {
      e.stopPropagation();
      e.preventDefault();
      router.push(`/community/${postUserId}`);
    },
    [router, postUserId]
  );

  return (
    <PostCardView
      post={post}
      postId={postId}
      displayUsername={displayUsername}
      isOwnPost={!!isOwnPost}
      onDelete={onDelete}
      testID={testID}
      handleAuthorPress={handleAuthorPress}
      handleCommentPress={handleCommentPress}
    />
  );
}

// Sub-components to keep PostCardView clean and within line limits

type PressEvent = {
  stopPropagation: () => void;
  preventDefault: () => void;
};

type PostHeaderProps = {
  displayUsername: string;
  relativeTime: string | null;
  onAuthorPress: (e: PressEvent) => void;
  isOwnPost: boolean;
  onOptionsPress: (e: PressEvent) => void;
  deletePending: boolean;
  moreIconColor: string;
  testID: string;
};

// Row 1: Header - Avatar + Name + Time + More
function PostHeader({
  displayUsername,
  relativeTime,
  onAuthorPress,
  isOwnPost,
  onOptionsPress,
  deletePending,
  moreIconColor,
  testID,
}: PostHeaderProps) {
  return (
    <View className="flex-row items-center justify-between p-4">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={translate(
          'accessibility.community.view_author_profile',
          { author: displayUsername }
        )}
        accessibilityHint={translate(
          'accessibility.community.view_author_profile_hint'
        )}
        onPress={onAuthorPress}
        className="flex-row items-center gap-3"
      >
        {/* Avatar */}
        <View className="size-10 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900">
          <Text className="text-sm font-bold text-primary-600 dark:text-primary-300">
            {displayUsername.charAt(0).toUpperCase()}
          </Text>
        </View>
        {/* Name + Time */}
        <View>
          <Text className="text-sm font-bold text-neutral-900 dark:text-neutral-50">
            {displayUsername}
          </Text>
          {relativeTime && (
            <Text className="text-xs text-neutral-400 dark:text-neutral-500">
              {relativeTime}
            </Text>
          )}
        </View>
      </Pressable>

      {/* More Options */}
      {isOwnPost && (
        <Pressable
          onPress={onOptionsPress}
          disabled={deletePending}
          accessibilityRole="button"
          accessibilityLabel={translate('accessibility.community.post_options')}
          accessibilityHint={translate(
            'accessibility.community.post_options_hint'
          )}
          accessibilityState={{ disabled: deletePending }}
          className="p-2"
          testID={`${testID}-more-button`}
        >
          <MoreHorizontal size={20} color={moreIconColor} />
        </Pressable>
      )}
    </View>
  );
}

type PostActionBarProps = {
  postId: string;
  likeCount: number;
  userHasLiked: boolean;
  commentCount: number;
  onCommentPress: (e: PressEvent) => void;
  iconColor: string;
  testID: string;
};

// Row 3: Action Bar
function PostActionBar({
  postId,
  likeCount,
  userHasLiked,
  commentCount,
  onCommentPress,
  iconColor,
  testID,
}: PostActionBarProps) {
  return (
    <View className="flex-row items-center gap-6 px-4 py-3">
      {/* Like Button */}
      <LikeButton
        postId={postId}
        likeCount={likeCount}
        userHasLiked={userHasLiked}
        testID={`${testID}-like-button`}
      />

      {/* Comment Button */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={translate('accessibility.community.view_comments', {
          count: commentCount,
        })}
        accessibilityHint={translate(
          'accessibility.community.view_comments_hint'
        )}
        onPress={onCommentPress}
        className="flex-row items-center gap-1.5"
      >
        <MessageCircle size={26} color={iconColor} />
        {commentCount > 0 && (
          <Text
            className="text-sm text-neutral-600 dark:text-neutral-400"
            testID={`${testID}-comment-count`}
          >
            {commentCount}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

type PostContentProps = {
  body?: string | null;
  testID: string;
};

// Row 4: Content - Caption limited to 3 lines
function PostContent({ body, testID }: PostContentProps) {
  if (!body) return null;
  return (
    <View className="px-4 pb-5">
      <Text
        numberOfLines={3}
        className="text-sm leading-relaxed text-neutral-800 dark:text-neutral-200"
        testID={`${testID}-body`}
      >
        {body}
      </Text>
    </View>
  );
}

type PostHeroImageProps = {
  mediaUri: string;
  thumbnailUri?: string | null;
  resizedUri?: string | null;
  blurhash?: string | null;
  thumbhash?: string | null;
  displayUsername: string;
  testID: string;
};

// Row 2: Hero Image - No text overlays
function PostHeroImage({
  mediaUri,
  thumbnailUri,
  resizedUri,
  blurhash,
  thumbhash,
  displayUsername,
  testID,
}: PostHeroImageProps) {
  return (
    <OptimizedImage
      className="w-full"
      style={cardStyles.image}
      uri={mediaUri}
      thumbnailUri={thumbnailUri}
      resizedUri={resizedUri}
      blurhash={blurhash}
      thumbhash={thumbhash}
      recyclingKey={thumbnailUri || mediaUri}
      accessibilityIgnoresInvertColors
      accessibilityLabel={translate('accessibility.community.post_image', {
        author: displayUsername,
      })}
      accessibilityHint={translate('accessibility.community.post_image_hint')}
      testID={`${testID}-image`}
    />
  );
}

// Custom hook for card animation
function useCardAnimation() {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const onPressIn = React.useCallback(() => {
    scale.value = withSpring(0.98, {
      damping: 15,
      stiffness: 350,
      reduceMotion: ReduceMotion.System,
    });
    haptics.selection();
  }, [scale]);

  const onPressOut = React.useCallback(() => {
    scale.value = withSpring(1, {
      damping: 15,
      stiffness: 350,
      reduceMotion: ReduceMotion.System,
    });
  }, [scale]);

  return { animatedStyle, onPressIn, onPressOut };
}

// Custom hook for card interactions (delete, options)
function useCardInteractions({
  postId,
  onDelete,
  deleteMutation,
}: {
  postId: number | string;
  onDelete?: (postId: number | string, undoExpiresAt: string) => void;
  deleteMutation: ReturnType<typeof useDeletePost>;
}) {
  const optionsSheetRef = React.useRef<PostOptionsSheetRef>(null);

  const handleOptionsPress = React.useCallback(
    (e: { stopPropagation: () => void; preventDefault: () => void }) => {
      e.stopPropagation();
      e.preventDefault();
      haptics.selection();
      optionsSheetRef.current?.present();
    },
    []
  );

  const handleDeleteConfirm = React.useCallback(async () => {
    optionsSheetRef.current?.dismiss();
    haptics.medium();
    try {
      const result = await deleteMutation.mutateAsync({
        postId: String(postId),
      });
      onDelete?.(postId, result.undo_expires_at);
    } catch (error) {
      console.error('Delete post failed:', error);
      showErrorMessage(translate('community.delete_post_failed' as TxKeyPath));
      haptics.error();
    }
  }, [deleteMutation, postId, onDelete]);

  return {
    optionsSheetRef,
    handleOptionsPress,
    handleDeleteConfirm,
  };
}

type PostCardViewProps = {
  post: ApiPost;
  postId: number | string;
  displayUsername: string;
  isOwnPost: boolean;
  onDelete?: (postId: number | string, undoExpiresAt: string) => void;
  testID: string;
  handleAuthorPress: (e: PressEvent) => void;
  handleCommentPress: (e: PressEvent) => void;
};

// Post card view component - Instagram Pro layout
function PostCardView({
  post,
  postId,
  displayUsername,
  isOwnPost,
  onDelete,
  testID,
  handleAuthorPress,
  handleCommentPress,
}: PostCardViewProps): React.ReactElement {
  const { colorScheme } = useColorScheme();
  const deleteMutation = useDeletePost();
  const { animatedStyle, onPressIn, onPressOut } = useCardAnimation();
  const { optionsSheetRef, handleOptionsPress, handleDeleteConfirm } =
    useCardInteractions({ postId, onDelete, deleteMutation });

  const iconColor =
    colorScheme === 'dark' ? colors.neutral[400] : colors.neutral[600];
  const moreIconColor =
    colorScheme === 'dark' ? colors.neutral[500] : colors.neutral[400];
  const hasImage = Boolean(post.media_uri);
  const relativeTime = formatRelativeTimeTranslated(
    post.created_at,
    'common.timeAgo'
  );

  return (
    <>
      <Animated.View style={animatedStyle}>
        <Link href={`/feed/${postId}`} asChild>
          <Pressable
            accessibilityHint={translate(
              'accessibility.community.open_post_hint'
            )}
            accessibilityLabel={
              post.body?.slice(0, 100) ||
              translate('accessibility.community.post_fallback' as TxKeyPath)
            }
            accessibilityRole="link"
            testID={testID}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
          >
            <View
              className="mx-5 mb-6 overflow-hidden rounded-3xl border border-neutral-200 bg-white dark:border-white/10 dark:bg-charcoal-900"
              style={cardStyles.shadow}
            >
              <PostHeader
                displayUsername={displayUsername}
                relativeTime={relativeTime}
                onAuthorPress={handleAuthorPress}
                isOwnPost={isOwnPost}
                onOptionsPress={handleOptionsPress}
                deletePending={deleteMutation.isPending}
                moreIconColor={moreIconColor}
                testID={testID}
              />
              {hasImage && (
                <PostHeroImage
                  mediaUri={post.media_uri!}
                  thumbnailUri={post.media_thumbnail_uri}
                  resizedUri={post.media_resized_uri}
                  blurhash={post.media_blurhash}
                  thumbhash={post.media_thumbhash}
                  displayUsername={displayUsername}
                  testID={testID}
                />
              )}
              <PostActionBar
                postId={String(postId)}
                likeCount={post.like_count ?? 0}
                userHasLiked={post.user_has_liked ?? false}
                commentCount={post.comment_count ?? 0}
                onCommentPress={handleCommentPress}
                iconColor={iconColor}
                testID={testID}
              />
              <PostContent body={post.body} testID={testID} />
            </View>
          </Pressable>
        </Link>
      </Animated.View>
      {isOwnPost && (
        <PostOptionsSheet
          ref={optionsSheetRef}
          onDelete={handleDeleteConfirm}
          isDeleting={deleteMutation.isPending}
        />
      )}
    </>
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
      prevProps.testID === nextProps.testID
    );
  }
);
