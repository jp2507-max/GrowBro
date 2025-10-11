/**
 * Nutrient Ratio Input Component
 *
 * Input fields for nutrient name, value, and unit
 */

import React from 'react';
import type { Control } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button, ControlledInput, View } from '@/components/ui';
import { ControlledSelect } from '@/components/ui/select';

interface NutrientRatioInputProps {
  control: Control<any>;
  index: number;
  onRemove: () => void;
  testID?: string;
}

const unitOptions = [
  { label: 'ml/L', value: 'ml/L' },
  { label: 'ppm', value: 'ppm' },
  { label: 'g/L', value: 'g/L' },
];

export function NutrientRatioInput({
  control,
  index,
  onRemove,
  testID = 'nutrient-ratio',
}: NutrientRatioInputProps) {
  const { t } = useTranslation();

  return (
    <View
      className="mb-3 rounded-lg border border-neutral-300 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-900"
      testID={`${testID}-${index}`}
    >
      <ControlledInput
        control={control}
        name={`phases.${index}.nutrient`}
        label={t('nutrient.nutrientName')}
        placeholder="N-P-K"
        testID={`${testID}-${index}-name`}
      />

      <View className="flex-row gap-2">
        <View className="flex-1">
          <ControlledInput
            control={control}
            name={`phases.${index}.value`}
            label={t('nutrient.value')}
            keyboardType="decimal-pad"
            placeholder="10"
            testID={`${testID}-${index}-value`}
          />
        </View>

        <View className="flex-1">
          <ControlledSelect
            control={control}
            name={`phases.${index}.unit`}
            label={t('nutrient.unit')}
            options={unitOptions}
            testID={`${testID}-${index}-unit`}
          />
        </View>
      </View>

      <Button
        label={t('common.remove')}
        onPress={onRemove}
        variant="outline"
        className="mt-2"
        testID={`${testID}-${index}-remove`}
      />
    </View>
  );
}
