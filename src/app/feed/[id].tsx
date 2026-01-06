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

import { useQueryClient } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import * as React from 'react';
import {
  Platform,
  Share as NativeShare,
  StyleSheet,
  type TextInput,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useComments, useCreateComment, usePost } from '@/api/community';
import { CommentInputFooter } from '@/components/community/comment-input-footer';
import { CommentList } from '@/components/community/comment-list';
import { PostActionBar } from '@/components/community/post-action-bar';
import { PostHeader } from '@/components/community/post-header';
import {
  ActivityIndicator,
  FocusAwareStatusBar,
  GlassButton,
  OptimizedImage,
  Text,
  View,
} from '@/components/ui';
import colors from '@/components/ui/colors';
import { ArrowLeft } from '@/components/ui/icons';
import { normalizePostUserId } from '@/lib/community/post-utils';
import { isCommunityCommentsKey } from '@/lib/community/query-keys';
import {
  createOutboxAdapter,
  useCommunityFeedRealtime,
} from '@/lib/community/use-community-feed-realtime';
import { formatRelativeTimeTranslated } from '@/lib/datetime/format-relative-time';
import { haptics } from '@/lib/haptics';
import { translate, type TxKeyPath } from '@/lib/i18n';
import { showErrorToast } from '@/lib/settings/toast-utils';
import { getHeaderColors } from '@/lib/theme-utils';
import { database } from '@/lib/watermelon';

const styles = StyleSheet.create({
  flex1: {
    flex: 1,
  },
  heroImage: {
    aspectRatio: 4 / 3,
    width: '100%',
  },
  scrollContent: {
    paddingBottom: 128,
  },
  contentSheet: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
});

