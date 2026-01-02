import { useFocusEffect, useScrollToTop } from '@react-navigation/native';
import type { FlashListProps, FlashListRef } from '@shopify/flash-list';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import Animated from 'react-native-reanimated';

import type { Post } from '@/api';
import { usePostsInfinite } from '@/api';
import { useUndoDeletePost } from '@/api/community';
import { CannabisEducationalBanner } from '@/components/cannabis-educational-banner';
import { AgeGatedPostCard } from '@/components/community/age-gated-post-card';
import { AgeVerificationPrompt } from '@/components/community/age-verification-prompt';
import { CommunityEmptyState } from '@/components/community/community-empty-state';
import { CommunityErrorBoundary } from '@/components/community/community-error-boundary';
import { CommunityErrorCard } from '@/components/community/community-error-card';
import { CommunityFooterLoader } from '@/components/community/community-footer-loader';
import { CommunitySkeletonList } from '@/components/community/community-skeleton-list';
import { OfflineIndicator } from '@/components/community/offline-indicator';
import { UndoSnackbar } from '@/components/community/undo-snackbar';
import { ComposeBtn } from '@/components/compose-btn';
import { FocusAwareStatusBar, Text, View } from '@/components/ui';
import { translate, useAnalytics } from '@/lib';
import { sanitizeCommunityErrorType } from '@/lib/analytics';
import { useAnimatedScrollList } from '@/lib/animations/animated-scroll-list-provider';
import { useBottomTabBarHeight } from '@/lib/animations/use-bottom-tab-bar-height';
import { getOptimizedFlashListConfig } from '@/lib/flashlist-config';
import { useScreenErrorLogger } from '@/lib/hooks';
import type { TxKeyPath } from '@/lib/i18n';
import { useAgeGatedFeed } from '@/lib/moderation/use-age-gated-feed';

const AnimatedFlashList = Animated.createAnimatedComponent(
  FlashList
) as React.ComponentClass<FlashListProps<Post>>;

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
    return data.pages.flatMap(
      (page: { results: Post[] }) => page.results as Post[]
    );
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
  const {
    listRef: sharedListRef,
    scrollHandler,
    resetScrollState,
  } = useAnimatedScrollList();
  const listRef = React.useMemo(
    () => sharedListRef as React.RefObject<FlashListRef<Post>>,
    [sharedListRef]
  );
  // useScrollToTop accepts refs with scrollTo/scrollToOffset methods
  useScrollToTop(
    listRef as React.RefObject<{
      scrollToOffset: (params: { offset?: number; animated?: boolean }) => void;
    }>
  );
  const { grossHeight } = useBottomTabBarHeight();

  // Reset scroll state on blur so tab bar is visible when navigating away
  useFocusEffect(
    useCallback(() => {
      return () => {
        resetScrollState();
      };
    }, [resetScrollState])
  );
  const analytics = useAnalytics();
  const undoMutation = useUndoDeletePost();

  const [undoState, setUndoState] = React.useState<{
    postId: string | number;
    undoExpiresAt: string;
  } | null>(null);

  const [showAgePrompt, setShowAgePrompt] = React.useState(false);

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

  const {
    filterPosts,
    isAgeVerified,
    isLoading: isAgeCheckLoading,
    requiresVerification,
  } = useAgeGatedFeed({
    enabled: true,
    onVerificationRequired: () => setShowAgePrompt(true),
  });

  const filteredPosts = React.useMemo(
    () => filterPosts(posts),
    [filterPosts, posts]
  );

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
      await undoMutation.mutateAsync({ postId: String(undoState.postId) });
      setUndoState(null);
      void refetch();
    } catch (error) {
      console.error('Undo delete failed:', error);
    }
  }, [undoState, undoMutation, refetch]);

  const handleDismissUndo = React.useCallback(() => {
    setUndoState(null);
  }, []);

  const handleVerifyPress = React.useCallback(() => {
    setShowAgePrompt(false);
    router.push('/age-gate');
  }, [router]);

  const renderItem = React.useCallback(
    ({ item }: { item: Post }) => (
      <AgeGatedPostCard
        post={item}
        isAgeVerified={isAgeVerified}
        onDelete={handlePostDelete}
        onVerifyPress={handleVerifyPress}
      />
    ),
    [handlePostDelete, isAgeVerified, handleVerifyPress]
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
          posts={filteredPosts}
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
              {requiresVerification && !isAgeCheckLoading && (
                <AgeVerificationPrompt
                  visible={showAgePrompt}
                  onDismiss={() => setShowAgePrompt(false)}
                  contentType="feed"
                />
              )}
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
        message={translate('accessibility.community.post_deleted')}
        expiresAt={undoState?.undoExpiresAt ?? ''}
        onUndo={handleUndo}
        onDismiss={handleDismissUndo}
        disabled={undoMutation.isPending}
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
  listRef: React.RefObject<FlashListRef<Post>>;
  posts: Post[];
  renderItem: ({ item }: { item: Post }) => React.ReactElement;
  onEndReached: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  scrollHandler: any; // Reanimated scroll handler type is incompatible with FlashList onScroll
  grossHeight: number;
  isRefreshing: boolean;
  onRefresh: () => void;
  listHeader: React.ComponentType<unknown> | React.ReactElement | null;
  listEmpty: React.ComponentType<unknown> | React.ReactElement | null;
  listFooter: React.ComponentType<unknown> | React.ReactElement | null;
  onCreatePress: () => void;
}): React.ReactElement {
  const getItemType = React.useCallback((item: Post) => {
    // Differentiate posts with media from text-only for FlashList performance
    return item.media_uri ? 'post-with-media' : 'post-text-only';
  }, []);

  // Get optimized FlashList configuration for device capabilities
  const flashListConfig = React.useMemo(
    () => getOptimizedFlashListConfig(),
    []
  );

  return (
    <View className="flex-1" testID="community-screen">
      <FocusAwareStatusBar />
      <AnimatedFlashList
        // @ts-expect-error - AnimatedFlashList ref type mismatch with FlashListRef
        ref={listRef}
        data={posts}
        renderItem={renderItem}
        getItemType={getItemType}
        keyExtractor={(item: Post) => String(item.id)}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        onScroll={scrollHandler}
        scrollEventThrottle={flashListConfig.scrollEventThrottle}
        // Performance optimizations for fast scrolling
        removeClippedSubviews={flashListConfig.removeClippedSubviews}
        drawDistance={flashListConfig.drawDistance}
        maxToRenderPerBatch={flashListConfig.maxToRenderPerBatch}
        windowSize={flashListConfig.windowSize}
        updateCellsBatchingPeriod={flashListConfig.updateCellsBatchingPeriod}
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
