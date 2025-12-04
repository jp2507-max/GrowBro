import { useFocusEffect, useScrollToTop } from '@react-navigation/native';
import {
  FlashList,
  type FlashListProps,
  type FlashListRef,
} from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import {
  type ListRenderItemInfo,
  StyleSheet,
  type ViewProps,
} from 'react-native';
import Animated from 'react-native-reanimated';

import type { Plant } from '@/api';
import { usePlantsInfinite } from '@/api';
import {
  PlantsEmptyState,
  PlantsErrorCard,
  PlantsFooterLoader,
  PlantsOfflineBanner,
  PlantsSkeletonList,
  renderPlantItem,
} from '@/components/plants';
import CustomCellRendererComponent from '@/components/shared/custom-cell-renderer-component';
import { FocusAwareStatusBar, Input, Text, View } from '@/components/ui';
import { useAnimatedScrollList } from '@/lib/animations/animated-scroll-list-provider';
import { useBottomTabBarHeight } from '@/lib/animations/use-bottom-tab-bar-height';
import { useNetworkStatus, useScreenErrorLogger } from '@/lib/hooks';
import { translate } from '@/lib/i18n';

const SEARCH_DEBOUNCE_MS = 300;
const LIST_HORIZONTAL_PADDING = 16;
const LIST_BOTTOM_EXTRA = 16;

const AnimatedFlashList = Animated.createAnimatedComponent(
  FlashList as React.ComponentType<FlashListProps<Plant>>
);

function usePlantsData(searchQuery: string) {
  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = usePlantsInfinite({ variables: { query: searchQuery.trim() } });

  const plants = React.useMemo<Plant[]>(() => {
    if (!data?.pages?.length) return [];
    return data.pages.flatMap((page) => page.results);
  }, [data?.pages]);

  return {
    plants,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    error,
  } as const;
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = React.useState(value);

  React.useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(handle);
  }, [value, delayMs]);

  return debounced;
}

function useSkeletonVisibility(isLoading: boolean, itemsCount: number) {
  const [isVisible, setVisible] = React.useState(false);
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    const isInitial = isLoading && itemsCount === 0;
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
  }, [isLoading, itemsCount, isVisible]);

  return isVisible;
}

// eslint-disable-next-line max-lines-per-function
export default function PlantsScreen(): React.ReactElement {
  const router = useRouter();
  const {
    listRef: sharedListRef,
    scrollHandler,
    resetScrollState,
  } = useAnimatedScrollList();
  const { grossHeight } = useBottomTabBarHeight();

  // Reset scroll state on blur so tab bar is visible when navigating away
  useFocusEffect(
    useCallback(() => {
      return () => {
        resetScrollState();
      };
    }, [resetScrollState])
  );
  const { isConnected, isInternetReachable } = useNetworkStatus();
  const listContentPadding = React.useMemo(
    () => ({ paddingBottom: grossHeight + LIST_BOTTOM_EXTRA }),
    [grossHeight]
  );

  const listRef = React.useMemo(
    () => sharedListRef as React.RefObject<FlashListRef<Plant>>,
    [sharedListRef]
  );
  // useScrollToTop accepts refs with scrollTo/scrollToOffset methods
  useScrollToTop(
    listRef as React.RefObject<{
      scrollToOffset: (params: { offset?: number; animated?: boolean }) => void;
    }>
  );

  const isOffline = !isConnected || !isInternetReachable;

  const [cachedPlants, setCachedPlants] = React.useState<Plant[]>([]);

  const [searchValue, setSearchValue] = React.useState('');
  const debouncedQuery = useDebouncedValue(searchValue, SEARCH_DEBOUNCE_MS);

  const {
    plants,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = usePlantsData(debouncedQuery);

  React.useEffect(() => {
    if (!isOffline && plants.length > 0) {
      setCachedPlants(plants);
    }
  }, [isOffline, plants]);

  const listData = React.useMemo(() => {
    if (!isOffline) return plants;
    if (plants.length > 0) return plants;
    return cachedPlants;
  }, [isOffline, plants, cachedPlants]);

  const isSkeletonVisible = useSkeletonVisibility(isLoading, plants.length);

  useScreenErrorLogger(isError ? error : null, {
    screen: 'plants',
    feature: 'plants-inventory',
    action: 'fetch',
    queryKey: 'plants-infinite',
    metadata: {
      itemCount: plants.length,
      isOffline,
      isFetchingNextPage,
      hasNextPage,
    },
  });

  const onRetry = React.useCallback(() => {
    void refetch();
  }, [refetch]);

  const onItemPress = React.useCallback(
    (id: string) => {
      router.push(`/plants/${id}`);
    },
    [router]
  );

  const onEndReached = React.useCallback(() => {
    if (!isConnected || !isInternetReachable) return;
    if (!hasNextPage || isFetchingNextPage) return;
    void fetchNextPage();
  }, [
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isConnected,
    isInternetReachable,
  ]);

  const renderItem = React.useCallback(
    (info: ListRenderItemInfo<Plant>) => renderPlantItem(info, onItemPress),
    [onItemPress]
  );

  const keyExtractor = React.useCallback((item: Plant) => item.id, []);
  const getItemType = useCallback(() => 'plant', []);

  const listEmpty = React.useMemo(() => {
    if (isSkeletonVisible) return <PlantsSkeletonList />;
    if (isError && !isOffline) return <PlantsErrorCard onRetry={onRetry} />;
    return (
      <PlantsEmptyState
        query={debouncedQuery}
        showOfflineNotice={isOffline && cachedPlants.length > 0}
      />
    );
  }, [
    debouncedQuery,
    isError,
    isSkeletonVisible,
    isOffline,
    cachedPlants.length,
    onRetry,
  ]);

  const listFooter = React.useCallback(
    () => <PlantsFooterLoader isVisible={isFetchingNextPage} />,
    [isFetchingNextPage]
  );

  return (
    <View className="flex-1" testID="plants-screen">
      <FocusAwareStatusBar />
      <View className="px-4 pb-4 pt-3">
        <Text
          className="pb-3 text-2xl font-semibold text-neutral-900 dark:text-neutral-50"
          tx="shared_header.plants.title"
        />
        <Input
          value={searchValue}
          onChangeText={setSearchValue}
          placeholder={translate('plants.search_placeholder')}
          accessibilityLabel={translate('plants.search_placeholder')}
          accessibilityHint={translate('accessibility.plants.search_hint')}
          testID="plants-search-input"
        />
        <PlantsOfflineBanner isVisible={isOffline} />
      </View>
      <AnimatedFlashList
        ref={listRef}
        data={listData}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        CellRendererComponent={
          CustomCellRendererComponent as React.ComponentType<
            React.PropsWithChildren<ViewProps>
          >
        }
        getItemType={getItemType}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={[
          styles.listContentContainer,
          listContentPadding,
        ]}
        ListEmptyComponent={listEmpty}
        ListFooterComponent={listFooter}
        estimatedItemSize={undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  listContentContainer: {
    paddingHorizontal: LIST_HORIZONTAL_PADDING,
  },
});
