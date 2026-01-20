/* eslint-disable simple-import-sort/imports */
import React from 'react';
import { StyleSheet, type LayoutChangeEvent } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import type { Plant } from '@/api';
import { OptimizedImage, Pressable, Text, View } from '@/components/ui';
import { ArrowRight } from '@/components/ui/icons/arrow-right';
import colors from '@/components/ui/colors';
import { useAnimatedScrollList } from '@/lib/animations/animated-scroll-list-provider';
import { createStaggeredFadeIn } from '@/lib/animations/stagger';
import { haptics } from '@/lib/haptics';
import { usePlantPhotoSync } from '@/lib/plants/plant-photo-sync';
import { translate } from '@/lib/i18n';
import type { TxKeyPath } from '@/lib/i18n/utils';
import { useReduceMotionEnabled } from '@/lib/strains/accessibility';

export type PlantCardProps = {
  plant: Plant;
  onPress: (id: string) => void;
  itemY?: SharedValue<number>;
  needsAttention?: boolean;
  index?: number;
  enableEnteringAnimation?: boolean;
};

type StageColors = {
  bg: string;
  text: string;
  badgeBg: string;
  badgeText: string;
  icon: string;
};

// Stage colors using design tokens
function getStageColors(stage?: string): StageColors {
  switch (stage) {
    case 'seedling':
      return {
        bg: colors.success[200],
        text: colors.success[900],
        badgeBg: colors.success[50],
        badgeText: colors.success[800],
        icon: colors.success[300],
      };
    case 'vegetative':
      return {
        bg: colors.sky[200],
        text: colors.sky[900],
        badgeBg: colors.sky[50],
        badgeText: colors.sky[800],
        icon: colors.sky[300],
      };
    case 'flowering':
      return {
        bg: colors.indigo[200],
        text: colors.indigo[900],
        badgeBg: colors.indigo[50],
        badgeText: colors.indigo[800],
        icon: colors.indigo[300],
      };
    case 'harvesting':
      return {
        bg: colors.terracotta[200],
        text: colors.terracotta[900],
        badgeBg: colors.terracotta[50],
        badgeText: colors.terracotta[800],
        icon: colors.terracotta[300],
      };
    case 'curing':
      return {
        bg: colors.warning[200],
        text: colors.warning[900],
        badgeBg: colors.warning[50],
        badgeText: colors.warning[800],
        icon: colors.warning[300],
      };
    case 'ready':
      return {
        bg: colors.primary[200],
        text: colors.primary[900],
        badgeBg: colors.primary[50],
        badgeText: colors.primary[800],
        icon: colors.primary[300],
      };
    default:
      return {
        bg: colors.neutral[200],
        text: colors.neutral[900],
        badgeBg: colors.neutral[50],
        badgeText: colors.neutral[900],
        icon: colors.neutral[300],
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
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.09,
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
}): React.ReactElement {
  // Auto-sync plant photo from remote if missing locally
  const { resolvedLocalUri, thumbnailUrl } = usePlantPhotoSync(plant);

  return (
    <View
      className="size-16 overflow-hidden rounded-xl border border-neutral-100 bg-white dark:border-neutral-700"
      style={{ backgroundColor: colors.badgeBg }}
    >
      {resolvedLocalUri ? (
        <OptimizedImage
          uri={resolvedLocalUri}
          thumbnailUri={thumbnailUrl}
          className="size-full"
          contentFit="cover"
          recyclingKey={plant.id}
          transition={0}
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
}): React.ReactElement {
  return (
    <View className="flex-row items-start justify-between p-4 pb-3">
      <View className="flex-1 pr-3">
        {stageLabel ? (
          <Text
            className="mb-1 text-xs font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400"
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
}): React.ReactElement {
  return (
    <View className="px-4 pb-3">
      <View className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
        <View
          className="h-full rounded-full bg-primary-600"
          style={{ width: `${progress}%` }}
          testID={`plant-card-${plantId}-progress`}
        />
      </View>
      <Text className="mt-1.5 text-right text-[10px] font-medium text-neutral-500 dark:text-neutral-400">
        {translate('plants.card.progress' as TxKeyPath, { percent: progress })}
      </Text>
    </View>
  );
}

function PlantCardFooter({
  needsAttention,
}: {
  needsAttention: boolean;
}): React.ReactElement {
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
          <View className="rounded-xl bg-terracotta-500 px-4 py-2 shadow-sm">
            <Text className="text-xs font-bold text-white">
              {translate('plants.card.water_action' as TxKeyPath)}
            </Text>
          </View>
        </>
      ) : (
        <>
          <View className="flex-row items-center gap-2">
            <Text className="text-base">✓</Text>
            <Text className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
              {translate('plants.card.all_good' as TxKeyPath)}
            </Text>
          </View>
          <ArrowRight
            width={10}
            height={16}
            className="text-neutral-500 opacity-40 dark:text-neutral-400"
          />
        </>
      )}
    </View>
  );
}

function PlantCardContent({
  plant,
  onPress,
  needsAttention = false,
}: {
  plant: Plant;
  onPress: (id: string) => void;
  needsAttention?: boolean;
}): React.ReactElement {
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

  return (
    <Pressable
      className="mb-3 rounded-3xl active:scale-[0.98] active:opacity-95"
      style={[cardStyles.shadow]}
      testID={`plant-card-${plant.id}`}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={translate('accessibility.plants.open_detail_hint')}
      onPress={handlePress}
    >
      <View className="overflow-hidden rounded-3xl border border-neutral-200 bg-white dark:border-charcoal-700 dark:bg-charcoal-900">
        <PlantCardHeader
          plant={plant}
          stageLabel={stageLabel}
          colors={colors}
        />
        <PlantCardProgress plantId={plant.id} progress={progress} />
        <PlantCardFooter needsAttention={needsAttention} />
      </View>
    </Pressable>
  );
}

export function PlantCard({
  plant,
  onPress,
  itemY,
  needsAttention = false,
  index = 0,
  enableEnteringAnimation = false,
}: PlantCardProps): React.ReactElement {
  const { listOffsetY } = useAnimatedScrollList();
  const localItemY = useSharedValue(0);
  const effItemY = itemY ?? localItemY;
  const measuredHeight = useSharedValue(0);
  const reduceMotionEnabled = useReduceMotionEnabled();
  const reduceMotionShared = useSharedValue(reduceMotionEnabled ? 1 : 0);

  const enteringAnimation = React.useMemo(
    () =>
      enableEnteringAnimation
        ? createStaggeredFadeIn(index, {
            baseDelay: 0,
            staggerDelay: 50,
            duration: 300,
          })
        : undefined,
    [enableEnteringAnimation, index]
  );

  React.useEffect(() => {
    reduceMotionShared.value = reduceMotionEnabled ? 1 : 0;
  }, [reduceMotionEnabled, reduceMotionShared]);

  const containerStyle = useAnimatedStyle(() => {
    'worklet';

    if (reduceMotionShared.value === 1) {
      return { transform: [{ translateY: 0 }, { scale: 1 }] };
    }

    const h = Math.max(measuredHeight.value, 1);
    const start = effItemY.value - 1;
    const mid = effItemY.value;
    const end = effItemY.value + h;
    const offset = listOffsetY.value;
    const scaleProgress = Math.min(
      Math.max((offset - mid) / (end - mid), 0),
      1
    );
    const scale = 1 - 0.02 * scaleProgress;
    const translateY = Math.min(Math.max(offset - start, 0), 1);
    return { transform: [{ translateY }, { scale }] };
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
    <Animated.View
      entering={enteringAnimation}
      style={containerStyle}
      onLayout={onLayout}
    >
      <PlantCardContent
        plant={plant}
        onPress={onPress}
        needsAttention={needsAttention}
      />
    </Animated.View>
  );
}
