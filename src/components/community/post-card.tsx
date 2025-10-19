/**
 * PostCard component
 *
 * Card for displaying community posts in feed with:
 * - Like button with optimistic updates
 * - Comment count with navigation to thread
 * - Author profile linking
 * - Delete button for own posts with undo
 * - Media thumbnail support
 * - Optimized rendering with React.memo
 * - Image lazy loading and caching
 * - Enhanced accessibility
 */

import { Link, useRouter } from 'expo-router';
import React from 'react';

import { useDeletePost } from '@/api/community';
import type { Post as ApiPost } from '@/api/posts';
import { Image, Pressable, Text, View } from '@/components/ui';
import { getOptionalAuthenticatedUserId } from '@/lib/auth/user-utils';
import { normalizePostUserId } from '@/lib/community/post-utils';
import { translate } from '@/lib/i18n';

import { LikeButton } from './like-button';

interface PostCardProps {
  post: ApiPost;
  onDelete?: (postId: number | string, undoExpiresAt: string) => void;
  testID?: string;
}

function PostCardComponent({
  post,
  onDelete,
  testID = 'post-card',
}: PostCardProps): React.ReactElement {
  const router = useRouter();
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);

  React.useEffect(() => {
    getOptionalAuthenticatedUserId().then(setCurrentUserId);
  }, []);

  const normalizedPost = React.useMemo(() => normalizePostUserId(post), [post]);
  const postUserId = String(normalizedPost.userId || '');
  const postId = normalizedPost.id;
  const isOwnPost = currentUserId && postUserId === currentUserId;

  const handleCommentPress = React.useCallback(
    (e: any) => {
      e.stopPropagation();
      e.preventDefault();
      router.push(`/feed/${postId}`);
    },
    [router, postId]
  );

  const compositeLabel = React.useMemo(() => {
    const badgeText = translate('cannabis.educational_badge');
    const previewText = post.body?.slice(0, 100) || '';
    return `${badgeText}. ${previewText}`;
  }, [post.body]);

  const handleAuthorPress = React.useCallback(
    (e: any) => {
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
      postUserId={postUserId}
      isOwnPost={!!isOwnPost}
      compositeLabel={compositeLabel}
      onDelete={onDelete}
      testID={testID}
      handleAuthorPress={handleAuthorPress}
      handleCommentPress={handleCommentPress}
    />
  );
}

