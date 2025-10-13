/**
 * Quality Badge Component
 *
 * Displays quality flags for pH/EC readings with visual indicators
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

import { Text, View } from '@/components/ui';
import type { QualityFlag } from '@/lib/nutrient-engine/types';
import { QualityFlag as QualityFlagEnum } from '@/lib/nutrient-engine/types';

interface QualityBadgeProps {
  flags: QualityFlag[];
  testID?: string;
}

function getFlagColor(flag: QualityFlag): string {
  switch (flag) {
    case QualityFlagEnum.CAL_STALE:
    case QualityFlagEnum.TEMP_HIGH:
      return 'bg-warning-100 border-warning-400 dark:bg-warning-900 dark:border-warning-600';
    case QualityFlagEnum.NO_ATC:
      return 'bg-neutral-100 border-neutral-400 dark:bg-neutral-800 dark:border-neutral-600';
    case QualityFlagEnum.OUTLIER:
      return 'bg-danger-100 border-danger-400 dark:bg-danger-900 dark:border-danger-600';
    default:
      return 'bg-neutral-100 border-neutral-400 dark:bg-neutral-800 dark:border-neutral-600';
  }
}

function getFlagLabel(flag: QualityFlag, t: (key: string) => string): string {
  switch (flag) {
    case QualityFlagEnum.NO_ATC:
      return t('nutrient.qualityFlags.noAtc');
    case QualityFlagEnum.CAL_STALE:
      return t('nutrient.qualityFlags.calStale');
    case QualityFlagEnum.TEMP_HIGH:
      return t('nutrient.qualityFlags.tempHigh');
    case QualityFlagEnum.OUTLIER:
      return t('nutrient.qualityFlags.outlier');
    default:
      return flag;
  }
}

export function QualityBadge({
  flags,
  testID,
}: QualityBadgeProps): React.JSX.Element | null {
  const { t } = useTranslation();

  if (flags.length === 0) {
    return null;
  }

  return (
    <View className="flex-row flex-wrap gap-2" testID={testID}>
      {flags.map((flag) => (
        <View
          key={flag}
          className={`rounded-lg border px-2 py-1 ${getFlagColor(flag)}`}
          testID={`${testID}-${flag}`}
        >
          <Text className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
            {getFlagLabel(flag, t)}
          </Text>
        </View>
      ))}
    </View>
  );
}
