import { useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as React from 'react';
import { ScrollView } from 'react-native';

import { useComments, usePost } from '@/api/community';
import { CannabisEducationalBanner } from '@/components/cannabis-educational-banner';
import { CommentForm } from '@/components/community/comment-form';
import { CommentList } from '@/components/community/comment-list';
import { PostCard } from '@/components/community/post-card';
import { ModerationActions } from '@/components/moderation-actions';
import {
  ActivityIndicator,
  FocusAwareStatusBar,
  Text,
  View,
} from '@/components/ui';
import { normalizePostUserId } from '@/lib/community/post-utils';
import { isCommunityCommentsKey } from '@/lib/community/query-keys';
import {
  createOutboxAdapter,
  useCommunityFeedRealtime,
} from '@/lib/community/use-community-feed-realtime';
import { translate, type TxKeyPath } from '@/lib/i18n';
import { database } from '@/lib/watermelon';

export default function Post(): React.ReactElement {
  const local = useLocalSearchParams<{ id: string; commentId?: string }>();
  const scrollViewRef = React.useRef<ScrollView>(null);
  const queryClient = useQueryClient();
  const outboxAdapter = React.useMemo(() => createOutboxAdapter(database), []);
  useCommunityFeedRealtime({ outboxAdapter, postId: local.id });
  const [highlightedCommentId, setHighlightedCommentId] = React.useState<
    string | undefined
  >(undefined);
  // Note: Comment scrolling would require CommentList component to be updated
  // to support forwardRef and scrollToComment method

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

  const handleCommentCreated = React.useCallback(() => {
    void refetch();
    void queryClient.invalidateQueries({
      predicate: (query) =>
        isCommunityCommentsKey(query.queryKey) &&
        query.queryKey[1] === local.id,
    });
  }, [refetch, queryClient, local.id]);

  React.useEffect(() => {
    if (!local.commentId || isLoadingComments) return;
    setHighlightedCommentId(local.commentId);
    const timeout = setTimeout(() => {
      setHighlightedCommentId(undefined);
    }, 4000);
    return () => clearTimeout(timeout);
  }, [local.commentId, isLoadingComments]);

  if (isPending) {
    return (
      <View className="flex-1 justify-center p-3">
        <Stack.Screen
          options={{
            title: translate('nav.post' as TxKeyPath),
            headerBackTitle: translate('nav.feed' as TxKeyPath),
          }}
        />
        <FocusAwareStatusBar />
        <ActivityIndicator />
      </View>
    );
  }

  if (isError || !post) {
    return (
      <View className="flex-1 justify-center p-3">
        <Stack.Screen
          options={{
            title: translate('nav.post' as TxKeyPath),
            headerBackTitle: translate('nav.feed' as TxKeyPath),
          }}
        />
        <FocusAwareStatusBar />
        <Text className="text-center">
          {translate('errors.postLoad' as TxKeyPath)}
        </Text>
      </View>
    );
  }

  const comments = commentsData?.results ?? [];

  return (
    <View className="flex-1">
      <Stack.Screen
        options={{
          title: translate('nav.post'),
          headerBackTitle: translate('nav.feed'),
        }}
      />
      <FocusAwareStatusBar />
      <ScrollView ref={scrollViewRef} className="flex-1">
        <View className="p-3">
          <CannabisEducationalBanner className="mb-4" />
          <PostCard post={normalizePostUserId(post)} />
          <View className="mt-4">
            <ModerationActions
              contentId={post.id}
              authorId={String(post.userId || post.user_id || '')}
            />
          </View>
        </View>

        <View className="mt-6 border-t border-neutral-200 dark:border-neutral-800">
          <View className="p-4">
            <Text className="mb-4 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              {translate('community.comments' as TxKeyPath)}
            </Text>
            <CommentList
              comments={comments}
              isLoading={isLoadingComments}
              highlightedCommentId={highlightedCommentId}
            />
          </View>
        </View>
      </ScrollView>
      <CommentForm postId={local.id} onCommentCreated={handleCommentCreated} />
    </View>
  );
}
