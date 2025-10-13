/**
 * Template Form Header Component
 *
 * Title and basic inputs for feeding template form
 */

import type { JSX } from 'react';
import React, { useMemo } from 'react';
import type { Control } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { ControlledInput, Text } from '@/components/ui';
import { ControlledSelect } from '@/components/ui/select';
import type { FeedingTemplateFormData } from '@/lib/nutrient-engine/schemas/feeding-template-schema';
import { GrowingMedium } from '@/lib/nutrient-engine/types';

interface TemplateFormHeaderProps {
  control: Control<FeedingTemplateFormData>;
  isEdit: boolean;
  testID: string;
}

export function TemplateFormHeader({
  control,
  isEdit,
  testID,
}: TemplateFormHeaderProps): JSX.Element {
  const { t } = useTranslation();

  const mediumOptions = useMemo(
    () => [
      { label: t('nutrient.mediumOptions.soil'), value: GrowingMedium.SOIL },
      { label: t('nutrient.mediumOptions.coco'), value: GrowingMedium.COCO },
      { label: t('nutrient.mediumOptions.hydro'), value: GrowingMedium.HYDRO },
      {
        label: t('nutrient.mediumOptions.soilless'),
        value: GrowingMedium.SOILLESS,
      },
      { label: t('nutrient.mediumOptions.peat'), value: GrowingMedium.PEAT },
    ],
    [t]
  );

  return (
    <>
      <Text className="mb-4 text-xl font-semibold text-neutral-900 dark:text-neutral-100">
        {isEdit ? t('nutrient.editTemplate') : t('nutrient.createTemplate')}
      </Text>

      <ControlledInput
        control={control}
        name="name"
        label={t('nutrient.templateName')}
        placeholder={t('nutrient.templateNamePlaceholder')}
        testID={`${testID}-name`}
      />

      <ControlledSelect
        control={control}
        name="medium"
        label={t('nutrient.growingMedium')}
        options={mediumOptions}
        testID={`${testID}-medium`}
      />
    </>
  );
}
