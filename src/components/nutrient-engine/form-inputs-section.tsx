/**
 * Form Inputs Section Component
 *
 * Basic pH, EC, temperature, and ATC inputs for measurements
 */

import React from 'react';
import type { Control } from 'react-hook-form';
import { Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button, ControlledInput, Text, View } from '@/components/ui';
import { ControlledSelect } from '@/components/ui/select';
import type { PhEcReadingFormData } from '@/lib/nutrient-engine/schemas/ph-ec-reading-schema';
import { PpmScale } from '@/lib/nutrient-engine/types';

interface FormInputsSectionProps {
  control: Control<PhEcReadingFormData>;
  testID: string;
}

const ppmScaleOptions = [
  { label: '500 (NaCl/TDS)', value: PpmScale.PPM_500 },
  { label: '700 (442/KCl)', value: PpmScale.PPM_700 },
];

export function FormInputsSection({ control, testID }: FormInputsSectionProps) {
  const { t } = useTranslation();

  return (
    <>
      <ControlledInput
        control={control}
        name="ph"
        label={t('nutrient.ph')}
        keyboardType="decimal-pad"
        placeholder="6.5"
        testID={`${testID}-ph`}
      />

      <ControlledInput
        control={control}
        name="ecRaw"
        label={t('nutrient.ecRaw')}
        keyboardType="decimal-pad"
        placeholder="2.0"
        testID={`${testID}-ec-raw`}
      />

      <ControlledInput
        control={control}
        name="tempC"
        label={t('nutrient.temperature')}
        keyboardType="decimal-pad"
        placeholder="22.0"
        testID={`${testID}-temp`}
      />

      <Controller
        control={control}
        name="atcOn"
        render={({ field }) => (
          <View className="mb-4 flex-row items-center">
            <Text className="flex-1 text-base text-neutral-700 dark:text-neutral-300">
              {t('nutrient.atcEnabled')}
            </Text>
            <Button
              label={field.value ? t('common.yes') : t('common.no')}
              onPress={() => field.onChange(!field.value)}
              variant={field.value ? 'default' : 'outline'}
              testID={`${testID}-atc-toggle`}
            />
          </View>
        )}
      />

      <ControlledSelect
        control={control}
        name="ppmScale"
        label={t('nutrient.ppmScale')}
        options={ppmScaleOptions}
        testID={`${testID}-ppm-scale`}
      />
    </>
  );
}
