/**
 * Phase Editor Component
 *
 * Editor for individual feeding phase with nutrients, pH/EC ranges
 */

import React from 'react';
import type { Control } from 'react-hook-form';
import { useFieldArray } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button, View } from '@/components/ui';
import type {
  FeedingTemplateFormData,
  NutrientRatioFormData,
} from '@/lib/nutrient-engine/schemas/feeding-template-schema';

import { NutrientsList } from './nutrients-list';
import { PhaseHeader } from './phase-header';
import { RangeInputPair } from './range-input-pair';

interface PhaseEditorProps {
  control: Control<FeedingTemplateFormData>;
  nutrients: NutrientRatioFormData[];
  phaseIndex: number;
  onRemove: () => void;
  testID?: string;
}

export function PhaseEditor({
  control,
  nutrients: _nutrients,
  phaseIndex,
  onRemove,
  testID = 'phase-editor',
}: PhaseEditorProps) {
  const { t } = useTranslation();

  const {
    fields: nutrientFields,
    append: appendNutrient,
    remove: removeNutrient,
  } = useFieldArray({
    control,
    name: `phases.${phaseIndex}.nutrients`,
  });

  return (
    <View
      className="mb-4 rounded-xl border-2 border-primary-300 bg-white p-4 dark:border-primary-700 dark:bg-charcoal-900"
      testID={`${testID}-${phaseIndex}`}
    >
      <PhaseHeader control={control} phaseIndex={phaseIndex} testID={testID} />

      <RangeInputPair
        control={control}
        label={t('nutrient.phRange')}
        minName={`phases.${phaseIndex}.phRange.0`}
        maxName={`phases.${phaseIndex}.phRange.1`}
        minPlaceholder="5.5"
        maxPlaceholder="6.5"
        testID={`${testID}-${phaseIndex}-ph`}
      />

      <RangeInputPair
        control={control}
        label={t('nutrient.ecRange')}
        minName={`phases.${phaseIndex}.ecRange25c.0`}
        maxName={`phases.${phaseIndex}.ecRange25c.1`}
        minPlaceholder="1.0"
        maxPlaceholder="2.0"
        testID={`${testID}-${phaseIndex}-ec`}
      />

      <NutrientsList
        control={control}
        fields={nutrientFields}
        phaseIndex={phaseIndex}
        onAddNutrient={() =>
          appendNutrient({
            nutrient: '',
            value: 0,
            unit: 'ml/L',
          })
        }
        onRemoveNutrient={removeNutrient}
        testID={`${testID}-${phaseIndex}`}
      />

      <Button
        label={t('nutrient.removePhase')}
        onPress={onRemove}
        variant="outline"
        className="border-danger-400 text-danger-600"
        testID={`${testID}-${phaseIndex}-remove`}
      />
    </View>
  );
}
