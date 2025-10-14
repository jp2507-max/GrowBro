/**
 * Computed Values Display Component
 *
 * Displays computed EC@25°C and PPM values
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

import { Text, View } from '@/components/ui';
import type { PpmScale } from '@/lib/nutrient-engine/types';
import { formatPpmWithScale } from '@/lib/nutrient-engine/utils/conversions';

interface ComputedValuesDisplayProps {
  ec25c: number;
  ppm: number;
  ppmScale: PpmScale;
  testID: string;
}

export function ComputedValuesDisplay({
  ec25c,
  ppm,
  ppmScale,
  testID,
}: ComputedValuesDisplayProps) {
  const { t } = useTranslation();

  return (
    <View className="mb-4 rounded-lg bg-primary-50 p-3 dark:bg-primary-900">
      <Text className="mb-1 text-sm font-medium text-primary-900 dark:text-primary-100">
        {t('nutrient.computed')}
      </Text>
      <Text
        className="text-base font-semibold text-primary-700 dark:text-primary-300"
        testID={testID}
      >
        {t('nutrient.computedValue', {
          ec: ec25c.toFixed(2),
          ppm: formatPpmWithScale(ppm, ppmScale),
        })}
      </Text>
    </View>
  );
}
