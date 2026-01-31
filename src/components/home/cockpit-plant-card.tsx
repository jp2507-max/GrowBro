import { BlurView } from 'expo-blur';
import { DateTime } from 'luxon';
import { useColorScheme } from 'nativewind';
import React from 'react';
import { Dimensions, Platform, StyleSheet } from 'react-native';

import type { Plant, PlantEnvironment } from '@/api';
import { OptimizedImage, Pressable, Text, View } from '@/components/ui';
import { haptics } from '@/lib/haptics';
import { translate } from '@/lib/i18n';
import type { TxKeyPath } from '@/lib/i18n/utils';
import { usePlantPhotoSync } from '@/lib/plants/plant-photo-sync';
import {
  getProductStageLabelKey,
  type ProductPlantStage,
  toProductStage,
} from '@/lib/plants/product-stage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
export const CARD_WIDTH = SCREEN_WIDTH * 0.85;
const CARD_GAP = 12;

export type CockpitPlantCardProps = {
  plant: Plant;
  onPress: (id: string) => void;
  needsAttention?: boolean;
  testID?: string;
};

function translateStage(stage?: ProductPlantStage): string | null {
  if (!stage) return null;
  const key = getProductStageLabelKey(stage);
  const label = translate(key as TxKeyPath);
  return typeof label === 'string' && label.length > 0 ? label : stage;
}

function translateEnvironment(environment?: PlantEnvironment): string {
  if (!environment)
    return translate('home.cockpit.environment.indoor' as TxKeyPath);

  const key = `home.cockpit.environment.${environment}` as TxKeyPath;
  const label = translate(key);
  return typeof label === 'string' && label.length > 0 ? label : environment;
}

function calculateDayNumber(plantedAt?: string): number | null {
  if (!plantedAt) return null;

  const planted = DateTime.fromISO(plantedAt);
  if (!planted.isValid) return null;

  const now = DateTime.local();
  const diffDays = now.diff(planted, 'days').days;

  return Math.max(1, Math.floor(diffDays) + 1);
}

function calculateWeekNumber(plantedAt?: string): number | null {
  if (!plantedAt) return null;

  const planted = DateTime.fromISO(plantedAt);
  if (!planted.isValid) return null;

  const now = DateTime.local();
  const diffWeeks = now.diff(planted, 'weeks').weeks;

  return Math.max(1, Math.floor(diffWeeks) + 1);
}

function calculateProgress(stage?: ProductPlantStage): number {
  const stageWeights: Record<ProductPlantStage, number> = {
    germination: 0.05,
    seedling: 0.15,
    vegetative: 0.35,
    flowering: 0.7,
    drying: 0.85,
    curing: 0.95,
    completed: 1.0,
  };

  if (!stage) return 0.1;
  return stageWeights[stage] ?? 0.1;
}

const cardStyles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    marginRight: CARD_GAP,
    borderRadius: 24,
    overflow: 'hidden',
  },
  glassCard: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  imageContainer: {
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
});

