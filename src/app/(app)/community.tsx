/**
 * Community Screen - "Deep Garden" Gallery Layout
 *
 * Instagram-style visual-first feed with:
 * - Clean dark green header with glass-style filter button
 * - Overlapping rounded sheet for content
 * - Dismissible slim compliance banner as first item
 * - Clean PostCard components with 4:5 images
 * - Terracotta FAB for creating posts
 */

import { useFocusEffect, useScrollToTop } from '@react-navigation/native';
import type { FlashListProps, FlashListRef } from '@shopify/flash-list';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useUndoDeletePost } from '@/api/community';
import type { CommunityPostSort, Post } from '@/api/community/types';
import { useCommunityPostsInfinite } from '@/api/community/use-posts-infinite';
import { AgeGatedPostCard } from '@/components/community/age-gated-post-card';
import { AgeVerificationPrompt } from '@/components/community/age-verification-prompt';
import { CommunityDiscoveryEmptyState } from '@/components/community/community-discovery-empty-state';
import { CommunityDiscoveryFilters } from '@/components/community/community-discovery-filters';
import { CommunityEmptyState } from '@/components/community/community-empty-state';
import { CommunityErrorBoundary } from '@/components/community/community-error-boundary';
import { CommunityErrorCard } from '@/components/community/community-error-card';
import { CommunityFab } from '@/components/community/community-fab';
import { CommunityFooterLoader } from '@/components/community/community-footer-loader';
import { CommunityHeader } from '@/components/community/community-header';
import { CommunitySkeletonList } from '@/components/community/community-skeleton-list';
import { OfflineIndicator } from '@/components/community/offline-indicator';
import { OutboxBanner } from '@/components/community/outbox-banner';
import { UndoSnackbar } from '@/components/community/undo-snackbar';
import {
  FocusAwareStatusBar,
  Modal,
  type ModalRef,
  View,
} from '@/components/ui';
import { ComplianceBanner } from '@/components/ui/compliance-banner';
import { translate, useAnalytics } from '@/lib';
import { sanitizeCommunityErrorType } from '@/lib/analytics';
import { useAnimatedScrollList } from '@/lib/animations/animated-scroll-list-provider';
import { useBottomTabBarHeight } from '@/lib/animations/use-bottom-tab-bar-height';
import { COMMUNITY_HELP_CATEGORY } from '@/lib/community/post-categories';
import {
  createOutboxAdapter,
  useCommunityFeedRealtime,
} from '@/lib/community/use-community-feed-realtime';
import { getOptimizedFlashListConfig } from '@/lib/flashlist-config';
import { haptics } from '@/lib/haptics';
import { useDebouncedValue, useScreenErrorLogger } from '@/lib/hooks';
import { useAgeGatedFeed } from '@/lib/moderation/use-age-gated-feed';
import { database } from '@/lib/watermelon';

const AnimatedFlashList = Animated.createAnimatedComponent(
  FlashList
) as React.ComponentClass<FlashListProps<Post>>;

type CommunityQueryParams = {
  query?: string;
  sort?: CommunityPostSort;
  photosOnly?: boolean;
  mineOnly?: boolean;
  limit?: number;
  category?: string | null;
};

type CommunityMode = 'showcase' | 'help';

type FilterBundle = {
  searchText: string;
  sort: CommunityPostSort;
  photosOnly: boolean;
  mineOnly: boolean;
};

const DEFAULT_FILTER_BUNDLE: FilterBundle = {
  searchText: '',
  sort: 'new',
  photosOnly: false,
  mineOnly: false,
};

