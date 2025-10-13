/**
 * Phase Header Component
 *
 * Title, phase type selector, and duration input for phase editor
 */

import React from 'react';
import type { Control } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { ControlledInput, Text } from '@/components/ui';
import { ControlledSelect } from '@/components/ui/select';
import { PlantPhase } from '@/lib/nutrient-engine/types';

interface PhaseHeaderProps {
  control: Control<any>;
  phaseIndex: number;
  testID: string;
}

// TODO: Localize phase option labels - move to i18n resources
// Should use: t('nutrient.phaseOptions.seedling'), etc.
const phaseOptions = [
  { label: 'Seedling', value: PlantPhase.SEEDLING },
  { label: 'Vegetative', value: PlantPhase.VEGETATIVE },
  { label: 'Flowering', value: PlantPhase.FLOWERING },
  { label: 'Flush', value: PlantPhase.FLUSH },
];

export function PhaseHeader({ control, phaseIndex, testID }: PhaseHeaderProps) {
  const { t } = useTranslation();

  return (
    <>
      {/* TODO: Use proper interpolation for phase heading */}
      {/* Should use: t('nutrient.phaseTitle', { index: phaseIndex + 1 }) */}
      <Text className="mb-3 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
        {t('nutrient.phase')} {phaseIndex + 1}
      </Text>

      <ControlledSelect
        control={control}
        name={`phases.${phaseIndex}.phase`}
        label={t('nutrient.phaseType')}
        options={phaseOptions}
        testID={`${testID}-${phaseIndex}-type`}
      />

      <ControlledInput
        control={control}
        name={`phases.${phaseIndex}.durationDays`}
        label={t('nutrient.durationDays')}
        keyboardType="number-pad"
        placeholder={t('nutrient.durationPlaceholder')}
        testID={`${testID}-${phaseIndex}-duration`}
      />
    </>
  );
}
