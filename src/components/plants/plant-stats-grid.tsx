import { DateTime } from 'luxon';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { Plant } from '@/api/plants/types';
import { Text, View } from '@/components/ui';

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
    if (!plant.stage) return '—';
    return t(`plants.form.stage.${plant.stage}`);
  }, [plant.stage, t]);

  return (
    <View className="mx-4 flex-row items-center justify-between border-b border-neutral-100 py-6 dark:border-neutral-800">
      {/* Stat 1: Day */}
      <View className="flex-1 items-center">
        <Text className="mb-1 text-xs font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
          {t('plants.detail.stats_day')}
        </Text>
        <Text className="text-2xl font-bold text-[--color-text-primary]">
          {dayCount}
        </Text>
      </View>

      {/* Divider */}
      <View className="h-8 w-px bg-neutral-100 dark:bg-neutral-800" />

      {/* Stat 2: Phase */}
      <View className="flex-1 items-center">
        <Text className="mb-1 text-xs font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
          {t('plants.detail.stats_phase')}
        </Text>
        <Text className="text-xl font-bold text-[--color-action-primary]">
          {phase}
        </Text>
      </View>
    </View>
  );
}
