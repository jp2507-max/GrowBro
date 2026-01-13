import { useFocusEffect } from '@react-navigation/native';
import { FlashList, type ListRenderItemInfo } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Plant } from '@/api';
import { usePlantsInfinite } from '@/api';
import { ActivationChecklist } from '@/components/home/activation-checklist';
import { AddPlantFab } from '@/components/home/add-plant-fab';
import { HomeEmptyState } from '@/components/home/home-empty-state';
import { HomeHeader } from '@/components/home/home-header';
import { PlantCard, PlantsErrorCard } from '@/components/plants';
import { FocusAwareStatusBar, View } from '@/components/ui';
import { useAnimatedScrollList } from '@/lib/animations/animated-scroll-list-provider';
import { useBottomTabBarHeight } from '@/lib/animations/use-bottom-tab-bar-height';
import type { ActivationAction } from '@/lib/compliance/activation-state';
import {
  completeActivationAction,
  hydrateActivationState,
} from '@/lib/compliance/activation-state';
import { getMediumFlashListConfig } from '@/lib/flashlist-config';
import { usePlantsAttention } from '@/lib/hooks/use-plants-attention';

const AnimatedFlashList = Animated.createAnimatedComponent(FlashList);

const BOTTOM_PADDING_EXTRA = 24;
const MAX_ENTERING_ANIMATIONS = 6;

function usePlantsData() {
  const { data, isLoading, isError, refetch } = usePlantsInfinite({
    variables: { query: '' },
  });

  const plants = React.useMemo<Plant[]>(() => {
    if (!data?.pages?.length) return [];
    return data.pages.flatMap((page) => page.results);
  }, [data?.pages]);

  return {
    plants,
    isLoading,
    isError,
    refetch,
  } as const;
}

// Header component rendered inside FlashList
type HomeListHeaderProps = {
  onActivationActionComplete: (action: ActivationAction) => void;
  hasPlantsError: boolean;
  refetchPlants: () => void;
  isLoading: boolean;
};

const HomeListHeader = React.memo(function HomeListHeader({
  onActivationActionComplete,
  hasPlantsError,
  refetchPlants,
  isLoading,
}: HomeListHeaderProps) {
  if (isLoading) {
    return (
      <View className="gap-3 pb-3" testID="plants-section-loading">
        {[1, 2].map((i) => (
          <View
            key={i}
            className="h-[88px] animate-pulse rounded-2xl bg-neutral-200/60 dark:bg-neutral-700/40"
          />
        ))}
      </View>
    );
  }

  return (
    <View className="gap-4 pb-3">
      <ActivationChecklist onActionComplete={onActivationActionComplete} />
      {hasPlantsError ? (
        <PlantsErrorCard onRetry={refetchPlants} className="mb-2" />
      ) : null}
    </View>
  );
});

export default function Feed() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { grossHeight } = useBottomTabBarHeight();
  const { resetScrollState, scrollHandler } = useAnimatedScrollList();
  const {
    plants,
    isLoading: isPlantsLoading,
    isError: isPlantsError,
    refetch: refetchPlants,
  } = usePlantsData();

  // Reset scroll state on focus so tab bar is always visible on home
  useFocusEffect(
    useCallback(() => {
      resetScrollState();
    }, [resetScrollState])
  );

  // Hydrate activation state on mount
  React.useEffect(() => {
    hydrateActivationState();
  }, []);

  const onActivationActionComplete = React.useCallback(
    (action: ActivationAction) => {
      completeActivationAction(action);
    },
    []
  );

  const onPlantPress = React.useCallback(
    (id: string) => {
      router.push(`/plants/${id}`);
    },
    [router]
  );

  const contentContainerStyle = React.useMemo(
    () => ({
      paddingBottom: grossHeight + BOTTOM_PADDING_EXTRA,
      paddingHorizontal: 16,
    }),
    [grossHeight]
  );

  const isLoading = isPlantsLoading;
  const hasPlantsError = isPlantsError && !isLoading && plants.length > 0;
  const isEmpty = !isLoading && plants.length === 0;

  // Single attention query - passed to all plant cards
  const plantIds = React.useMemo(
    () => plants.map((plant) => plant.id),
    [plants]
  );
  const { attentionMap } = usePlantsAttention(plantIds);

  const taskCount = React.useMemo(() => {
    return Object.values(attentionMap).reduce(
      (total, status) =>
        total + (status.overdueCount || 0) + (status.dueTodayCount || 0),
      0
    );
  }, [attentionMap]);

  // Memoized render function for FlashList
  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<Plant>) => (
      <PlantCard
        plant={item}
        onPress={onPlantPress}
        index={index}
        enableEnteringAnimation={index < MAX_ENTERING_ANIMATIONS}
        needsAttention={attentionMap[item.id]?.needsAttention ?? false}
      />
    ),
    [onPlantPress, attentionMap]
  );

  const keyExtractor = useCallback((item: Plant) => item.id, []);

  const listHeader = React.useMemo(
    () => (
      <HomeListHeader
        onActivationActionComplete={onActivationActionComplete}
        hasPlantsError={hasPlantsError}
        refetchPlants={refetchPlants}
        isLoading={isLoading}
      />
    ),
    [onActivationActionComplete, hasPlantsError, refetchPlants, isLoading]
  );

  const listEmpty = React.useMemo(
    () => (isEmpty ? <HomeEmptyState /> : null),
    [isEmpty]
  );

  return (
    <View
      className="flex-1 bg-neutral-50 dark:bg-charcoal-950"
      testID="feed-screen"
    >
      <FocusAwareStatusBar />

      {/* Header rendered directly in screen for shared stacking context */}
      <HomeHeader
        plantCount={plants.length}
        taskCount={taskCount}
        insets={insets}
      />

      {/* Content Sheet - Overlapping header like Community */}
      <View className="z-10 -mt-4 flex-1 overflow-hidden rounded-t-[28px] bg-neutral-50 dark:bg-charcoal-950">
        {/* Decorative drag indicator pill - visual design consistency only, no gesture interaction */}
        <View className="w-full items-center py-3">
          <View className="h-1 w-10 rounded-full bg-neutral-300 dark:bg-charcoal-700" />
        </View>

        <AnimatedFlashList
          data={isLoading ? [] : plants}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={contentContainerStyle}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={listEmpty}
          testID="plants-section"
          onScroll={scrollHandler}
          {...getMediumFlashListConfig()}
        />
      </View>
      <AddPlantFab />
    </View>
  );
}
