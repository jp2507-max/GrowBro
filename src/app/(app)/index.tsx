import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Plant } from '@/api';
import { usePlantsInfinite } from '@/api';
import { ActivationChecklist } from '@/components/home/activation-checklist';
import { AddPlantFab } from '@/components/home/add-plant-fab';
import { HomeEmptyState } from '@/components/home/home-empty-state';
import { HomeHeader } from '@/components/home/home-header';
import { PlantsSection } from '@/components/home/plants-section';
import { PlantsErrorCard } from '@/components/plants';
import { FocusAwareStatusBar, View } from '@/components/ui';
import { useAnimatedScrollList } from '@/lib/animations/animated-scroll-list-provider';
import { useBottomTabBarHeight } from '@/lib/animations/use-bottom-tab-bar-height';
import type { ActivationAction } from '@/lib/compliance/activation-state';
import {
  completeActivationAction,
  hydrateActivationState,
} from '@/lib/compliance/activation-state';
import { usePlantsAttention } from '@/lib/hooks/use-plants-attention';

const BOTTOM_PADDING_EXTRA = 24;

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

export default function Feed() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { grossHeight } = useBottomTabBarHeight();
  const { resetScrollState } = useAnimatedScrollList();
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

  const contentPaddingBottom = React.useMemo(
    () => ({ paddingBottom: grossHeight + BOTTOM_PADDING_EXTRA }),
    [grossHeight]
  );

  const isLoading = isPlantsLoading;
  const hasPlantsError = isPlantsError && !isLoading && plants.length > 0;
  const isEmpty = !isLoading && plants.length === 0;

  // Task count for header (derived from plants with pending tasks)
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

      {/* Overlapping content sheet - z-10 on wrapper, not ScrollView */}
      <View className="z-10 -mt-10 flex-1">
        <ScrollView
          contentContainerStyle={contentPaddingBottom}
          showsVerticalScrollIndicator={false}
        >
          <View className="gap-4 px-4 pb-4">
            <ActivationChecklist
              onActionComplete={onActivationActionComplete}
            />

            {hasPlantsError ? (
              <PlantsErrorCard onRetry={refetchPlants} className="mb-2" />
            ) : null}

            {isEmpty ? (
              <HomeEmptyState />
            ) : (
              <PlantsSection
                plants={plants}
                isLoading={isLoading}
                onPlantPress={onPlantPress}
              />
            )}
          </View>
        </ScrollView>
      </View>
      <AddPlantFab />
    </View>
  );
}
