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
  phaseIndex: number;
  nutrientIndex: number;
  onRemove: () => void;
  testID?: string;
}

export function NutrientRatioInput({
  control,
  phaseIndex,
  nutrientIndex,
  onRemove,
  testID = 'nutrient-ratio',
}: NutrientRatioInputProps) {
  const { t } = useTranslation();

  const unitOptions = [
    { label: t('nutrient.units.mlPerL'), value: 'ml/L' },
    { label: t('nutrient.units.ppm'), value: 'ppm' },
    { label: t('nutrient.units.gPerL'), value: 'g/L' },
  ];

  return (
    <View
      className="mb-3 rounded-lg border border-neutral-300 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-900"
      testID={`${testID}-${nutrientIndex}`}
    >
      <ControlledInput
        control={control}
        name={`phases.${phaseIndex}.nutrients.${nutrientIndex}.nutrient`}
        label={t('nutrient.nutrientName')}
        placeholder={t('nutrient.nutrientPlaceholder')}
        testID={`${testID}-${nutrientIndex}-name`}
      />

      <View className="flex-row gap-2">
        <View className="flex-1">
          <ControlledInput
            control={control}
            name={`phases.${phaseIndex}.nutrients.${nutrientIndex}.value`}
            label={t('nutrient.value')}
            keyboardType="decimal-pad"
            placeholder={t('nutrient.valuePlaceholder')}
            testID={`${testID}-${nutrientIndex}-value`}
          />
        </View>

        <View className="flex-1">
          <ControlledSelect
            control={control}
            name={`phases.${phaseIndex}.nutrients.${nutrientIndex}.unit`}
            label={t('nutrient.unit')}
            options={unitOptions}
            testID={`${testID}-${nutrientIndex}-unit`}
          />
        </View>
      </View>

      <Button
        label={t('common.remove')}
        onPress={onRemove}
        variant="outline"
        className="mt-2"
        testID={`${testID}-${nutrientIndex}-remove`}
      />
    </View>
  );
}
