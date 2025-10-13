/**
 * Nutrients List Component
 *
 * List of nutrient ratio inputs with add/remove
 */

import React from 'react';
import type { Control, FieldArrayWithId } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button, Text, View } from '@/components/ui';
import type { FeedingTemplateFormData } from '@/lib/nutrient-engine/schemas/feeding-template-schema';

import { NutrientRatioInput } from './nutrient-ratio-input';

interface NutrientsListProps {
  control: Control<FeedingTemplateFormData>;
  fields: FieldArrayWithId<
    FeedingTemplateFormData,
    `phases.${number}.nutrients`,
    'id'
  >[];
  phaseIndex: number;
  onAddNutrient: () => void;
  onRemoveNutrient: (index: number) => void;
  testID: string;
}

export function NutrientsList({
  control,
  fields,
  phaseIndex,
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
      {fields.map((field, index) => (
        <NutrientRatioInput
          key={field.id}
          control={control}
          phaseIndex={phaseIndex}
          nutrientIndex={index}
          onRemove={() => onRemoveNutrient(index)}
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
