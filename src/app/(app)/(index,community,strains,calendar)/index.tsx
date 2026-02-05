import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Plant } from '@/api';
import { usePlantsInfinite } from '@/api';
import { ActivationChecklist } from '@/components/home/activation-checklist';
import { AddPlantFab } from '@/components/home/add-plant-fab';
import { CockpitHeader } from '@/components/home/cockpit-header';
import { HomeEmptyState } from '@/components/home/home-empty-state';
import { MyGardenSection } from '@/components/home/my-garden-section';
import { TodaysFocusSection } from '@/components/home/todays-focus-section';
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

type UsePlantsDataResult = {
  plants: Plant[];
  isLoading: boolean;
  isError: boolean;
  refetch: ReturnType<typeof usePlantsInfinite>['refetch'];
};

function usePlantsData(isEnabled: boolean): UsePlantsDataResult {
  const { data, isLoading, isError, refetch } = usePlantsInfinite({
    variables: { query: '' },
    enabled: isEnabled,
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
  };
}

export default function Feed(): React.ReactElement {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { grossHeight } = useBottomTabBarHeight();
  const { resetScrollState } = useAnimatedScrollList();
  const {
    plants,
    isLoading: isPlantsLoading,
    isError: isPlantsError,
    refetch: refetchPlants,
  } = usePlantsData(isFocused);

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
    }),
    [grossHeight]
  );

  const isLoading = isPlantsLoading;
  const hasPlantsError = isPlantsError && !isLoading;
  const isEmpty = !isLoading && plants.length === 0 && !isPlantsError;

  // Fetch attention status for all plants
  const plantIds = React.useMemo(
    () => plants.map((plant) => plant.id),
    [plants]
  );
  const { attentionMap } = usePlantsAttention(plantIds, { enabled: isFocused });

  return (
    <View
      className="flex-1 bg-neutral-50 dark:bg-charcoal-950"
      testID="feed-screen"
    >
      <FocusAwareStatusBar />

      {/* Cockpit Header with date and greeting */}
      <CockpitHeader insets={insets} />

      {/* Content - no sheet, continuous dark background */}
      <ScrollView
        contentContainerStyle={contentContainerStyle}
        showsVerticalScrollIndicator={false}
        testID="cockpit-scroll"
      >
        {/* Activation Checklist */}
        <View className="px-4">
          <ActivationChecklist onActionComplete={onActivationActionComplete} />
        </View>

        {/* Error State */}
        {hasPlantsError && (
          <View className="px-4">
            <PlantsErrorCard onRetry={refetchPlants} className="mb-4" />
          </View>
        )}

        {/* My Garden Section */}
        {isEmpty ? (
          <HomeEmptyState />
        ) : (
          <MyGardenSection
            plants={plants}
            onPlantPress={onPlantPress}
            attentionMap={attentionMap}
            isLoading={isLoading}
          />
        )}

        {/* Today's Focus Section */}
        <View className="mt-6 px-4">
          <TodaysFocusSection />
        </View>
      </ScrollView>
      <AddPlantFab />
    </View>
  );
}
