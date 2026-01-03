/**
 * PostCard component - Instagram-style clean design
 *
 * Visual-first card for community posts:
 * - Clean, minimal user row (avatar + username only)
 * - Large portrait image (4:5 or 1:1 aspect ratio)
 * - Simple action bar (heart, comment) with terracotta active color
 * - Caption with username prefix, truncated to 2 lines
 * - Optimized rendering with React.memo
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
import { haptics } from '@/lib/haptics';
import { translate } from '@/lib/i18n';

import { LikeButton } from './like-button';

const cardStyles = StyleSheet.create({
  image: {
    // 4:3 aspect ratio for Kitchen Stories style
    aspectRatio: 4 / 3,
    width: '100%' as const,
    borderRadius: 16,
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
      _postUserId={postUserId}
      displayUsername={displayUsername}
      isOwnPost={!!isOwnPost}
      onDelete={onDelete}
      testID={testID}
      handleAuthorPress={handleAuthorPress}
      handleCommentPress={handleCommentPress}
    />
  );
}

// Post card view component - visual-first design matching strain cards
// eslint-disable-next-line max-lines-per-function -- JSX-heavy component (150 limit per project rules)
function PostCardView({
  post,
  postId,
  _postUserId,
  displayUsername,
  isOwnPost,
  onDelete,
  testID,
  handleAuthorPress,
  handleCommentPress,
}: {
  post: ApiPost;
  postId: number | string;
  _postUserId: string;
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

  return (
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
          <View className="mx-4 mb-8">
            {/* Hero Image - Kitchen Stories style with 4:3 aspect ratio */}
            {hasImage && (
              <View className="relative">
                <OptimizedImage
                  className="w-full rounded-2xl"
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

                {/* Overlay 1 (Top Left): Dummy badge */}
                <View className="absolute left-3 top-3 rounded-md bg-neutral-100/90 px-2 py-1 dark:bg-charcoal-800/90">
                  <Text className="text-[10px] font-bold uppercase text-neutral-700 dark:text-neutral-200">
                    Sativa
                  </Text>
                </View>

                {/* Overlay 2 (Bottom Right): Heart/Like button */}
                <View className="absolute bottom-3 right-3">
                  <LikeButton
                    postId={String(postId)}
                    likeCount={post.like_count ?? 0}
                    userHasLiked={post.user_has_liked ?? false}
                    testID={`${testID}-like-button`}
                    variant="overlay"
                  />
                </View>
              </View>
            )}

            {/* Content Section - Kitchen Stories: title then author row */}
            <View className="mt-3">
              {/* Title */}
              {post.body && (
                <Text
                  numberOfLines={2}
                  className="text-lg font-bold leading-tight text-neutral-900 dark:text-neutral-50"
                  testID={`${testID}-body`}
                >
                  {post.body}
                </Text>
              )}

              {/* Author Row - avatar + name below title */}
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
                className="mt-2 flex-row items-center gap-2"
              >
                <View className="size-6 items-center justify-center rounded-full bg-terracotta-100 dark:bg-terracotta-900">
                  <Text className="text-[10px] font-bold text-terracotta-600 dark:text-terracotta-300">
                    {displayUsername.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text className="text-xs font-medium text-terracotta-500">
                  {displayUsername}
                </Text>
              </Pressable>

              {/* Action Bar - comment + more options */}
              <PostCardActions
                post={post}
                postId={postId}
                isOwnPost={isOwnPost}
                onDelete={onDelete}
                testID={testID}
                handleCommentPress={handleCommentPress}
                showLikeButton={false}
              />
            </View>
          </View>
        </Pressable>
      </Link>
    </Animated.View>
  );
}

// Clean action bar with heart and comment icons
function PostCardActions({
  post,
  postId,
  isOwnPost,
  onDelete,
  testID,
  handleCommentPress,
  showLikeButton = true,
}: {
  post: ApiPost;
  postId: number | string;
  isOwnPost: boolean;
  onDelete?: (postId: number | string, undoExpiresAt: string) => void;
  testID: string;
  handleCommentPress: (e: {
    stopPropagation: () => void;
    preventDefault: () => void;
  }) => void;
  showLikeButton?: boolean;
}) {
  const deleteMutation = useDeletePost();

  const handleDeletePress = React.useCallback(
    async (e: { stopPropagation: () => void; preventDefault: () => void }) => {
      e.stopPropagation();
      e.preventDefault();
      haptics.medium();
      try {
        const result = await deleteMutation.mutateAsync({
          postId: String(postId),
        });
        onDelete?.(postId, result.undo_expires_at);
      } catch (error) {
        console.error('Delete post failed:', error);
      }
    },
    [deleteMutation, postId, onDelete]
  );

  return (
    <View
      className="flex-row items-center justify-between"
      testID={`${testID}-actions`}
    >
      <View className="flex-row items-center gap-4">
        {/* Like Button - only show if not in overlay */}
        {showLikeButton && (
          <Pressable
            accessibilityRole="button"
            onPress={(e: { stopPropagation: () => void }) =>
              e.stopPropagation()
            }
          >
            <LikeButton
              postId={String(postId)}
              likeCount={post.like_count ?? 0}
              userHasLiked={post.user_has_liked ?? false}
              testID={`${testID}-like-button`}
            />
          </Pressable>
        )}

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
          <MessageCircle size={22} color={colors.neutral[400]} />
          {(post.comment_count ?? 0) > 0 && (
            <Text
              className="text-sm text-neutral-500 dark:text-neutral-400"
              testID={`${testID}-comment-count`}
            >
              {post.comment_count}
            </Text>
          )}
        </Pressable>
      </View>

      {/* More options button for own posts */}
      {isOwnPost && (
        <Pressable
          onPress={handleDeletePress}
          disabled={deleteMutation.isPending}
          accessibilityRole="button"
          accessibilityLabel={translate('accessibility.community.post_options')}
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
      prevProps.onDelete === nextProps.onDelete &&
      prevProps.testID === nextProps.testID
    );
  }
);
