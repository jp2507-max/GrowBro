import { useScrollToTop } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import React from 'react';
import Animated from 'react-native-reanimated';

import type { Post } from '@/api';
import { usePostsInfinite } from '@/api';
import { useUndoDeletePost } from '@/api/community';
import { CannabisEducationalBanner } from '@/components/cannabis-educational-banner';
import {
  CommunityEmptyState,
  CommunityErrorBoundary,
  CommunityErrorCard,
  CommunityFooterLoader,
  CommunitySkeletonList,
  OfflineIndicator,
  PostCard,
  UndoSnackbar,
} from '@/components/community';
import { ComposeBtn } from '@/components/compose-btn';
import { FocusAwareStatusBar, Text, View } from '@/components/ui';
import { translate, useAnalytics } from '@/lib';
import { sanitizeCommunityErrorType } from '@/lib/analytics';
import { useAnimatedScrollList } from '@/lib/animations/animated-scroll-list-provider';
import { useBottomTabBarHeight } from '@/lib/animations/use-bottom-tab-bar-height';
import { useScreenErrorLogger } from '@/lib/hooks';
import type { TxKeyPath } from '@/lib/i18n';

const AnimatedFlashList: any = Animated.createAnimatedComponent(
  FlashList as any
);

function useCommunityData() {
  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = usePostsInfinite();

  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const posts = React.useMemo<Post[]>(() => {
    if (!data?.pages?.length) return [];
    return data.pages.flatMap((page: any) => page.results as Post[]);
  }, [data?.pages]);

  const handleRefresh = React.useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch]);

  return {
    posts,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    error,
    isRefreshing,
    handleRefresh,
  } as const;
}

function useSkeletonVisibility(isLoading: boolean, postsLength: number) {
  const [isVisible, setVisible] = React.useState(false);
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    const isInitial = isLoading && postsLength === 0;

    if (isInitial) {
      setVisible(true);
      return () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      };
    }

    if (isVisible) {
      timeoutRef.current = setTimeout(() => setVisible(false), 1200);
    } else if (!isLoading) {
      setVisible(false);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [isLoading, postsLength, isVisible]);

  return isVisible;
}

