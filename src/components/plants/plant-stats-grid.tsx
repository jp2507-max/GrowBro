import { DateTime } from 'luxon';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { Plant } from '@/api/plants/types';
import { Text, View } from '@/components/ui';
import {
  getProductStageLabelKey,
  toProductStage,
} from '@/lib/plants/product-stage';

type PlantStatsGridProps = {
  plant: Plant;
};

/**
 * Sleek horizontal stats row - "Cockpit Style"
 * Displays Day count and Phase with vertical dividers.
 */
export function PlantStatsGrid({
  plant,
}: PlantStatsGridProps): React.ReactElement {
  const { t } = useTranslation();

  // Calculate days since planted
  const dayCount = React.useMemo(() => {
    if (!plant.plantedAt) return '—';
    const plantedDate = DateTime.fromISO(plant.plantedAt);
    if (!plantedDate.isValid) return '—';
    const days = Math.floor(DateTime.now().diff(plantedDate, 'days').days);
    return days >= 0 ? days : '—';
  }, [plant.plantedAt]);

  // Get phase from stage
  const phase = React.useMemo(() => {
    const productStage = toProductStage(plant.stage);
    if (!productStage) return '—';
    return t(getProductStageLabelKey(productStage));
  }, [plant.stage, t]);

  return (
    <View className="mx-4 flex-row items-center justify-between border-b border-neutral-200 py-6 dark:border-white/10">
      {/* Stat 1: Day */}
      <View className="flex-1 items-center">
        <Text className="mb-1 text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
          {t('plants.detail.stats_day')}
        </Text>
        <Text className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
          {dayCount}
        </Text>
      </View>

      {/* Divider */}
      <View className="h-8 w-px bg-neutral-200 dark:bg-white/10" />

      {/* Stat 2: Phase */}
      <View className="flex-1 items-center">
        <Text className="mb-1 text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
          {t('plants.detail.stats_phase')}
        </Text>
        <Text className="text-xl font-bold text-primary-600 dark:text-primary-400">
          {phase}
        </Text>
      </View>
    </View>
  );
}
