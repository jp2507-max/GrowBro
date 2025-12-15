/* eslint-disable simple-import-sort/imports */
import React from 'react';
import {
  StyleSheet,
  type LayoutChangeEvent,
  type ListRenderItemInfo,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
// @ts-expect-error - Reanimated 4.x type exports issue
import { interpolate } from 'react-native-reanimated';

import { useColorScheme } from 'nativewind';

import type { Plant } from '@/api';
import { Image, Pressable, Text, View } from '@/components/ui';
import { ArrowRight } from '@/components/ui/icons/arrow-right';
import { useAnimatedScrollList } from '@/lib/animations/animated-scroll-list-provider';
import { haptics } from '@/lib/haptics';
import { translate } from '@/lib/i18n';
import type { TxKeyPath } from '@/lib/i18n/utils';

export type PlantCardProps = {
  plant: Plant;
  onPress: (id: string) => void;
  itemY?: SharedValue<number>;
};

type StageColors = {
  bg: string;
  text: string;
  badgeBg: string;
  badgeText: string;
  icon: string;
};

// Vibrant pastel colors with better visibility
function getStageColors(stage?: string): StageColors {
  switch (stage) {
    case 'seedling':
      return {
        bg: '#C6F6D5', // Vibrant Mint Green
        text: '#14532d', // green-900
        badgeBg: '#F0FDF4', // lighter green
        badgeText: '#166534', // green-800
        icon: '#86EFAC',
      };
    case 'vegetative':
      return {
        bg: '#BAE6FD', // Vibrant Sky Blue
        text: '#0c4a6e', // sky-900
        badgeBg: '#F0F9FF',
        badgeText: '#075985', // sky-800
        icon: '#7DD3FC',
      };
    case 'flowering':
      return {
        bg: '#E9D5FF', // Vibrant Purple
        text: '#581c87', // purple-900
        badgeBg: '#FAF5FF',
        badgeText: '#6b21a8', // purple-800
        icon: '#D8B4FE',
      };
    case 'harvesting':
      return {
        bg: '#FED7AA', // Vibrant Orange
        text: '#7c2d12', // orange-900
        badgeBg: '#FFF7ED',
        badgeText: '#9a3412', // orange-800
        icon: '#FDBA74',
      };
    case 'curing':
      return {
        bg: '#FDE68A', // Vibrant Amber
        text: '#78350f', // amber-900
        badgeBg: '#FFFBEB',
        badgeText: '#92400e', // amber-800
        icon: '#FCD34D',
      };
    case 'ready':
      return {
        bg: '#A7F3D0', // Vibrant Emerald
        text: '#064e3b', // emerald-900
        badgeBg: '#ECFDF5',
        badgeText: '#065f46', // emerald-800
        icon: '#6EE7B7',
      };
    default:
      return {
        bg: '#E5E7EB', // Neutral Gray
        text: '#171717', // neutral-900
        badgeBg: '#F9FAFB',
        badgeText: '#262626', // neutral-800
        icon: '#D4D4D4',
      };
  }
}

function translateStage(stage?: string): string | null {
  if (!stage) return null;
  const key = `plants.form.stage.${stage}`;
  const label = translate(key as TxKeyPath);
  return typeof label === 'string' && label.length > 0 ? label : stage;
}

const cardStyles = StyleSheet.create({
  shadow: {
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
});

function PlantCardImage({
  plant,
  colors,
}: {
  plant: Plant;
  colors: StageColors;
}) {
  return (
    <View
      className="size-28 overflow-hidden rounded-2xl"
      style={{ backgroundColor: colors.badgeBg }}
    >
      {plant.imageUrl ? (
        <Image
          source={{ uri: plant.imageUrl }}
          className="size-full"
          contentFit="cover"
          testID={`plant-card-${plant.id}-image`}
        />
      ) : (
        <View
          className="size-full items-center justify-center"
          testID={`plant-card-${plant.id}-placeholder`}
        >
          <Text className="text-4xl">🌱</Text>
        </View>
      )}
    </View>
  );
}

function PlantCardContent({
  plant,
  onPress,
}: {
  plant: Plant;
  onPress: (id: string) => void;
}) {
  const { colorScheme } = useColorScheme();

  const handlePress = React.useCallback(() => {
    haptics.selection();
    onPress(plant.id);
  }, [onPress, plant.id]);

  const stageLabel = React.useMemo(
    () => translateStage(plant.stage),
    [plant.stage]
  );

  const colors = React.useMemo(
    () => getStageColors(plant.stage),
    [plant.stage]
  );

  const accessibilityLabel = React.useMemo(
    () =>
      [plant.name, stageLabel, plant.strain].filter(Boolean).join(', ') ||
      plant.name,
    [plant.name, plant.strain, stageLabel]
  );

  return (
    <Pressable
      className="mb-3 overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm active:scale-[0.98] active:opacity-95 dark:border-charcoal-700 dark:bg-charcoal-850"
      style={[
        cardStyles.shadow,
        // { backgroundColor: colors.bg, shadowColor: colors.text }, // Removed for clean look
      ]}
      testID={`plant-card-${plant.id}`}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={translate('accessibility.plants.open_detail_hint')}
      onPress={handlePress}
    >
      <View className="flex-row items-center p-6">
        {/* Left content: Name, strain, stage badge */}
        <View className="flex-1 justify-between pr-4">
          <View>
            <Text
              className="text-2xl font-bold tracking-tight text-ink-900 dark:text-charcoal-100"
              numberOfLines={1}
            >
              {plant.name}
            </Text>
            {plant.strain ? (
              <Text
                className="mt-1 text-base font-medium text-ink-700 opacity-60 dark:text-charcoal-400"
                numberOfLines={1}
              >
                {plant.strain}
              </Text>
            ) : null}
          </View>

          {stageLabel ? (
            <View
              testID={`plant-card-${plant.id}-stage`}
              className="mt-4 self-start rounded-full px-4 py-1.5"
              style={{ backgroundColor: colors.badgeBg }}
            >
              <Text
                className="text-sm font-semibold"
                style={{ color: colors.badgeText }}
              >
                {stageLabel}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Right content: Image + Arrow */}
        <View className="flex-row items-center gap-4">
          <PlantCardImage plant={plant} colors={colors} />
          <ArrowRight
            color={colorScheme === 'dark' ? '#9CA3AF' : '#1E1E1E'} // neutral-400 or ink-900
            width={12}
            height={18}
            className="opacity-20"
          />
        </View>
      </View>
    </Pressable>
  );
}

export function PlantCard({
  plant,
  onPress,
  itemY,
}: PlantCardProps): React.ReactElement {
  const { listOffsetY } = useAnimatedScrollList();
  const localItemY = useSharedValue(0);
  const effItemY = itemY ?? localItemY;
  const measuredHeight = useSharedValue(0);

  const containerStyle = useAnimatedStyle(() => {
    'worklet';
    const h = Math.max(measuredHeight.value, 1);
    const start = effItemY.value - 1;
    const mid = effItemY.value;
    const end = effItemY.value + h;
    const scale = interpolate(
      listOffsetY.value,
      [start, mid, end],
      [1, 1, 0.98]
    );
    const translateY = interpolate(
      listOffsetY.value,
      [start - 1, start, start + 1],
      [0, 0, 1]
    );
    return { transform: [{ translateY }, { scale }] };
  }, []);

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
