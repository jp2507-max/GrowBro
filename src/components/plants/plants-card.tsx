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
        bg: '#C6F6D5',
        text: '#14532d',
        badgeBg: '#F0FDF4',
        badgeText: '#166534',
        icon: '#86EFAC',
      };
    case 'vegetative':
      return {
        bg: '#BAE6FD',
        text: '#0c4a6e',
        badgeBg: '#F0F9FF',
        badgeText: '#075985',
        icon: '#7DD3FC',
      };
    case 'flowering':
      return {
        bg: '#E9D5FF',
        text: '#581c87',
        badgeBg: '#FAF5FF',
        badgeText: '#6b21a8',
        icon: '#D8B4FE',
      };
    case 'harvesting':
      return {
        bg: '#FED7AA',
        text: '#7c2d12',
        badgeBg: '#FFF7ED',
        badgeText: '#9a3412',
        icon: '#FDBA74',
      };
    case 'curing':
      return {
        bg: '#FDE68A',
        text: '#78350f',
        badgeBg: '#FFFBEB',
        badgeText: '#92400e',
        icon: '#FCD34D',
      };
    case 'ready':
      return {
        bg: '#A7F3D0',
        text: '#064e3b',
        badgeBg: '#ECFDF5',
        badgeText: '#065f46',
        icon: '#6EE7B7',
      };
    default:
      return {
        bg: '#E5E7EB',
        text: '#171717',
        badgeBg: '#F9FAFB',
        badgeText: '#262626',
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

// Stage progress percentages for gamification
function getStageProgress(stage?: string): number {
  switch (stage) {
    case 'seedling':
      return 15;
    case 'vegetative':
      return 35;
    case 'flowering':
      return 65;
    case 'harvesting':
      return 85;
    case 'curing':
      return 95;
    case 'ready':
      return 100;
    default:
      return 0;
  }
}

const cardStyles = StyleSheet.create({
  shadow: {
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
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
      className="size-16 overflow-hidden rounded-xl border border-neutral-100 bg-white dark:border-neutral-700"
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
          <Text className="text-2xl">🌱</Text>
        </View>
      )}
    </View>
  );
}

function PlantCardHeader({
  plant,
  stageLabel,
  colors,
}: {
  plant: Plant;
  stageLabel: string | null;
  colors: StageColors;
}) {
  return (
    <View className="flex-row items-start justify-between p-4 pb-3">
      <View className="flex-1 pr-3">
        {stageLabel ? (
          <Text
            className="text-text-tertiary mb-1 text-xs font-bold uppercase tracking-widest"
            testID={`plant-card-${plant.id}-stage-label`}
          >
            {stageLabel}
          </Text>
        ) : null}
        <Text
          className="text-2xl font-bold tracking-tight text-charcoal-900 dark:text-neutral-100"
          numberOfLines={1}
        >
          {plant.name}
        </Text>
        {plant.strain ? (
          <Text
            className="mt-0.5 text-base font-medium text-neutral-600 dark:text-neutral-400"
            numberOfLines={1}
          >
            {plant.strain}
          </Text>
        ) : null}
      </View>
      <PlantCardImage plant={plant} colors={colors} />
    </View>
  );
}

function PlantCardProgress({
  plantId,
  progress,
}: {
  plantId: string;
  progress: number;
}) {
  return (
    <View className="px-4 pb-3">
      <View className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
        <View
          className="bg-action-primary h-full rounded-full"
          style={{ width: `${progress}%` }}
          testID={`plant-card-${plantId}-progress`}
        />
      </View>
      <Text className="text-text-tertiary mt-1.5 text-right text-[10px] font-medium">
        {translate('plants.card.progress' as TxKeyPath, { percent: progress })}
      </Text>
    </View>
  );
}

function PlantCardFooter({ needsAttention }: { needsAttention: boolean }) {
  return (
    <View
      className={`flex-row items-center justify-between px-4 py-3 ${needsAttention ? 'bg-terracotta-50 dark:bg-terracotta-900/20' : 'bg-neutral-50 dark:bg-charcoal-950'}`}
    >
      {needsAttention ? (
        <>
          <View className="flex-row items-center gap-2">
            <Text className="text-base">💧</Text>
            <Text className="text-sm font-bold text-terracotta-600 dark:text-terracotta-400">
              {translate('plants.card.needs_water' as TxKeyPath)}
            </Text>
          </View>
          <View className="bg-action-cta rounded-xl px-4 py-2 shadow-sm">
            <Text className="text-xs font-bold text-white">
              {translate('plants.card.water_action' as TxKeyPath)}
            </Text>
          </View>
        </>
      ) : (
        <>
          <View className="flex-row items-center gap-2">
            <Text className="text-base">✓</Text>
            <Text className="text-text-secondary text-sm font-medium">
              {translate('plants.card.all_good' as TxKeyPath)}
            </Text>
          </View>
          <ArrowRight
            width={10}
            height={16}
            className="text-text-tertiary opacity-40"
          />
        </>
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
  const progress = React.useMemo(
    () => getStageProgress(plant.stage),
    [plant.stage]
  );
  const accessibilityLabel = React.useMemo(
    () =>
      [plant.name, stageLabel, plant.strain].filter(Boolean).join(', ') ||
      plant.name,
    [plant.name, plant.strain, stageLabel]
  );
  const needsAttention = false; // TODO: Replace with actual task check from plant data

  return (
    <Pressable
      className="bg-card mb-3 overflow-hidden rounded-3xl border border-neutral-200 active:scale-[0.98] active:opacity-95 dark:border-charcoal-700"
      style={[cardStyles.shadow]}
      testID={`plant-card-${plant.id}`}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={translate('accessibility.plants.open_detail_hint')}
      onPress={handlePress}
    >
      <PlantCardHeader plant={plant} stageLabel={stageLabel} colors={colors} />
      <PlantCardProgress plantId={plant.id} progress={progress} />
      <PlantCardFooter needsAttention={needsAttention} />
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