function GlassBadge({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  if (Platform.OS === 'ios') {
    return (
      <BlurView
        intensity={40}
        tint={isDark ? 'dark' : 'light'}
        className="overflow-hidden rounded-full"
      >
        <View className="flex-row items-center gap-1.5 px-3 py-1.5">
          {children}
        </View>
      </BlurView>
    );
  }

  return (
    <View className="flex-row items-center gap-1.5 rounded-full bg-black/40 px-3 py-1.5">
      {children}
    </View>
  );
}

function PlantHeroImage({ plant }: { plant: Plant }): React.ReactElement {
  const { resolvedLocalUri, thumbnailUrl } = usePlantPhotoSync(plant);

  return (
    <View style={cardStyles.imageContainer} className="bg-neutral-800">
      {resolvedLocalUri ? (
        <OptimizedImage
          uri={resolvedLocalUri}
          thumbnailUri={thumbnailUrl}
          className="size-full"
          contentFit="cover"
          recyclingKey={plant.id}
          transition={150}
          testID={`cockpit-card-${plant.id}-image`}
        />
      ) : (
        <View
          className="size-full items-center justify-center bg-gradient-to-br from-primary-900/40 to-charcoal-900"
          testID={`cockpit-card-${plant.id}-placeholder`}
        >
          <Text className="text-6xl">🌱</Text>
        </View>
      )}
    </View>
  );
}

function DayBadge({
  dayNumber,
}: {
  dayNumber: number | null;
}): React.ReactElement | null {
  if (!dayNumber) return null;

  return (
    <GlassBadge>
      <View className="size-2 rounded-full bg-primary-400" />
      <Text className="text-xs font-bold text-white">
        {translate('home.cockpit.day' as TxKeyPath, { day: dayNumber })}
      </Text>
    </GlassBadge>
  );
}

function AttentionBadge(): React.ReactElement {
  return (
    <View className="flex-row items-center gap-1.5 rounded-lg bg-primary-500 px-3 py-1.5 shadow-lg">
      <Text className="text-sm">💧</Text>
      <Text className="text-xs font-bold text-charcoal-900">
        {translate('home.cockpit.needs_water' as TxKeyPath)}
      </Text>
    </View>
  );
}

function ProgressBar({ progress }: { progress: number }): React.ReactElement {
  const widthPercent = Math.min(100, Math.max(5, progress * 100));

  return (
    <View style={cardStyles.progressBar} className="w-full bg-white/10">
      <View
        style={[cardStyles.progressFill, { width: `${widthPercent}%` }]}
        className="bg-gradient-to-r from-primary-500/60 to-primary-400"
      />
    </View>
  );
}

type CardFooterProps = {
  displayName: string;
  environmentLabel: string;
  weekNumber: number | null;
  stageLabel: string | null;
  progress: number;
};

function CardFooter({
  displayName,
  environmentLabel,
  weekNumber,
  stageLabel,
  progress,
}: CardFooterProps): React.ReactElement {
  return (
    <View className="px-1 pb-1 pt-4">
      {/* Title Row */}
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <Text className="text-xl font-bold text-white" numberOfLines={1}>
            {displayName}
          </Text>
          <Text className="mt-0.5 text-sm text-white/50">
            {environmentLabel}
          </Text>
        </View>

        {/* Week / Stage */}
        <View className="items-end">
          {weekNumber && (
            <Text className="text-sm font-bold text-primary-400">
              {translate('home.cockpit.week' as TxKeyPath, {
                week: weekNumber,
              })}
            </Text>
          )}
          {stageLabel && (
            <Text className="text-xs text-white/50">{stageLabel}</Text>
          )}
        </View>
      </View>

      {/* Progress Bar */}
      <View className="mt-4">
        <ProgressBar progress={progress} />
      </View>
    </View>
  );
}

export function CockpitPlantCard({
  plant,
  onPress,
  needsAttention = false,
  testID,
}: CockpitPlantCardProps): React.ReactElement {
  const handlePress = React.useCallback(() => {
    haptics.selection();
    onPress(plant.id);
  }, [onPress, plant.id]);

  const productStage = React.useMemo(
    () => toProductStage(plant.stage),
    [plant.stage]
  );

  const dayNumber = React.useMemo(
    () => calculateDayNumber(plant.plantedAt),
    [plant.plantedAt]
  );

  const weekNumber = React.useMemo(
    () => calculateWeekNumber(plant.plantedAt),
    [plant.plantedAt]
  );

  const progress = React.useMemo(
    () => calculateProgress(productStage),
    [productStage]
  );

  const environmentLabel = React.useMemo(
    () => translateEnvironment(plant.environment),
    [plant.environment]
  );

  const stageLabel = React.useMemo(
    () => translateStage(productStage),
    [productStage]
  );

  const displayName =
    plant.name || plant.strain || translate('plants.unnamed' as TxKeyPath);

  const accessibilityLabel = React.useMemo(
    () =>
      [displayName, environmentLabel, weekNumber ? `Week ${weekNumber}` : null]
        .filter(Boolean)
        .join(', '),
    [displayName, environmentLabel, weekNumber]
  );

  return (
    <Pressable
      style={[cardStyles.card, cardStyles.shadow]}
      className="active:scale-[0.98] active:opacity-95"
      testID={testID ?? `cockpit-card-${plant.id}`}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={translate('accessibility.plants.open_detail_hint')}
      onPress={handlePress}
    >
      <View
        style={cardStyles.glassCard}
        className="overflow-hidden rounded-3xl bg-white/5 p-3"
      >
        {/* Hero Image with Floating Badges */}
        <View className="relative">
          <PlantHeroImage plant={plant} />

          {/* Day Badge - Top Left */}
          <View className="absolute left-3 top-3">
            <DayBadge dayNumber={dayNumber} />
          </View>

          {/* Attention Badge - Bottom Right */}
          {needsAttention && (
            <View className="absolute bottom-3 right-3">
              <AttentionBadge />
            </View>
          )}
        </View>

        {/* Card Footer */}
        <CardFooter
          displayName={displayName}
          environmentLabel={environmentLabel}
          weekNumber={weekNumber}
          stageLabel={stageLabel}
          progress={progress}
        />
      </View>
    </Pressable>
  );
}
