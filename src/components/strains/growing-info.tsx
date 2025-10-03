import * as React from 'react';

import type { GrowCharacteristics } from '@/api';
import { Text, View } from '@/components/ui';
import { translate } from '@/lib';

type Props = {
  grow: GrowCharacteristics;
  testID?: string;
};

function formatFloweringTime(
  flowering_time: GrowCharacteristics['flowering_time']
): string {
  if (flowering_time.label) return flowering_time.label;
  if (flowering_time.min_weeks !== undefined) {
    if (
      flowering_time.max_weeks &&
      flowering_time.max_weeks !== flowering_time.min_weeks
    ) {
      return `${flowering_time.min_weeks}-${flowering_time.max_weeks} ${translate('strains.detail.weeks')}`;
    }
    return `${flowering_time.min_weeks} ${translate('strains.detail.weeks')}`;
  }
  if (flowering_time.max_weeks !== undefined) {
    return `${translate('strains.detail.up_to')} ${flowering_time.max_weeks} ${translate('strains.detail.weeks')}`;
  }
  return translate('strains.detail.not_reported');
}

function formatYield(
  yieldData: GrowCharacteristics['yield']['indoor'] | undefined
): string {
  if (!yieldData) return translate('strains.detail.not_reported');
  if (yieldData.label) return yieldData.label;
  if (yieldData.min_grams !== undefined) {
    if (yieldData.max_grams && yieldData.max_grams !== yieldData.min_grams) {
      return `${yieldData.min_grams}-${yieldData.max_grams}g`;
    }
    return `${yieldData.min_grams}g`;
  }
  if (yieldData.min_oz !== undefined) {
    if (yieldData.max_oz && yieldData.max_oz !== yieldData.min_oz) {
      return `${yieldData.min_oz}-${yieldData.max_oz}oz`;
    }
    return `${yieldData.min_oz}oz`;
  }
  return translate('strains.detail.not_reported');
}

function formatHeight(height: GrowCharacteristics['height']): string {
  if (height.label) return height.label;
  const parts: string[] = [];
  if (height.indoor_cm !== undefined) {
    parts.push(`${translate('strains.detail.indoor')}: ${height.indoor_cm}cm`);
  }
  if (height.outdoor_cm !== undefined) {
    parts.push(
      `${translate('strains.detail.outdoor')}: ${height.outdoor_cm}cm`
    );
  }
  if (parts.length > 0) return parts.join(' • ');
  return translate('strains.detail.not_reported');
}

export const GrowingInfo = React.memo<Props>(({ grow, testID }) => {
  const floweringTimeText = formatFloweringTime(grow.flowering_time);
  const indoorYieldText = formatYield(grow.yield.indoor);
  const outdoorYieldText = formatYield(grow.yield.outdoor);
  const heightText = formatHeight(grow.height);

  return (
    <View
      className="mx-4 mb-4 rounded-2xl bg-white p-4 dark:bg-neutral-900"
      testID={testID}
    >
      <Text className="mb-3 text-base font-semibold text-neutral-900 dark:text-neutral-100">
        {translate('strains.detail.growing_info')}
      </Text>

      <View className="gap-3">
        <View>
          <Text className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            {translate('strains.detail.flowering_time')}
          </Text>
          <Text className="text-sm text-neutral-700 dark:text-neutral-300">
            {floweringTimeText}
          </Text>
        </View>

        <View>
          <Text className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            {translate('strains.detail.yield')}
          </Text>
          <Text className="text-sm text-neutral-700 dark:text-neutral-300">
            {translate('strains.detail.indoor')}: {indoorYieldText}
          </Text>
          <Text className="text-sm text-neutral-700 dark:text-neutral-300">
            {translate('strains.detail.outdoor')}: {outdoorYieldText}
          </Text>
        </View>

        <View>
          <Text className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            {translate('strains.detail.height')}
          </Text>
          <Text className="text-sm text-neutral-700 dark:text-neutral-300">
            {heightText}
          </Text>
        </View>
      </View>
    </View>
  );
});

GrowingInfo.displayName = 'GrowingInfo';
