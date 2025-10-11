/**
 * Feeding Template Form Component
 *
 * Form for creating and editing feeding templates with phases and nutrients
 *
 * Requirements: 1.1, 1.2, 1.6, 4.7
 */

import { zodResolver } from '@hookform/resolvers/zod';
import React from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { ScrollView } from 'react-native';

import { View } from '@/components/ui';
import {
  type FeedingTemplateFormData,
  feedingTemplateSchema,
} from '@/lib/nutrient-engine/schemas/feeding-template-schema';
import { GrowingMedium, PlantPhase } from '@/lib/nutrient-engine/types';

import { PhasesList } from './phases-list';
import { TemplateFormActions } from './template-form-actions';
import { TemplateFormHeader } from './template-form-header';

interface FeedingTemplateFormProps {
  initialData?: Partial<FeedingTemplateFormData>;
  onSubmit: (data: FeedingTemplateFormData) => void;
  onCancel: () => void;
  testID?: string;
}

export function FeedingTemplateForm({
  initialData,
  onSubmit,
  onCancel,
  testID = 'feeding-template-form',
}: FeedingTemplateFormProps) {
  const { control, handleSubmit, formState } = useForm<FeedingTemplateFormData>(
    {
      resolver: zodResolver(feedingTemplateSchema),
      defaultValues: initialData || {
        name: '',
        medium: GrowingMedium.SOILLESS,
        phases: [
          {
            phase: PlantPhase.SEEDLING,
            durationDays: 7,
            nutrients: [],
            phRange: [5.5, 6.5],
            ecRange25c: [0.8, 1.2],
          },
        ],
        isCustom: true,
      },
    }
  );

  const {
    fields: phaseFields,
    append: appendPhase,
    remove: removePhase,
  } = useFieldArray({
    control,
    name: 'phases',
  });

  return (
    <View className="flex-1" testID={testID}>
      <ScrollView className="flex-1">
        <TemplateFormHeader
          control={control}
          isEdit={!!initialData?.name}
          testID={testID}
        />

        <PhasesList
          control={control}
          fields={phaseFields}
          onAddPhase={() =>
            appendPhase({
              phase: PlantPhase.VEGETATIVE,
              durationDays: 14,
              nutrients: [],
              phRange: [5.5, 6.5],
              ecRange25c: [1.2, 1.8],
            })
          }
          onRemovePhase={removePhase}
          testID={testID}
        />
      </ScrollView>

      <TemplateFormActions
        onCancel={onCancel}
        onSubmit={handleSubmit(onSubmit)}
        isValid={formState.isValid}
        testID={testID}
      />
    </View>
  );
}
