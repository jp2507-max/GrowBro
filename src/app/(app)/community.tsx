import { useScrollToTop } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import React from 'react';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import type { Post } from '@/api';
import { usePostsInfinite } from '@/api';
import { CannabisEducationalBanner } from '@/components/cannabis-educational-banner';
import { Card } from '@/components/card';
import {
  CommunityEmptyState,
  CommunityErrorCard,
  CommunityFooterLoader,
  CommunitySkeletonList,
} from '@/components/community';
import { ComposeBtn } from '@/components/compose-btn';
import { FocusAwareStatusBar, View } from '@/components/ui';
import { useAnimatedScrollList } from '@/lib/animations/animated-scroll-list-provider';
import { useBottomTabBarHeight } from '@/lib/animations/use-bottom-tab-bar-height';

const AnimatedFlashList: any = Animated.createAnimatedComponent(
  FlashList as any
);

function useCommunityData() {
  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = usePostsInfinite();

  const posts = React.useMemo<Post[]>(() => {
    if (!data?.pages?.length) return [];
    return data.pages.flatMap((page: any) => page.results as Post[]);
  }, [data?.pages]);

  return {
    posts,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
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
  const { listRef, scrollHandler, listPointerEvents } = useAnimatedScrollList();
  useScrollToTop(listRef);
  const { grossHeight } = useBottomTabBarHeight();

  const {
    posts,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useCommunityData();

  const isSkeletonVisible = useSkeletonVisibility(isLoading, posts.length);

  const onRetry = React.useCallback(() => {
    void refetch();
  }, [refetch]);

  const onCreatePress = React.useCallback(() => {
    router.push('/community/add-post');
  }, [router]);

  const renderItem = React.useCallback(
    ({ item }: { item: Post }) => <Card {...item} />,
    []
  );

  const listInteractiveStyle = useAnimatedStyle(() => ({
    pointerEvents: listPointerEvents.value ? 'auto' : 'none',
  }));

  const listEmpty = React.useCallback(() => {
    if (isSkeletonVisible) return <CommunitySkeletonList />;
    if (isError) return <CommunityErrorCard onRetry={onRetry} />;
    return <CommunityEmptyState onCreatePress={onCreatePress} />;
  }, [isSkeletonVisible, isError, onRetry, onCreatePress]);

  const listHeader = React.useMemo(
    () => (
      <View className="px-4 pb-4">
        <CannabisEducationalBanner />
        {posts.length > 0 && isError ? (
          <View className="pt-4">
            <CommunityErrorCard
              onRetry={onRetry}
              testID="community-inline-error"
            />
          </View>
        ) : null}
      </View>
    ),
    [posts.length, isError, onRetry]
  );

  const listFooter = React.useCallback(
    () => <CommunityFooterLoader isVisible={isFetchingNextPage} />,
    [isFetchingNextPage]
  );

  const onEndReached = React.useCallback(() => {
    if (!hasNextPage || isFetchingNextPage) return;
    void fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  return (
    <CommunityListView
      listRef={listRef}
      posts={posts}
      renderItem={renderItem}
      onEndReached={onEndReached}
      scrollHandler={scrollHandler}
      grossHeight={grossHeight}
      listHeader={listHeader}
      listEmpty={listEmpty}
      listFooter={listFooter}
      listInteractiveStyle={listInteractiveStyle}
      onCreatePress={onCreatePress}
    />
  );
}

function CommunityListView({
  listRef,
  posts,
  renderItem,
  onEndReached,
  scrollHandler,
  grossHeight,
  listHeader,
  listEmpty,
  listFooter,
  listInteractiveStyle,
  onCreatePress,
}: {
  listRef: React.RefObject<any>;
  posts: Post[];
  renderItem: ({ item }: { item: Post }) => React.ReactElement;
  onEndReached: () => void;
  scrollHandler: any;
  grossHeight: number;
  listHeader: React.ReactNode;
  listEmpty: React.ReactNode | (() => React.ReactElement);
  listFooter: React.ReactNode | (() => React.ReactElement);
  listInteractiveStyle: any;
  onCreatePress: () => void;
}): React.ReactElement {
  return (
    <View className="flex-1" testID="community-screen">
      <FocusAwareStatusBar />
      <AnimatedFlashList
        ref={listRef as React.RefObject<any>}
        data={posts}
        renderItem={renderItem}
        keyExtractor={(item: Post) => String(item.id)}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: grossHeight + 16 }}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        ListFooterComponent={listFooter}
        style={listInteractiveStyle}
      />
      <ComposeBtn onPress={onCreatePress} />
    </View>
  );
}
