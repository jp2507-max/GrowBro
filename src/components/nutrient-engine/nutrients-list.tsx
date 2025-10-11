/**
 * Nutrients List Component
 *
 * List of nutrient ratio inputs with add/remove
 */

import React from 'react';
import type { Control } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button, Text, View } from '@/components/ui';

import { NutrientRatioInput } from './nutrient-ratio-input';

interface NutrientsListProps {
  control: Control<any>;
  nutrients: any[];
  onAddNutrient: () => void;
  onRemoveNutrient: (index: number) => void;
  testID: string;
}

export function NutrientsList({
  control,
  nutrients,
  onAddNutrient,
  onRemoveNutrient,
  testID,
}: NutrientsListProps) {
  const { t } = useTranslation();

  return (
    <View className="mb-3">
      <Text className="mb-2 text-base font-medium text-neutral-700 dark:text-neutral-300">
        {t('nutrient.nutrients')}
      </Text>
      {nutrients.map((_, idx) => (
        <NutrientRatioInput
          key={idx}
          control={control}
          index={idx}
          onRemove={() => onRemoveNutrient(idx)}
          testID={`${testID}-nutrient`}
        />
      ))}
      <Button
        label={t('nutrient.addNutrient')}
        onPress={onAddNutrient}
        variant="outline"
        testID={`${testID}-add-nutrient`}
      />
    </View>
  );
}
