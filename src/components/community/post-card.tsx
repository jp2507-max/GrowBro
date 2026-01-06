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
import React from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { useDeletePost } from '@/api/community';
import type { Post as ApiPost } from '@/api/posts';
import { OptimizedImage, Pressable, Text, View } from '@/components/ui';
import colors from '@/components/ui/colors';
import { MessageCircle, MoreHorizontal } from '@/components/ui/icons';
import { getOptionalAuthenticatedUserId } from '@/lib/auth/user-utils';
import { normalizePostUserId } from '@/lib/community/post-utils';
import { formatRelativeTimeTranslated } from '@/lib/datetime/format-relative-time';
import { haptics } from '@/lib/haptics';
import { translate } from '@/lib/i18n';

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
    shadowColor: '#000',
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
  const displayUsername = postUserId.slice(0, 8);

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

// Post card view component - Instagram Pro layout
// eslint-disable-next-line max-lines-per-function -- JSX-heavy component (150 limit per project rules)
function PostCardView({
  post,
  postId,
  displayUsername,
  isOwnPost,
  onDelete,
  testID,
  handleAuthorPress,
  handleCommentPress,
}: {
  post: ApiPost;
  postId: number | string;
  displayUsername: string;
  isOwnPost: boolean;
  onDelete?: (postId: number | string, undoExpiresAt: string) => void;
  testID: string;
  handleAuthorPress: (e: {
    stopPropagation: () => void;
    preventDefault: () => void;
  }) => void;
  handleCommentPress: (e: {
    stopPropagation: () => void;
    preventDefault: () => void;
  }) => void;
}): React.ReactElement {
  const scale = useSharedValue(1);
  const deleteMutation = useDeletePost();
  const optionsSheetRef = React.useRef<PostOptionsSheetRef>(null);

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

  const hasImage = Boolean(post.media_uri);
  const relativeTime = formatRelativeTimeTranslated(post.created_at);

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
    }
  }, [deleteMutation, postId, onDelete]);

  return (
    <>
      <Animated.View style={animatedStyle}>
        <Link href={`/feed/${postId}`} asChild>
          <Pressable
            accessibilityHint={translate(
              'accessibility.community.open_post_hint'
            )}
            accessibilityLabel={post.body?.slice(0, 100) || 'Community post'}
            accessibilityRole="link"
            testID={testID}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
          >
            {/* Card Container */}
            <View
              className="mx-5 mb-6 overflow-hidden rounded-3xl border border-neutral-100 bg-white dark:border-white/5 dark:bg-charcoal-900"
              style={cardStyles.shadow}
            >
              {/* Row 1: Header - Avatar + Name + Time + More */}
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
                  onPress={handleAuthorPress}
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
                      <Text className="text-xs text-neutral-400">
                        {relativeTime}
                      </Text>
                    )}
                  </View>
                </Pressable>

                {/* More Options */}
                {isOwnPost && (
                  <Pressable
                    onPress={handleOptionsPress}
                    disabled={deleteMutation.isPending}
                    accessibilityRole="button"
                    accessibilityLabel={translate(
                      'accessibility.community.post_options'
                    )}
                    accessibilityHint={translate(
                      'accessibility.community.post_options_hint'
                    )}
                    accessibilityState={{ disabled: deleteMutation.isPending }}
                    className="p-2"
                    testID={`${testID}-more-button`}
                  >
                    <MoreHorizontal size={20} color={colors.neutral[400]} />
                  </Pressable>
                )}
              </View>

              {/* Row 2: Hero Image - No text overlays */}
              {hasImage && (
                <OptimizedImage
                  className="w-full"
                  style={cardStyles.image}
                  uri={post.media_uri!}
                  thumbnailUri={post.media_thumbnail_uri}
                  resizedUri={post.media_resized_uri}
                  blurhash={post.media_blurhash}
                  thumbhash={post.media_thumbhash}
                  recyclingKey={post.media_thumbnail_uri || post.media_uri}
                  accessibilityIgnoresInvertColors
                  accessibilityLabel={translate(
                    'accessibility.community.post_image',
                    { author: displayUsername }
                  )}
                  accessibilityHint={translate(
                    'accessibility.community.post_image_hint'
                  )}
                  testID={`${testID}-image`}
                />
              )}

              {/* Row 3: Action Bar */}
              <View className="flex-row items-center gap-6 px-4 py-3">
                {/* Like Button */}
                <LikeButton
                  postId={String(postId)}
                  likeCount={post.like_count ?? 0}
                  userHasLiked={post.user_has_liked ?? false}
                  testID={`${testID}-like-button`}
                />

                {/* Comment Button */}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={translate(
                    'accessibility.community.view_comments',
                    { count: post.comment_count ?? 0 }
                  )}
                  accessibilityHint={translate(
                    'accessibility.community.view_comments_hint'
                  )}
                  onPress={handleCommentPress}
                  className="flex-row items-center gap-1.5"
                >
                  <MessageCircle size={22} color={colors.neutral[600]} />
                  {(post.comment_count ?? 0) > 0 && (
                    <Text
                      className="text-sm text-neutral-600 dark:text-neutral-400"
                      testID={`${testID}-comment-count`}
                    >
                      {post.comment_count}
                    </Text>
                  )}
                </Pressable>
              </View>

              {/* Row 4: Content - Caption limited to 3 lines */}
              {post.body && (
                <View className="px-4 pb-5">
                  <Text
                    numberOfLines={3}
                    className="text-sm leading-relaxed text-neutral-800 dark:text-neutral-200"
                    testID={`${testID}-body`}
                  >
                    {post.body}
                  </Text>
                </View>
              )}
            </View>
          </Pressable>
        </Link>
      </Animated.View>

      {/* Post Options Sheet */}
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
      prevProps.onDelete === nextProps.onDelete &&
      prevProps.testID === nextProps.testID
    );
  }
);
