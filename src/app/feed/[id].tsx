/**
 * Post Detail Screen - "Article View" layout
 *
 * Clean page layout architecture:
 * - Green header (h-[140px]) with title "Beitrag"
 * - Content sheet overlapping header (-mt-6, rounded-t-[35px])
 * - NO card wrapper - content lives directly in the sheet
 * - Compact strain pill instead of large strain card
 * - Hero image with stats and caption
 * - Comments section with sticky input footer
 */

import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import * as React from 'react';
import { Platform, StyleSheet } from 'react-native';
import type { ScrollView } from 'react-native-gesture-handler';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePost } from '@/api/community';
import { PostDetailContent } from '@/components/community/post-detail-content';
import { PostDetailErrorState } from '@/components/community/post-detail-error-state';
import { PostDetailHeader } from '@/components/community/post-detail-header';
import { PostDetailLoadingState } from '@/components/community/post-detail-loading-state';
import { usePostDetailState } from '@/components/community/use-post-detail-state';
import { usePostSharing } from '@/components/community/use-post-sharing';
import { FocusAwareStatusBar, View } from '@/components/ui';
import { normalizePostUserId } from '@/lib/community/post-utils';
import {
  createOutboxAdapter,
  useCommunityFeedRealtime,
} from '@/lib/community/use-community-feed-realtime';
import { formatRelativeTimeTranslated } from '@/lib/datetime/format-relative-time';
import { haptics } from '@/lib/haptics';
import { getHeaderColors } from '@/lib/theme-utils';
import { database } from '@/lib/watermelon';
import type { Post } from '@/types/community';

const styles = StyleSheet.create({
  flex1: { flex: 1 },
});

export default function PostDetailScreen(): React.ReactElement {
  const local = useLocalSearchParams<{ id: string; commentId?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const headerColors = getHeaderColors(isDark);

  const scrollViewRef = React.useRef<ScrollView>(null);
  const outboxAdapter = React.useMemo(() => createOutboxAdapter(database), []);
  useCommunityFeedRealtime({ outboxAdapter, postId: local.id });

  const {
    data: post,
    isPending,
    isError,
  } = usePost({
    variables: { postId: local.id },
  });

  const { handleSharePress } = usePostSharing(local.id);

  const {
    commentBody,
    setCommentBody,
    commentInputRef,
    handleCommentSubmit,
    isSubmitting,
    comments,
    isLoadingComments,
    highlightedCommentId,
  } = usePostDetailState({
    postId: local.id,
    commentId: local.commentId,
  });

  const handleAuthorPress = React.useCallback(() => {
    if (!post) return;
    const normalizedPost = normalizePostUserId(post);
    const userId =
      normalizedPost.userId === 'invalid-user-id'
        ? `unknown-user-${normalizedPost.id}`
        : String(normalizedPost.userId);
    router.push(`/community/${userId}`);
  }, [post, router]);

  const handleStrainPress = React.useCallback(() => {
    haptics.selection();
    if (!post?.strain) return;
    const slug = post.strain
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w-]+/g, '')
      .replace(/--+/g, '-')
      .replace(/^-+|-+$/g, '');
    router.push(`/strains/${slug}`);
  }, [post?.strain, router]);

  if (isPending) return <PostDetailLoadingState />;
  if (isError || !post) return <PostDetailErrorState />;

  const normalizedPost = normalizePostUserId(post);
  const postUserId =
    normalizedPost.userId === 'invalid-user-id'
      ? `unknown-user-${normalizedPost.id}`
      : String(normalizedPost.userId);
  const displayUsername = postUserId.slice(0, 8);
  const relativeTime = formatRelativeTimeTranslated(
    post.created_at,
    'common.time_ago'
  );
  const hasImage = Boolean(post.media_uri);

  // Convert Post from API type to component type
  const postForComponent = {
    ...normalizedPost,
    id: String(normalizedPost.id),
    userId: String(normalizedPost.userId),
  } as Post;

  return (
    <View className="flex-1 bg-neutral-50 dark:bg-charcoal-950">
      <Stack.Screen options={{ headerShown: false }} />
      <FocusAwareStatusBar />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex1}
        keyboardVerticalOffset={0}
      >
        <PostDetailHeader
          onBack={() => router.back()}
          topInset={insets.top}
          headerColors={headerColors}
        />

        <PostDetailContent
          post={postForComponent}
          displayUsername={displayUsername}
          relativeTime={relativeTime}
          isDark={isDark}
          hasImage={hasImage}
          commentBody={commentBody}
          setCommentBody={setCommentBody}
          onCommentSubmit={handleCommentSubmit}
          isSubmitting={isSubmitting}
          comments={comments}
          isLoadingComments={isLoadingComments}
          highlightedCommentId={highlightedCommentId}
          bottomInset={insets.bottom}
          commentInputRef={commentInputRef}
          scrollViewRef={scrollViewRef}
          onAuthorPress={handleAuthorPress}
          onStrainPress={handleStrainPress}
          onSharePress={handleSharePress}
        />
      </KeyboardAvoidingView>
    </View>
  );
}