function useCommunityData(params: CommunityQueryParams) {
  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetching,
    refetch,
  } = useCommunityPostsInfinite({
    variables: {
      query: params.query,
      sort: params.sort,
      photosOnly: params.photosOnly,
      mineOnly: params.mineOnly,
      limit: params.limit,
      category: params.category,
    },
  });

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
    isFetching,
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
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    listRef: sharedListRef,
    scrollHandler,
    resetScrollState,
  } = useAnimatedScrollList();
  const listRef = React.useMemo(
    () => sharedListRef as React.RefObject<FlashListRef<Post>>,
    [sharedListRef]
  );
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
  const outboxAdapter = React.useMemo(() => createOutboxAdapter(database), []);
  useCommunityFeedRealtime({ outboxAdapter });
  const filterSheetRef = React.useRef<ModalRef>(null);

  // Segment state: 0 = Showcase, 1 = Help Station
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const mode: CommunityMode = selectedIndex === 1 ? 'help' : 'showcase';

  // Per-segment filter bundles
  const [showcaseFilters, setShowcaseFilters] = React.useState<FilterBundle>(
    DEFAULT_FILTER_BUNDLE
  );
  const [helpFilters, setHelpFilters] = React.useState<FilterBundle>(
    DEFAULT_FILTER_BUNDLE
  );

  // Get active filter bundle based on mode
  const activeFilters = mode === 'help' ? helpFilters : showcaseFilters;
  const setActiveFilters =
    mode === 'help' ? setHelpFilters : setShowcaseFilters;

  const debouncedSearchText = useDebouncedValue(
    activeFilters.searchText.trim(),
    200
  );

  // Derive category from mode: Showcase = null (posts with no category), Help = help category
  const category = mode === 'help' ? COMMUNITY_HELP_CATEGORY : null;

  const hasActiveFilters =
    activeFilters.sort !== 'new' ||
    activeFilters.photosOnly ||
    activeFilters.mineOnly;
  const isDiscoveryActive =
    hasActiveFilters || activeFilters.searchText.trim().length > 0;

  // Segment labels for the header
  const segmentLabels: [string, string] = React.useMemo(
    () => [
      t('community.segments.showcase'),
      t('community.segments.help_station'),
    ],
    [t]
  );

  const handleSegmentChange = React.useCallback(
    (index: number) => {
      setSelectedIndex(index);
      // Scroll to top when switching segments
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
    },
    [listRef]
  );

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
  } = useCommunityData({
    query: debouncedSearchText.length > 0 ? debouncedSearchText : undefined,
    sort: activeFilters.sort,
    photosOnly: activeFilters.photosOnly,
    mineOnly: activeFilters.mineOnly,
    limit: 20,
    category,
  });

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
    queryKey: 'community-posts-infinite',
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
    // Pass mode param for Help Station so AddPost can set category
    if (mode === 'help') {
      router.push('/add-post?mode=help');
    } else {
      router.push('/add-post');
    }
  }, [router, mode]);

  const handleFilterPress = React.useCallback(() => {
    filterSheetRef.current?.present();
  }, []);

  const handleClearFilters = React.useCallback(() => {
    setActiveFilters(DEFAULT_FILTER_BUNDLE);
    filterSheetRef.current?.dismiss();
  }, [setActiveFilters]);

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
    if (isDiscoveryActive) {
      return (
        <CommunityDiscoveryEmptyState onClearFilters={handleClearFilters} />
      );
    }
    return <CommunityEmptyState onCreatePress={onCreatePress} />;
  }, [
    isSkeletonVisible,
    isError,
    isDiscoveryActive,
    handleClearFilters,
    onRetry,
    onCreatePress,
  ]);

  const listFooter = React.useCallback(
    () => <CommunityFooterLoader isVisible={isFetchingNextPage} />,
    [isFetchingNextPage]
  );

  const listHeader = React.useCallback(
    () => (
      <View className="px-4 pt-4">
        {/* Dismissible Compliance Banner */}
        <ComplianceBanner />

        {/* Offline & Outbox indicators */}
        <OfflineIndicator onRetrySync={refetch} />
        <OutboxBanner />

        {/* Age verification prompt */}
        {requiresVerification && !isAgeCheckLoading && (
          <AgeVerificationPrompt
            visible={showAgePrompt}
            onDismiss={() => setShowAgePrompt(false)}
            contentType="feed"
          />
        )}

        {/* Inline error for existing posts */}
        {posts.length > 0 && isError && (
          <View className="pb-4">
            <CommunityErrorCard
              onRetry={onRetry}
              testID="community-inline-error"
            />
          </View>
        )}
      </View>
    ),
    [
      refetch,
      requiresVerification,
      isAgeCheckLoading,
      showAgePrompt,
      posts.length,
      isError,
      onRetry,
    ]
  );

  const onEndReached = React.useCallback(() => {
    if (!hasNextPage || isFetchingNextPage) return;
    void fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const getItemType = React.useCallback((item: Post) => {
    return item.media_uri ? 'post-with-media' : 'post-text-only';
  }, []);

  const flashListConfig = React.useMemo(
    () => getOptimizedFlashListConfig(),
    []
  );

  const handleFilterPressWithHaptics = React.useCallback(() => {
    haptics.selection();
    handleFilterPress();
  }, [handleFilterPress]);

  return (
    <>
      <CommunityErrorBoundary>
        <View className="flex-1 bg-neutral-50 dark:bg-charcoal-950">
          <FocusAwareStatusBar />

          {/* Shared Header Component */}
          <CommunityHeader
            insets={insets}
            hasActiveFilters={hasActiveFilters}
            onFilterPress={handleFilterPressWithHaptics}
            selectedIndex={selectedIndex}
            onSegmentChange={handleSegmentChange}
            segmentLabels={segmentLabels}
          />

          {/* Content Sheet - Overlapping header with curved top */}
          <View className="z-10 -mt-8 flex-1 overflow-hidden rounded-t-[35px] bg-neutral-50 dark:bg-stone-950">
            {/* Drag indicator pill */}
            <View className="w-full items-center pb-2 pt-4">
              <View className="h-1 w-10 rounded-full bg-neutral-300 dark:bg-charcoal-700" />
            </View>

            <View className="flex-1" testID="community-screen">
              <AnimatedFlashList
                // @ts-expect-error - AnimatedFlashList ref type mismatch with FlashListRef
                ref={listRef}
                data={filteredPosts as Post[]}
                renderItem={renderItem}
                getItemType={getItemType}
                keyExtractor={(item: Post) => String(item.id)}
                onEndReached={onEndReached}
                onEndReachedThreshold={0.4}
                // @ts-expect-error - Reanimated scroll handler type is incompatible with FlashList onScroll
                onScroll={scrollHandler}
                scrollEventThrottle={flashListConfig.scrollEventThrottle}
                removeClippedSubviews={flashListConfig.removeClippedSubviews}
                drawDistance={flashListConfig.drawDistance}
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                contentContainerStyle={{ paddingBottom: grossHeight + 80 }}
                ListHeaderComponent={listHeader}
                ListEmptyComponent={listEmpty}
                ListFooterComponent={listFooter}
              />

              {/* Terracotta FAB for creating posts - changes style for Help mode */}
              <CommunityFab onPress={onCreatePress} mode={mode} />
            </View>
          </View>
        </View>
      </CommunityErrorBoundary>

      <Modal
        ref={filterSheetRef}
        snapPoints={['70%']}
        title={translate('community.filters_label')}
      >
        <CommunityDiscoveryFilters
          sort={activeFilters.sort}
          photosOnly={activeFilters.photosOnly}
          mineOnly={activeFilters.mineOnly}
          onSortChange={(sort) =>
            setActiveFilters((prev) => ({ ...prev, sort }))
          }
          onPhotosOnlyChange={(photosOnly) =>
            setActiveFilters((prev) => ({ ...prev, photosOnly }))
          }
          onMineOnlyChange={(mineOnly) =>
            setActiveFilters((prev) => ({ ...prev, mineOnly }))
          }
          onClearAll={handleClearFilters}
        />
      </Modal>

      <UndoSnackbar
        visible={!!undoState}
        message={translate('accessibility.community.post_deleted')}
        expiresAt={undoState?.undoExpiresAt ?? ''}
        onUndo={handleUndo}
        onDismiss={handleDismissUndo}
        disabled={undoMutation.isPending}
        bottomOffset={grossHeight + 16}
      />
    </>
  );
}