// eslint-disable-next-line max-lines-per-function -- screen component with complex layout
export default function PostDetailScreen(): React.ReactElement {
  const local = useLocalSearchParams<{ id: string; commentId?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const headerColors = getHeaderColors(isDark);

  const scrollViewRef = React.useRef<ScrollView>(null);
  const queryClient = useQueryClient();
  const outboxAdapter = React.useMemo(() => createOutboxAdapter(database), []);
  useCommunityFeedRealtime({ outboxAdapter, postId: local.id });

  const [highlightedCommentId, setHighlightedCommentId] = React.useState<
    string | undefined
  >(undefined);

  // Comment form state
  const [commentBody, setCommentBody] = React.useState('');
  const commentInputRef = React.useRef<TextInput>(null);
  const createCommentMutation = useCreateComment();

  const {
    data: post,
    isPending,
    isError,
    refetch,
  } = usePost({
    variables: { postId: local.id },
  });

  const { data: commentsData, isLoading: isLoadingComments } = useComments({
    postId: local.id,
    limit: 20,
  });

  const handleCommentSubmit = React.useCallback(async () => {
    if (!commentBody.trim() || createCommentMutation.isPending) return;
    try {
      await createCommentMutation.mutateAsync({
        postId: local.id,
        body: commentBody.trim(),
      });
      setCommentBody('');
      commentInputRef.current?.blur();
      void refetch();
      void queryClient.invalidateQueries({
        predicate: (query) =>
          isCommunityCommentsKey(query.queryKey) &&
          query.queryKey[1] === local.id,
      });
    } catch (error) {
      console.error('Create comment failed:', error);

      // Show user-friendly error toast
      const errorMessage = translate('community.comment_offline_failed');
      const errorDescription = translate(
        'community.comment_offline_failed_description'
      );

      // Include brief error detail if available
      const detail = error instanceof Error ? error.message : undefined;
      const fullDescription = detail
        ? `${errorDescription} (${detail})`
        : errorDescription;

      showErrorToast(errorMessage, fullDescription);
    }
  }, [createCommentMutation, local.id, commentBody, refetch, queryClient]);

  const handleSharePress = React.useCallback(async () => {
    haptics.selection();
    try {
      // Create a deep link to the post.
      // Note: We use the standardized schema uri provided by expo-linking
      const url = Linking.createURL(`/feed/${local.id}`);
      const message = `Check out this post on GrowBro: ${url}`;

      const result = await NativeShare.share(
        {
          message,
          url, // iOS: url parameter
          title: 'Share Post', // Android: dialog title
        },
        {
          // Android: show choose dialog
          dialogTitle: 'Share Post',
        }
      );

      if (result.action === NativeShare.sharedAction) {
        if (result.activityType) {
          // shared with activity type of result.activityType
          console.debug('Shared via', result.activityType);
        } else {
          // shared
        }
      } else if (result.action === NativeShare.dismissedAction) {
        // dismissed
      }
    } catch (error) {
      showErrorToast(
        translate('common.error' as TxKeyPath),
        error instanceof Error ? error.message : undefined
      );
    }
  }, [local.id]);

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

    // Convert strain name to URL-safe slug (e.g., "A.M.S." -> "a-m-s")
    // The strain lookup API expects slugs, not raw names
    const slug = post.strain
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-') // spaces → dashes
      .replace(/[^\w-]+/g, '') // remove non-word chars except dashes
      .replace(/--+/g, '-') // collapse multiple dashes
      .replace(/^-+|-+$/g, ''); // trim leading/trailing dashes

    router.push(`/strains/${slug}`);
  }, [post?.strain, router]);

  React.useEffect(() => {
    if (!local.commentId || isLoadingComments) return;
    setHighlightedCommentId(local.commentId);
    const timeout = setTimeout(() => {
      setHighlightedCommentId(undefined);
    }, 4000);
    return () => clearTimeout(timeout);
  }, [local.commentId, isLoadingComments]);

  // Loading state
  if (isPending) {
    return (
      <View className="flex-1 bg-neutral-50 dark:bg-charcoal-950">
        <Stack.Screen
          options={{
            headerShown: false,
          }}
        />
        <FocusAwareStatusBar />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      </View>
    );
  }

  // Error state
  if (isError || !post) {
    return (
      <View className="flex-1 bg-neutral-50 dark:bg-charcoal-950">
        <Stack.Screen
          options={{
            headerShown: false,
          }}
        />
        <FocusAwareStatusBar />
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-center text-neutral-600 dark:text-neutral-400">
            {translate('errors.postLoad' as TxKeyPath)}
          </Text>
        </View>
      </View>
    );
  }

  const normalizedPost = normalizePostUserId(post);
  const postUserId =
    normalizedPost.userId === 'invalid-user-id'
      ? `unknown-user-${normalizedPost.id}`
      : String(normalizedPost.userId);
  const displayUsername = postUserId.slice(0, 8);
  const relativeTime = formatRelativeTimeTranslated(
    post.created_at,
    'common.timeAgo'
  );
  const comments = commentsData?.results ?? [];
  const hasImage = Boolean(post.media_uri);

  return (
    <View className="flex-1 bg-neutral-50 dark:bg-charcoal-950">
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <FocusAwareStatusBar />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex1}
        keyboardVerticalOffset={0}
      >
        {/* Header - Deep green header with generous height */}
        <View
          className="z-0 px-5 pb-16"
          style={{
            paddingTop: insets.top + 12,
            backgroundColor: headerColors.background,
          }}
        >
          {/* Single row: Back button + Title */}
          <View className="flex-row items-center gap-4">
            <GlassButton
              onPress={() => router.back()}
              accessibilityLabel={translate('nav.back' as TxKeyPath)}
              accessibilityHint={translate(
                'accessibility.back_hint' as TxKeyPath
              )}
              fallbackClassName="bg-white/15"
            >
              <ArrowLeft color={colors.white} width={20} height={20} />
            </GlassButton>
            <Text
              className="text-2xl font-bold tracking-tight"
              style={{ color: headerColors.text }}
            >
              {translate('nav.post' as TxKeyPath)}
            </Text>
          </View>
        </View>

        {/* Content Sheet - Overlapping header with deep shadow */}
        <View
          className="z-10 -mt-10 flex-1 overflow-hidden rounded-t-[32px] bg-white shadow-2xl dark:bg-charcoal-900"
          style={styles.contentSheet}
        >
          <ScrollView
            ref={scrollViewRef}
            className="flex-1"
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Main Content - Direct in sheet, NO card wrapper */}
            <View className="px-5 pt-6">
              {/* 1. Author Row + Strain Pill */}
              <PostHeader
                displayUsername={displayUsername}
                relativeTime={relativeTime}
                strain={post.strain}
                isDark={isDark}
                onAuthorPress={handleAuthorPress}
                onStrainPress={handleStrainPress}
              />

              {/* 2. Hero Image */}
              {hasImage && (
                <View className="mb-4 overflow-hidden rounded-2xl shadow-sm">
                  <OptimizedImage
                    className="w-full"
                    style={styles.heroImage}
                    uri={post.media_uri!}
                    thumbnailUri={post.media_thumbnail_uri}
                    resizedUri={post.media_resized_uri}
                    blurhash={post.media_blurhash}
                    thumbhash={post.media_thumbhash}
                    recyclingKey={post.media_thumbnail_uri || post.media_uri}
                    accessibilityIgnoresInvertColors
                    accessibilityLabel={translate(
                      'accessibility.community.post_image' as TxKeyPath,
                      { author: displayUsername }
                    )}
                    accessibilityHint={translate(
                      'accessibility.community.post_image_hint' as TxKeyPath
                    )}
                  />
                </View>
              )}

              {/* 3. Action Bar */}
              <PostActionBar
                postId={String(post.id)}
                likeCount={post.like_count ?? 0}
                commentCount={post.comment_count ?? 0}
                userHasLiked={post.user_has_liked ?? false}
                isDark={isDark}
                onSharePress={handleSharePress}
              />

              {/* 5. Caption - Full text (unlike feed's 3-line limit) */}
              {post.body && (
                <Text className="mb-4 text-base leading-relaxed text-neutral-800 dark:text-neutral-200">
                  {post.body}
                </Text>
              )}

              {/* Divider - Soft separator */}
              <View className="my-6 h-px w-full bg-neutral-200/80 dark:bg-white/10" />

              {/* Comments Header */}
              <View className="mb-4 flex-row items-center gap-2">
                <View className="size-1 rounded-full bg-primary-500" />
                <Text className="text-xs font-bold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
                  {translate('community.comments' as TxKeyPath)}
                </Text>
              </View>
              <CommentList
                comments={comments}
                isLoading={isLoadingComments}
                highlightedCommentId={highlightedCommentId}
              />
            </View>
          </ScrollView>

          {/* Sticky Footer - Messenger Style Comment Input */}
          <CommentInputFooter
            value={commentBody}
            onChangeText={setCommentBody}
            onSubmit={handleCommentSubmit}
            isPending={createCommentMutation.isPending}
            bottomInset={insets.bottom}
            inputRef={commentInputRef}
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
