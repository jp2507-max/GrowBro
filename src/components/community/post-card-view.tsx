/**
 * PostCardView - Main view component for PostCard
 * Instagram Pro layout: Header → Image → ActionBar → Content
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
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
});

export type PostCardViewProps = {
  post: ApiPost;
  postId: number | string;
  displayUsername: string;
  isOwnPost: boolean;
  onDelete?: (postId: number | string, undoExpiresAt: string) => void;
  testID: string;
  handleAuthorPress: (e: PressEvent) => void;
  handleCommentPress: (e: PressEvent) => void;
};

export function PostCardView({
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
              {hasImage && (
                <PostCardHeroImage
                  postId={String(postId)}
                  mediaUri={post.media_uri!}
                  thumbnailUri={post.media_thumbnail_uri}
                  resizedUri={post.media_resized_uri}
                  blurhash={post.media_blurhash}
                  thumbhash={post.media_thumbhash}
                  displayUsername={displayUsername}
                  testID={testID}
                />
              )}
              <PostCardActionBar
                postId={String(postId)}
                likeCount={post.like_count ?? 0}
                userHasLiked={post.user_has_liked ?? false}
                commentCount={post.comment_count ?? 0}
                onCommentPress={handleCommentPress}
                iconColor={iconColor}
                testID={testID}
              />
              <PostCardContent body={post.body} testID={testID} />
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
