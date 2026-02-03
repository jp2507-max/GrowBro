import { DateTime } from 'luxon';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { Plant } from '@/api/plants/types';
import { Text, View } from '@/components/ui';
import colors from '@/components/ui/colors';
import { Droplet, Sprout } from '@/components/ui/icons';
import {
  getProductStageLabelKey,
  toProductStage,
} from '@/lib/plants/product-stage';

export type PlantStatsGridProps = {
  plant: Plant;
  nextFeedHours?: number | null;
};

/**
 * Glassmorphic stats grid - 3-column card layout
 * Displays Day count, Phase icon, and Next Feed with special teal styling.
 */
export function PlantStatsGrid({
  plant,
  nextFeedHours,
}: PlantStatsGridProps): React.ReactElement {
  const { t } = useTranslation();

  // Calculate days since planted
  const dayCount = React.useMemo(() => {
    if (!plant.plantedAt) return null;
    const plantedDate = DateTime.fromISO(plant.plantedAt);
    if (!plantedDate.isValid) return null;
    const days = Math.floor(DateTime.now().diff(plantedDate, 'days').days);
    return days >= 0 ? days : null;
  }, [plant.plantedAt]);

  // Get phase label
  const phaseLabel = React.useMemo(() => {
    const productStage = toProductStage(plant.stage);
    if (!productStage) return null;
    return getProductStageLabelKey(productStage);
  }, [plant.stage]);

  // Format next feed string
  const nextFeedLabel = React.useMemo(() => {
    if (nextFeedHours === undefined || nextFeedHours === null) return '—';
    if (nextFeedHours === 0) return t('common.now');
    return `${nextFeedHours}h`;
  }, [nextFeedHours, t]);

  return (
    <View className="flex-row gap-3 px-4">
      {/* Stat 1: Age/Day */}
      <View className="flex-1 items-center justify-center rounded-2xl border border-white/5 bg-white/5 p-3">
        <Text className="mb-1 text-xs font-medium uppercase text-neutral-400">
          {t('plants.detail.stats_day')}
        </Text>
        <Text className="text-xl font-bold text-white">
          {dayCount !== null
            ? t('plants.detail.day_count', { count: dayCount })
            : '—'}
        </Text>
      </View>

      {/* Stat 2: Phase - shows icon and phase name */}
      <View className="flex-1 items-center justify-center rounded-2xl border border-white/5 bg-white/5 p-3">
        <Text className="mb-1 text-xs font-medium uppercase text-neutral-400">
          {t('plants.detail.stats_phase')}
        </Text>
        {phaseLabel ? (
          <View className="flex-row items-center gap-1.5">
            <Sprout color={colors.primary[400]} size={18} />
            <Text
              className="text-sm font-semibold text-primary-400"
              numberOfLines={1}
            >
              {t(phaseLabel)}
            </Text>
          </View>
        ) : (
          <Text className="text-xl font-bold text-white">—</Text>
        )}
      </View>

      {/* Stat 3: Next Feed - always highlighted with accent */}
      <View className="flex-1 items-center justify-center overflow-hidden rounded-2xl border border-sky-500/30 bg-sky-500/10 p-3">
        <Text className="mb-1 text-xs font-bold uppercase text-sky-400">
          {t('plants.detail.stats_next_feed')}
        </Text>
        <View className="flex-row items-center gap-1.5">
          <Droplet color={colors.sky[400]} size={20} />
          <Text className="text-xl font-bold text-white">{nextFeedLabel}</Text>
        </View>
      </View>
    </View>
  );
}
