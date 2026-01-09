import { useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { usePlantReadings } from '@/api/ph-ec-readings';
import { Pressable, Text, View } from '@/components/ui';
import colors from '@/components/ui/colors';
import { ArrowRight } from '@/components/ui/icons';
import { formatPpmWithScale, PpmScale } from '@/lib/nutrient-engine';

type PlantNutrientSectionProps = {
  plantId: string;
};

/**
 * Displays the latest pH/EC reading for a plant with navigation
 * to view all readings or log a new one.
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

  // Show loading skeleton or empty state
  if (isLoading) {
    return (
      <View className="mx-4 mt-6">
        <View className="rounded-2xl bg-neutral-100 p-4 dark:bg-charcoal-800">
          <View className="h-4 w-24 rounded bg-neutral-200 dark:bg-charcoal-700" />
          <View className="mt-3 h-8 w-32 rounded bg-neutral-200 dark:bg-charcoal-700" />
        </View>
      </View>
    );
  }

  return (
    <View className="mx-4 mt-6">
      {/* Section Header */}
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          {t('plants.detail.nutrient_section.title')}
        </Text>
        {latestReading ? (
          <Pressable
            onPress={handleViewAll}
            className="flex-row items-center active:opacity-70"
            accessibilityRole="button"
            accessibilityLabel={t('plants.detail.nutrient_section.view_all')}
          >
            <Text className="mr-1 text-xs font-medium text-primary-600 dark:text-primary-400">
              {t('plants.detail.nutrient_section.view_all')}
            </Text>
            <ArrowRight color={colors.primary[500]} width={12} height={12} />
          </Pressable>
        ) : null}
      </View>

      {/* Content Card */}
      <View className="rounded-2xl bg-neutral-100 p-4 dark:bg-charcoal-800">
        {latestReading ? (
          <View>
            {/* Latest Reading Display */}
            <Text className="mb-2 text-xs text-neutral-500 dark:text-neutral-400">
              {t('plants.detail.nutrient_section.latest')}
            </Text>
            <View className="flex-row items-center gap-4">
              {/* pH */}
              <View className="flex-1">
                <Text className="text-xs uppercase text-neutral-500 dark:text-neutral-400">
                  pH
                </Text>
                <Text className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                  {latestReading.ph.toFixed(1)}
                </Text>
              </View>

              {/* Divider */}
              <View className="h-8 w-px bg-neutral-200 dark:bg-white/10" />

              {/* EC */}
              <View className="flex-1">
                <Text className="text-xs uppercase text-neutral-500 dark:text-neutral-400">
                  EC@25°C
                </Text>
                <Text className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                  {latestReading.ec25c.toFixed(2)}
                </Text>
              </View>

              {/* Divider */}
              <View className="h-8 w-px bg-neutral-200 dark:bg-white/10" />

              {/* PPM */}
              <View className="flex-1">
                <Text className="text-xs uppercase text-neutral-500 dark:text-neutral-400">
                  PPM
                </Text>
                <Text className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                  {formatPpmWithScale(
                    latestReading.ec25c *
                      (latestReading.ppmScale === PpmScale.PPM_700 ? 700 : 500),
                    latestReading.ppmScale
                  )}
                </Text>
              </View>
            </View>

            {/* Log Reading Button */}
            <Pressable
              onPress={handleLogReading}
              className="mt-4 rounded-xl bg-primary-500 py-3 active:bg-primary-600"
              accessibilityRole="button"
              accessibilityLabel={t(
                'plants.detail.nutrient_section.log_reading'
              )}
            >
              <Text className="text-center text-sm font-semibold text-white">
                {t('plants.detail.nutrient_section.log_reading')}
              </Text>
            </Pressable>
          </View>
        ) : (
          <View className="items-center py-4">
            <Text className="mb-4 text-sm text-neutral-500 dark:text-neutral-400">
              {t('plants.detail.nutrient_section.empty')}
            </Text>
            <Pressable
              onPress={handleLogReading}
              className="rounded-xl bg-primary-500 px-6 py-3 active:bg-primary-600"
              accessibilityRole="button"
              accessibilityLabel={t(
                'plants.detail.nutrient_section.log_reading'
              )}
            >
              <Text className="text-sm font-semibold text-white">
                {t('plants.detail.nutrient_section.log_reading')}
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}
