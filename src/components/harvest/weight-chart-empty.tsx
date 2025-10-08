/**
 * Weight Chart Empty State
 *
 * Displayed when no harvest data is available
 * Requirement: 4.5 (empty states)
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button, Text } from '@/components/ui';

type Props = {
  onCreateHarvest?: () => void;
  onCreatePress?: () => void;
  variant?: 'no-data' | 'filtered';
  testID?: string;
};

export function WeightChartEmpty({
  onCreateHarvest,
  onCreatePress,
  variant = 'no-data',
  testID,
}: Props) {
  const { t } = useTranslation();

  const message =
    variant === 'no-data' ? t('chart.empty.noData') : t('chart.empty.filtered');

  const guidance =
    variant === 'no-data'
      ? t('chart.empty.noDataGuidance')
      : t('chart.empty.filteredGuidance');

  return (
    <View
      testID={testID}
      className="items-center justify-center rounded-lg border-2 border-dashed border-neutral-300 bg-neutral-50 p-8 dark:border-neutral-700 dark:bg-neutral-900"
    >
      <Text className="mb-2 text-center text-4xl">📊</Text>
      <Text className="mb-2 text-center text-lg font-semibold text-charcoal-950 dark:text-neutral-100">
        {message}
      </Text>
      <Text className="mb-4 text-center text-sm text-neutral-600 dark:text-neutral-400">
        {guidance}
      </Text>

      {variant === 'no-data' && (onCreateHarvest || onCreatePress) && (
        <Button
          label={t('chart.empty.createButton')}
          onPress={onCreateHarvest || onCreatePress}
          testID="create-harvest-button"
        />
      )}
    </View>
  );
}
