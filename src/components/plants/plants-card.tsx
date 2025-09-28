/* eslint-disable simple-import-sort/imports */
import React from 'react';
import {
  StyleSheet,
  type LayoutChangeEvent,
  type ListRenderItemInfo,
} from 'react-native';
import Animated, * as Reanimated from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

import type { Plant } from '@/api';
import { Pressable, Text, View } from '@/components/ui';
import { useAnimatedScrollList } from '@/lib/animations/animated-scroll-list-provider';
import {
  AnimatedOptionalBlurView,
  OptionalBlurView,
} from '@/components/shared/optional-blur-view';
import { translate } from '@/lib/i18n';

export type PlantCardProps = {
  plant: Plant;
  onPress: (id: string) => void;
  itemY?: SharedValue<number>;
};

function getStageColor(stage?: string) {
  switch (stage) {
    case 'seedling':
      return 'text-green-600 dark:text-green-400';
    case 'vegetative':
      return 'text-blue-600 dark:text-blue-400';
    case 'flowering':
      return 'text-purple-600 dark:text-purple-400';
    case 'harvesting':
      return 'text-orange-600 dark:text-orange-400';
    case 'curing':
      return 'text-yellow-600 dark:text-yellow-400';
    case 'ready':
      return 'text-emerald-600 dark:text-emerald-400';
    default:
      return 'text-neutral-500 dark:text-neutral-400';
  }
}

function getHealthColor(health?: string) {
  if (!health) return 'text-neutral-500 dark:text-neutral-400';
  if (health === 'excellent') return 'text-green-600 dark:text-green-400';
  if (health === 'good') return 'text-blue-600 dark:text-blue-400';
  if (health === 'fair') return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function PlantBlurOverlay({ animatedProps }: { animatedProps: any }) {
  return (
    <>
      <OptionalBlurView
        intensity={0}
        style={StyleSheet.absoluteFill as any}
        pointerEvents="none"
      />
      <AnimatedOptionalBlurView
        animatedProps={animatedProps}
        tint="dark"
        style={StyleSheet.absoluteFill as any}
        pointerEvents="none"
      />
    </>
  );
}

function PlantCardContent({
  plant,
  onPress,
}: {
  plant: Plant;
  onPress: (id: string) => void;
}) {
  const handlePress = React.useCallback(() => {
    onPress(plant.id);
  }, [onPress, plant.id]);
  const stageColor = React.useMemo(
    () => getStageColor(plant.stage),
    [plant.stage]
  );

  const healthColor = React.useMemo(
    () => getHealthColor(plant.health),
    [plant.health]
  );

  return (
    <Pressable
      className="mb-4 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
      testID={`plant-card-${plant.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${plant.name}${plant.stage ? `, ${plant.stage}` : ''}`}
      accessibilityHint={translate('accessibility.plants.open_detail_hint')}
      onPress={handlePress}
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
          {plant.name}
        </Text>
        {plant.stage ? (
          <Text className={`text-sm capitalize ${stageColor}`}>
            {plant.stage}
          </Text>
        ) : null}
      </View>
      {plant.strain ? (
        <Text className="mt-1 text-sm text-neutral-500 dark:text-neutral-300">
          {plant.strain}
        </Text>
      ) : null}
      {plant.health ? (
        <Text className={`mt-2 text-sm capitalize ${healthColor}`}>
          Health: {plant.health}
        </Text>
      ) : null}
      {plant.notes ? (
        <Text
          className="mt-2 text-sm text-neutral-600 dark:text-neutral-200"
          numberOfLines={2}
          ellipsizeMode="tail"
        >
          {plant.notes}
        </Text>
      ) : null}
    </Pressable>
  );
}

export function PlantCard({
  plant,
  onPress,
  itemY,
}: PlantCardProps): React.ReactElement {
  const { listOffsetY } = useAnimatedScrollList();
  const localItemY = Reanimated.useSharedValue(0);
  const effItemY = itemY ?? localItemY;
  const measuredHeight = Reanimated.useSharedValue(0);

  const containerStyle = Reanimated.useAnimatedStyle(() => {
    const h = Math.max(measuredHeight.value, 1);
    const start = effItemY.value - 1;
    const mid = effItemY.value;
    const end = effItemY.value + h;
    const scale = (Reanimated as any).interpolate(
      listOffsetY.value,
      [start, mid, end],
      [1, 1, 0.98]
    );
    const translateY = (Reanimated as any).interpolate(
      listOffsetY.value,
      [start - 1, start, start + 1],
      [0, 0, 1]
    );
    return { transform: [{ translateY }, { scale }] };
  });

  const blurAnimatedProps = (Reanimated as any).useAnimatedProps(() => {
    const h = Math.max(measuredHeight.value, 1);
    const start = effItemY.value - 1;
    const mid = effItemY.value;
    const end = effItemY.value + h;
    const intensity = (Reanimated as any).interpolate(
      listOffsetY.value,
      [start, mid, end],
      [0, 0, 8]
    );
    return { intensity } as any;
  });

  const onLayout = React.useCallback(
    (e: LayoutChangeEvent) => {
      const h = e.nativeEvent.layout.height;
      const y = e.nativeEvent.layout.y;
      if (h && Math.abs(h - measuredHeight.value) > 0.5) {
        measuredHeight.value = h;
      }
      if (y !== localItemY.value) {
        localItemY.value = y;
      }
    },
    [measuredHeight, localItemY]
  );

  return (
    <Animated.View style={[styles.wrapper, containerStyle]} onLayout={onLayout}>
      <PlantCardContent plant={plant} onPress={onPress} />
      <PlantBlurOverlay animatedProps={blurAnimatedProps as any} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {},
});

export function renderPlantItem(
  { item }: ListRenderItemInfo<Plant>,
  onPress: (id: string) => void
): React.ReactElement {
  return <PlantCard plant={item} onPress={onPress} />;
}