// eslint-disable-next-line max-lines-per-function
export default function CommunityScreen(): React.ReactElement {
  const router = useRouter();
  const { listRef, scrollHandler } = useAnimatedScrollList();
  useScrollToTop(listRef);
  const { grossHeight } = useBottomTabBarHeight();
  const analytics = useAnalytics();
  const undoMutation = useUndoDeletePost();

  const [undoState, setUndoState] = React.useState<{
    postId: string | number;
    undoExpiresAt: string;
  } | null>(null);

  const {
    posts,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    isRefreshing,
    handleRefresh,
  } = useCommunityData();

  const isSkeletonVisible = useSkeletonVisibility(isLoading, posts.length);
  const hasTrackedViewRef = React.useRef(false);
  const trackedEmptyReasonsRef = React.useRef<Set<'initial_load' | 'refresh'>>(
    new Set()
  );
  const emptyTriggerRef = React.useRef<'initial_load' | 'refresh'>(
    'initial_load'
  );
  const lastErrorTypeRef = React.useRef<string | null>(null);

  useScreenErrorLogger(isError ? error : null, {
    screen: 'community',
    feature: 'community-feed',
    action: 'fetch',
    queryKey: 'posts-infinite',
    metadata: {
      postsCount: posts.length,
      isFetchingNextPage,
      hasNextPage,
    },
  });

  React.useEffect(() => {
    if (hasTrackedViewRef.current) return;
    if (isLoading || isSkeletonVisible) return;
    hasTrackedViewRef.current = true;
    void analytics.track('community_view', { post_count: posts.length });
  }, [analytics, isLoading, isSkeletonVisible, posts.length]);

  React.useEffect(() => {
    if (isLoading || isSkeletonVisible || isError) return;
    if (posts.length > 0) {
      trackedEmptyReasonsRef.current.clear();
      return;
    }

    const reason = emptyTriggerRef.current;
    if (trackedEmptyReasonsRef.current.has(reason)) return;
    trackedEmptyReasonsRef.current.add(reason);
    void analytics.track('community_empty', { trigger: reason });
  }, [analytics, isError, isLoading, isSkeletonVisible, posts.length]);

  React.useEffect(() => {
    if (!isError) {
      lastErrorTypeRef.current = null;
      return;
    }

    const rawErrorType =
      (error?.name && error.name.trim()) ||
      (error?.message && error.message.trim()) ||
      'unknown';
    const normalized = sanitizeCommunityErrorType(rawErrorType);
    if (lastErrorTypeRef.current === rawErrorType) return;
    lastErrorTypeRef.current = rawErrorType;
    void analytics.track('community_error', { error_type: normalized });
  }, [analytics, error, isError]);

  const onRetry = React.useCallback(() => {
    emptyTriggerRef.current = 'refresh';
    trackedEmptyReasonsRef.current.delete('refresh');
    void refetch();
  }, [refetch]);

  const onCreatePress = React.useCallback(() => {
    router.push('/add-post');
  }, [router]);

  const handlePostDelete = React.useCallback(
    (postId: string | number, undoExpiresAt: string) => {
      setUndoState({ postId, undoExpiresAt });
      void refetch();
    },
    [refetch]
  );

  const handleUndo = React.useCallback(async () => {
    if (!undoState) return;
    try {
      await undoMutation.mutateAsync({ postId: undoState.postId });
      setUndoState(null);
      void refetch();
    } catch (error) {
      console.error('Undo delete failed:', error);
    }
  }, [undoState, undoMutation, refetch]);

  const handleDismissUndo = React.useCallback(() => {
    setUndoState(null);
  }, []);

  const renderItem = React.useCallback(
    ({ item }: { item: Post }) => (
      <PostCard post={item} onDelete={handlePostDelete} />
    ),
    [handlePostDelete]
  );

  const listEmpty = React.useCallback(() => {
    if (isSkeletonVisible) return <CommunitySkeletonList />;
    if (isError) return <CommunityErrorCard onRetry={onRetry} />;
    return <CommunityEmptyState onCreatePress={onCreatePress} />;
  }, [isSkeletonVisible, isError, onRetry, onCreatePress]);

  const listFooter = React.useCallback(
    () => <CommunityFooterLoader isVisible={isFetchingNextPage} />,
    [isFetchingNextPage]
  );

  const onEndReached = React.useCallback(() => {
    if (!hasNextPage || isFetchingNextPage) return;
    void fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const showPostsCount = !isSkeletonVisible;
  const postsCountKey: TxKeyPath = React.useMemo(() => {
    if (posts.length === 0) return 'community.posts_count_zero';
    if (posts.length === 1) return 'community.posts_count_one';
    return 'community.posts_count_other';
  }, [posts.length]);
  const postsCountLabel = translate(postsCountKey, {
    count: posts.length,
  });

  return (
    <>
      <CommunityErrorBoundary>
        <CommunityListView
          listRef={listRef}
          posts={posts}
          renderItem={renderItem}
          onEndReached={onEndReached}
          scrollHandler={scrollHandler}
          grossHeight={grossHeight}
          isRefreshing={isRefreshing}
          onRefresh={handleRefresh}
          listHeader={
            <View className="px-4 pb-4">
              <CannabisEducationalBanner />
              <OfflineIndicator onRetrySync={refetch} />
              {showPostsCount ? (
                <Text
                  className="pt-4 text-sm text-neutral-600 dark:text-neutral-300"
                  accessibilityRole="text"
                  testID="community-posts-count"
                >
                  {postsCountLabel}
                </Text>
              ) : null}
              {posts.length > 0 && isError ? (
                <View className="pt-4">
                  <CommunityErrorCard
                    onRetry={onRetry}
                    testID="community-inline-error"
                  />
                </View>
              ) : null}
            </View>
          }
          listEmpty={listEmpty}
          listFooter={listFooter}
          onCreatePress={onCreatePress}
        />
      </CommunityErrorBoundary>
      <UndoSnackbar
        visible={!!undoState}
        message={translate('community.post_deleted' as TxKeyPath)}
        expiresAt={undoState?.undoExpiresAt ?? ''}
        onUndo={handleUndo}
        onDismiss={handleDismissUndo}
      />
    </>
  );
}

function CommunityListView({
  listRef,
  posts,
  renderItem,
  onEndReached,
  scrollHandler,
  grossHeight,
  isRefreshing,
  onRefresh,
  listHeader,
  listEmpty,
  listFooter,
  onCreatePress,
}: {
  listRef: React.RefObject<any>;
  posts: Post[];
  renderItem: ({ item }: { item: Post }) => React.ReactElement;
  onEndReached: () => void;
  scrollHandler: any;
  grossHeight: number;
  isRefreshing: boolean;
  onRefresh: () => void;
  listHeader: React.ReactNode;
  listEmpty: React.ReactNode | (() => React.ReactElement);
  listFooter: React.ReactNode | (() => React.ReactElement);
  onCreatePress: () => void;
}): React.ReactElement {
  const getItemType = React.useCallback((item: Post) => {
    // Differentiate posts with media from text-only for FlashList performance
    return item.media_uri ? 'post-with-media' : 'post-text-only';
  }, []);

  return (
    <View className="flex-1" testID="community-screen">
      <FocusAwareStatusBar />
      <AnimatedFlashList
        ref={listRef as React.RefObject<any>}
        data={posts}
        renderItem={renderItem}
        getItemType={getItemType}
        keyExtractor={(item: Post) => String(item.id)}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        refreshing={isRefreshing}
        onRefresh={onRefresh}
        contentContainerStyle={{ paddingBottom: grossHeight + 16 }}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        ListFooterComponent={listFooter}
      />
      <ComposeBtn onPress={onCreatePress} />
    </View>
  );
}