// Post card view component to satisfy max-lines-per-function
function PostCardView({
  post,
  postId,
  postUserId,
  isOwnPost,
  compositeLabel,
  onDelete,
  testID,
  handleAuthorPress,
  handleCommentPress,
}: {
  post: ApiPost;
  postId: number | string;
  postUserId: string;
  isOwnPost: boolean;
  compositeLabel: string;
  onDelete?: (postId: number | string, undoExpiresAt: string) => void;
  testID: string;
  handleAuthorPress: (e: any) => void;
  handleCommentPress: (e: any) => void;
}) {
  return (
    <Link href={`/feed/${postId}`} asChild>
      <Pressable
        accessibilityHint={translate('accessibility.community.open_post_hint')}
        accessibilityLabel={compositeLabel}
        accessibilityRole="link"
        testID={testID}
      >
        <View className="m-2 overflow-hidden rounded-xl border border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-900">
          {post.media_uri && (
            <Image
              className="h-56 w-full overflow-hidden rounded-t-xl"
              contentFit="cover"
              source={{ uri: post.media_uri }}
              cachePolicy="memory-disk"
              priority="normal"
              transition={200}
              accessibilityIgnoresInvertColors
              accessibilityLabel={translate(
                'accessibility.community.post_image',
                { author: postUserId.slice(0, 8) }
              )}
              accessibilityHint={translate(
                'accessibility.community.post_image_hint'
              )}
              testID={`${testID}-image`}
            />
          )}
          <View className="p-4">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={translate(
                'accessibility.community.view_author_profile',
                { author: postUserId.slice(0, 8) }
              )}
              accessibilityHint={translate(
                'accessibility.community.view_author_profile_hint'
              )}
              onPress={handleAuthorPress}
              className="min-h-11 justify-center"
              testID={`${testID}-author`}
            >
              <Text className="mb-2 text-sm font-semibold text-primary-700 dark:text-primary-400">
                @{postUserId.slice(0, 8)}
              </Text>
            </Pressable>
            <Text className="w-fit rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
              {translate('cannabis.educational_badge')}
            </Text>
            <Text
              numberOfLines={5}
              className="mt-3 text-base leading-snug text-neutral-900 dark:text-neutral-100"
              testID={`${testID}-body`}
            >
              {post.body}
            </Text>
            <PostCardActions
              post={post}
              postId={postId}
              _postUserId={postUserId}
              isOwnPost={isOwnPost}
              onDelete={onDelete}
              testID={testID}
              handleCommentPress={handleCommentPress}
            />
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

// Small child component extracted to satisfy max-lines-per-function
// and to make the actions area easier to test in isolation.
function PostCardActions({
  post,
  postId,
  _postUserId,
  isOwnPost,
  onDelete,
  testID,
  handleCommentPress,
}: {
  post: ApiPost;
  postId: number | string;
  _postUserId: string;
  isOwnPost: boolean;
  onDelete?: (postId: number | string, undoExpiresAt: string) => void;
  testID: string;
  handleCommentPress: (e: any) => void;
}) {
  const deleteMutation = useDeletePost();

  const handleDeletePress = React.useCallback(
    async (e: any) => {
      e.stopPropagation();
      e.preventDefault();
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
      className="mt-4 flex-row items-center justify-between"
      testID={`${testID}-actions`}
    >
      <View className="flex-row items-center gap-3">
        <Pressable
          accessibilityRole="button"
          onPress={(e) => e.stopPropagation()}
        >
          <LikeButton
            postId={String(postId)}
            likeCount={post.like_count ?? 0}
            userHasLiked={post.user_has_liked ?? false}
            testID={`${testID}-like-button`}
          />
        </Pressable>

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
          className="min-h-11 min-w-11 justify-center"
        >
          <View className="flex-row items-center gap-1.5">
            <Text className="text-sm text-neutral-700 dark:text-neutral-300">
              💬
            </Text>
            <Text
              className="text-sm text-neutral-700 dark:text-neutral-300"
              testID={`${testID}-comment-count`}
            >
              {post.comment_count ?? 0}
            </Text>
          </View>
        </Pressable>
      </View>

      {isOwnPost && (
        <Pressable
          onPress={handleDeletePress}
          disabled={deleteMutation.isPending}
          accessibilityRole="button"
          accessibilityLabel={translate('accessibility.community.delete_post')}
          accessibilityHint={translate(
            'accessibility.community.delete_post_hint'
          )}
          accessibilityState={{ disabled: deleteMutation.isPending }}
          className="min-h-11 justify-center px-2"
          testID={`${testID}-delete-button`}
        >
          <Text
            className={`text-sm ${deleteMutation.isPending ? 'text-neutral-400 dark:text-neutral-600' : 'text-danger-600 dark:text-danger-400'}`}
          >
            {deleteMutation.isPending
              ? translate('common.loading')
              : `🗑️ ${translate('accessibility.community.delete')}`}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

// Memoize PostCard to prevent unnecessary re-renders
// Only re-render if post data, delete handler, or testID changes
export const PostCard = React.memo(
  PostCardComponent,
  (prevProps, nextProps) => {
    return (
      prevProps.post.id === nextProps.post.id &&
      prevProps.post.body === nextProps.post.body &&
      prevProps.post.media_uri === nextProps.post.media_uri &&
      prevProps.post.like_count === nextProps.post.like_count &&
      prevProps.post.comment_count === nextProps.post.comment_count &&
      prevProps.post.user_has_liked === nextProps.post.user_has_liked &&
      prevProps.onDelete === nextProps.onDelete &&
      prevProps.testID === nextProps.testID
    );
  }
);
