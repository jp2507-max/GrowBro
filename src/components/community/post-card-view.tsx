/**
 * PostCardView - Main view component for PostCard
 * Premium "Deep Garden" layout: Header → Image → ActionBar → Content
 */

import { Link } from 'expo-router';
import { useColorScheme } from 'nativewind';
import React from 'react';
import { StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';

import { useDeletePost } from '@/api/community';
import type { Post as ApiPost } from '@/api/posts';
import { Pressable, View } from '@/components/ui';
import colors from '@/components/ui/colors';
import { formatRelativeTimeTranslated } from '@/lib/datetime/format-relative-time';
import { translate, type TxKeyPath } from '@/lib/i18n';

import { PostCardActionBar } from './post-card-action-bar';
import { PostCardContent } from './post-card-content';
import { PostCardHeader } from './post-card-header';
import { PostCardHeroImage } from './post-card-hero-image';
import { PostOptionsSheet } from './post-options-sheet';
import type { PressEvent } from './types';
import { useCardAnimation } from './use-card-animation';
import { useCardInteractions } from './use-card-interactions';

const cardStyles = StyleSheet.create({
  shadow: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
});

export type PostCardViewProps = {
  post: ApiPost;
  postId: number | string;
  displayUsername: string;
  isOwnPost: boolean;
  onDelete?: (postId: number | string, undoExpiresAt: string) => void;
  enableSharedTransition?: boolean;
  onCardPressIn?: (postId: number | string) => void;
  testID: string;
  handleAuthorPress: (e: PressEvent) => void;
  handleCommentPress: (e: PressEvent) => void;
};

type PostCardBodyProps = {
  post: ApiPost;
  postId: number | string;
  displayUsername: string;
  allowSharedTransition: boolean;
  onCommentPress: (e: PressEvent) => void;
  iconColor: string;
  testID: string;
};

function PostCardBody({
  post,
  postId,
  displayUsername,
  allowSharedTransition,
  onCommentPress,
  iconColor,
  testID,
}: PostCardBodyProps): React.ReactElement {
  const hasImage = Boolean(post.media_uri);

  if (hasImage) {
    return (
      <View className="flex-row px-4 pb-4">
        <View className="mr-3">
          <PostCardHeroImage
            postId={String(postId)}
            mediaUri={post.media_uri!}
            thumbnailUri={post.media_thumbnail_uri}
            resizedUri={post.media_resized_uri}
            blurhash={post.media_blurhash}
            thumbhash={post.media_thumbhash}
            displayUsername={displayUsername}
            enableSharedTransition={allowSharedTransition}
            testID={testID}
          />
          <PostCardActionBar
            postId={String(postId)}
            likeCount={post.like_count ?? 0}
            userHasLiked={post.user_has_liked ?? false}
            commentCount={post.comment_count ?? 0}
            onCommentPress={onCommentPress}
            iconColor={iconColor}
            testID={testID}
          />
        </View>
        <View className="flex-1 justify-between">
          <PostCardContent body={post.body} testID={testID} />
        </View>
      </View>
    );
  }

  return (
    <View className="px-4 pb-4">
      <PostCardContent body={post.body} testID={testID} />
      <PostCardActionBar
        postId={String(postId)}
        likeCount={post.like_count ?? 0}
        userHasLiked={post.user_has_liked ?? false}
        commentCount={post.comment_count ?? 0}
        onCommentPress={onCommentPress}
        iconColor={iconColor}
        testID={testID}
      />
    </View>
  );
}

export function PostCardView({
  post,
  postId,
  displayUsername,
  isOwnPost,
  onDelete,
  enableSharedTransition,
  onCardPressIn,
  testID,
  handleAuthorPress,
  handleCommentPress,
}: PostCardViewProps): React.ReactElement {
  const { colorScheme } = useColorScheme();
  const deleteMutation = useDeletePost();
  const { animatedStyle, onPressIn, onPressOut } = useCardAnimation(postId);
  const { optionsSheetRef, handleOptionsPress, handleDeleteConfirm } =
    useCardInteractions({ postId, onDelete, deleteMutation });
  const allowSharedTransition = enableSharedTransition ?? true;

  const handlePressIn = React.useCallback(() => {
    onPressIn();
    onCardPressIn?.(postId);
  }, [onPressIn, onCardPressIn, postId]);

  const handlePressOut = React.useCallback(() => {
    onPressOut();
  }, [onPressOut]);

  const iconColor =
    colorScheme === 'dark' ? colors.neutral[400] : colors.neutral[600];
  const moreIconColor =
    colorScheme === 'dark' ? colors.neutral[500] : colors.neutral[400];
  const relativeTime = formatRelativeTimeTranslated(
    post.created_at,
    'common.time_ago'
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
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
          >
            <View className="mx-5 mb-6 rounded-3xl" style={cardStyles.shadow}>
              <View className="overflow-hidden rounded-3xl border border-neutral-200 bg-white dark:border-white/10 dark:bg-charcoal-900">
                <PostCardHeader
                  displayUsername={displayUsername}
                  relativeTime={relativeTime}
                  onAuthorPress={handleAuthorPress}
                  isOwnPost={isOwnPost}
                  onOptionsPress={handleOptionsPress}
                  deletePending={deleteMutation.isPending}
                  moreIconColor={moreIconColor}
                  testID={testID}
                />
                <PostCardBody
                  post={post}
                  postId={postId}
                  displayUsername={displayUsername}
                  allowSharedTransition={allowSharedTransition}
                  onCommentPress={handleCommentPress}
                  iconColor={iconColor}
                  testID={testID}
                />
              </View>
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
