/**
 * PostDetailContent - Content sheet with post details and comments
 */

import * as React from 'react';
import type { StyleProp, TextInput, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

import { CommentInputFooter } from '@/components/community/comment-input-footer';
import { PostActionBar } from '@/components/community/post-action-bar';
import { PostDetailCommentSection } from '@/components/community/post-detail-comment-section';
import { PostDetailHeroImage } from '@/components/community/post-detail-hero-image';
import { PostHeader } from '@/components/community/post-header';
import { Text, View } from '@/components/ui';
import colors from '@/components/ui/colors';
import type { Post, PostComment } from '@/types/community';

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: 128 },
  contentSheet: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
});

type PostDetailContentProps = {
  post: Post;
  displayUsername: string;
  relativeTime: string;
  isDark: boolean;
  hasImage: boolean;
  commentBody: string;
  setCommentBody: (value: string) => void;
  onCommentSubmit: () => void;
  isSubmitting: boolean;
  comments: PostComment[];
  isLoadingComments: boolean;
  highlightedCommentId: string | undefined;
  bottomInset: number;
  commentInputRef: React.RefObject<TextInput | null>;
  scrollViewRef: React.RefObject<ScrollView | null>;
  onAuthorPress: () => void;
  onStrainPress: () => void;
  onSharePress: () => void;
};

export function PostDetailContent({
  post,
  displayUsername,
  relativeTime,
  isDark,
  hasImage,
  commentBody,
  setCommentBody,
  onCommentSubmit,
  isSubmitting,
  comments,
  isLoadingComments,
  highlightedCommentId,
  bottomInset,
  commentInputRef,
  scrollViewRef,
  onAuthorPress,
  onStrainPress,
  onSharePress,
}: PostDetailContentProps): React.ReactElement {
  return (
    <View
      className="z-10 -mt-10 flex-1 overflow-hidden rounded-t-[32px] bg-white shadow-2xl dark:bg-charcoal-900"
      style={styles.contentSheet as StyleProp<ViewStyle>}
    >
      <ScrollView
        ref={scrollViewRef}
        className="flex-1"
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-5 pt-6">
          <PostHeader
            displayUsername={displayUsername}
            relativeTime={relativeTime}
            strain={post.strain}
            isDark={isDark}
            onAuthorPress={onAuthorPress}
            onStrainPress={onStrainPress}
          />

          {hasImage && (
            <PostDetailHeroImage
              postId={String(post.id)}
              mediaUri={post.media_uri!}
              thumbnailUri={post.media_thumbnail_uri}
              resizedUri={post.media_resized_uri}
              blurhash={post.media_blurhash}
              thumbhash={post.media_thumbhash}
              displayUsername={displayUsername}
            />
          )}

          <PostActionBar
            postId={String(post.id)}
            likeCount={post.like_count ?? 0}
            commentCount={post.comment_count ?? 0}
            userHasLiked={post.user_has_liked ?? false}
            isDark={isDark}
            onSharePress={onSharePress}
          />

          {post.body && (
            <Text className="mb-4 text-base leading-relaxed text-neutral-800 dark:text-neutral-200">
              {post.body}
            </Text>
          )}

          <View className="my-6 h-px w-full bg-neutral-200/80 dark:bg-white/10" />

          <PostDetailCommentSection
            comments={comments}
            isLoading={isLoadingComments}
            highlightedCommentId={highlightedCommentId}
          />
        </View>
      </ScrollView>

      <CommentInputFooter
        value={commentBody}
        onChangeText={setCommentBody}
        onSubmit={onCommentSubmit}
        isPending={isSubmitting}
        bottomInset={bottomInset}
        inputRef={commentInputRef}
      />
    </View>
  );
}
