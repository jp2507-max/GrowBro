/**
 * Phases List Component
 *
 * Dynamic list of phases with add/remove functionality
 */

import React from 'react';
import type { Control, FieldArrayWithId } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button, Text, View } from '@/components/ui';
import type { FeedingTemplateFormData } from '@/lib/nutrient-engine/schemas/feeding-template-schema';

import { PhaseEditor } from './phase-editor';

interface PhasesListProps {
  control: Control<FeedingTemplateFormData>;
  fields: FieldArrayWithId<FeedingTemplateFormData, 'phases', 'id'>[];
  onAddPhase: () => void;
  onRemovePhase: (index: number) => void;
  testID: string;
}

export function PhasesList({
  control,
  fields,
  onAddPhase,
  onRemovePhase,
  testID,
}: PhasesListProps): JSX.Element {
  const { t } = useTranslation();

  return (
    <View className="mb-4">
      <Text className="mb-3 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
        {t('nutrient.phases')}
      </Text>

      {fields.map((field, index) => (
        <PhaseEditor
          key={field.id}
          control={control}
          nutrients={field.nutrients}
          phaseIndex={index}
          onRemove={() => onRemovePhase(index)}
          testID={testID}
        />
      ))}

      <Button
        label={t('nutrient.addPhase')}
        onPress={onAddPhase}
        variant="outline"
        testID={`${testID}-add-phase`}
      />
    </View>
  );
}
