import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { usePlantReadings } from '@/api/ph-ec-readings';
import { Pressable, Text, View } from '@/components/ui';
import { formatPpmWithScale, PpmScale } from '@/lib/nutrient-engine';

type PlantNutrientSectionProps = {
  plantId: string;
};

type PlantReading = {
  ph: number;
  ec25c: number;
  ppmScale: PpmScale;
};

const styles = StyleSheet.create({
  gradientFill: StyleSheet.absoluteFillObject,
});

function PlantNutrientSkeleton(): React.ReactElement {
  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between px-1">
        <View className="h-3 w-12 rounded bg-neutral-200 dark:bg-white/10" />
        <View className="h-3 w-16 rounded bg-neutral-200 dark:bg-white/10" />
      </View>
      <View className="rounded-2xl border border-neutral-200 bg-white p-8 dark:border-white/10 dark:bg-white/[0.06]">
        <View className="items-center gap-4">
          <View className="size-16 rounded-full bg-neutral-100 dark:bg-white/5" />
          <View className="h-4 w-48 rounded bg-neutral-100 dark:bg-white/5" />
          <View className="h-10 w-48 rounded-full bg-neutral-100 dark:bg-white/5" />
        </View>
      </View>
    </View>
  );
}

function NutrientHeader({
  onViewAll,
  t,
}: {
  onViewAll: () => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}): React.ReactElement {
  return (
    <View className="flex-row items-center justify-between px-1">
      <Text className="text-xs font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
        {t('plants.detail.stats_title')}
      </Text>
      <Pressable
        onPress={onViewAll}
        className="active:opacity-70"
        accessibilityRole="button"
        accessibilityLabel={t('plants.detail.stats_history')}
        accessibilityHint={t('accessibility.common.opens_screen_hint', {
          label: t('plants.detail.stats_history'),
        })}
      >
        <Text className="text-xs font-medium text-primary-600 dark:text-primary-400">
          {t('plants.detail.stats_history')}
        </Text>
      </Pressable>
    </View>
  );
}

function NutrientReadingCard({
  reading,
  onLogReading,
  t,
}: {
  reading: PlantReading;
  onLogReading: () => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}): React.ReactElement {
  return (
    <View className="p-5">
      <Text className="mb-3 text-xs font-medium text-neutral-500 dark:text-white/50">
        {t('plants.detail.nutrient_section.latest')}
      </Text>
      <View className="flex-row items-center gap-4">
        <View className="flex-1">
          <Text className="text-xs uppercase text-neutral-500 dark:text-white/50">
            pH
          </Text>
          <Text className="text-xl font-bold text-neutral-900 dark:text-white">
            {reading.ph.toFixed(1)}
          </Text>
        </View>
        <View className="h-8 w-px bg-neutral-200 dark:bg-white/10" />
        <View className="flex-1">
          <Text className="text-xs uppercase text-neutral-500 dark:text-white/50">
            EC@25°C
          </Text>
          <Text className="text-xl font-bold text-neutral-900 dark:text-white">
            {reading.ec25c.toFixed(2)}
          </Text>
        </View>
        <View className="h-8 w-px bg-neutral-200 dark:bg-white/10" />
        <View className="flex-1">
          <Text className="text-xs uppercase text-neutral-500 dark:text-white/50">
            PPM
          </Text>
          <Text className="text-xl font-bold text-neutral-900 dark:text-white">
            {formatPpmWithScale(
              reading.ec25c *
                (reading.ppmScale === PpmScale.PPM_700 ? 700 : 500),
              reading.ppmScale
            )}
          </Text>
        </View>
      </View>

      <Pressable
        onPress={onLogReading}
        className="mt-5 h-10 items-center justify-center rounded-full bg-primary-500 active:bg-primary-600"
        accessibilityRole="button"
        accessibilityLabel={t('plants.detail.nutrient_section.log_reading')}
        accessibilityHint={t('accessibility.common.action_button_hint', {
          label: t('plants.detail.nutrient_section.log_reading'),
        })}
      >
        <Text className="text-sm font-bold text-black">
          {t('plants.detail.nutrient_section.log_reading')}
        </Text>
      </Pressable>
    </View>
  );
}

function NutrientEmptyState({
  onLogReading,
  t,
}: {
  onLogReading: () => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}): React.ReactElement {
  return (
    <View className="items-center p-8">
      <LinearGradient
        colors={['rgba(16, 185, 129, 0.1)', 'transparent', 'transparent']}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.gradientFill}
      />

      <View className="mb-4 size-16 items-center justify-center rounded-full border border-neutral-200 bg-neutral-100 dark:border-white/10 dark:bg-white/5">
        <Text className="text-3xl">🧪</Text>
      </View>

      <View className="items-center gap-1">
        <Text className="text-base font-bold text-neutral-900 dark:text-white">
          {t('plants.detail.stats_empty_title')}
        </Text>
        <Text className="max-w-[240px] text-center text-sm leading-relaxed text-neutral-500 dark:text-white/50">
          {t('plants.detail.stats_empty_desc')}
        </Text>
      </View>

      <Pressable
        onPress={onLogReading}
        className="mt-6 h-10 w-full max-w-[200px] items-center justify-center rounded-full bg-primary-500 active:scale-95 active:bg-primary-600"
        accessibilityRole="button"
        accessibilityLabel={t('plants.detail.nutrient_section.log_reading')}
        accessibilityHint={t('accessibility.common.action_button_hint', {
          label: t('plants.detail.nutrient_section.log_reading'),
        })}
      >
        <Text className="text-sm font-bold text-black">
          {t('plants.detail.nutrient_section.log_reading')}
        </Text>
      </Pressable>
    </View>
  );
}

/**
 * Displays the latest pH/EC reading for a plant with navigation
 * to view all readings or log a new one.
 * Redesigned as "Stats" section with apothecary styling.
 */
export function PlantNutrientSection({
  plantId,
}: PlantNutrientSectionProps): React.ReactElement | null {
  const { t } = useTranslation();
  const router = useRouter();
  const { data, isLoading } = usePlantReadings(plantId);

  const latestReading = React.useMemo(() => {
    if (!data?.data?.length) return null;
    // Readings are ordered by measuredAt desc, so first is latest
    return data.data[0];
  }, [data?.data]);

  const handleViewAll = React.useCallback(() => {
    router.push(`/nutrient?plantId=${plantId}`);
  }, [router, plantId]);

  const handleLogReading = React.useCallback(() => {
    router.push(`/nutrient/add-reading?plantId=${plantId}`);
  }, [router, plantId]);

  // Show loading skeleton
  if (isLoading) {
    return <PlantNutrientSkeleton />;
  }

  return (
    <View className="gap-3">
      <NutrientHeader onViewAll={handleViewAll} t={t} />

      {/* Content Card */}
      <View className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-white/10 dark:bg-white/[0.06]">
        {latestReading ? (
          <NutrientReadingCard
            reading={latestReading as PlantReading}
            onLogReading={handleLogReading}
            t={t}
          />
        ) : (
          <NutrientEmptyState onLogReading={handleLogReading} t={t} />
        )}
      </View>
    </View>
  );
}
