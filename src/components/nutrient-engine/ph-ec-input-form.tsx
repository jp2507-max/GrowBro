/**
 * pH/EC Input Form Component
 *
 * Form for logging pH and EC measurements with real-time validation,
 * temperature compensation, and quality indicators
 *
 * Requirements: 2.2, 2.7, 2.8
 */

import { zodResolver } from '@hookform/resolvers/zod';
import React from 'react';
import { useForm } from 'react-hook-form';

import { View } from '@/components/ui';
import { usePhEcComputation } from '@/lib/nutrient-engine/hooks/use-ph-ec-computation';
import type { PhEcReadingFormData } from '@/lib/nutrient-engine/schemas/ph-ec-reading-schema';
import { phEcReadingSchema } from '@/lib/nutrient-engine/schemas/ph-ec-reading-schema';
import type { Calibration } from '@/lib/nutrient-engine/types';
import { PpmScale } from '@/lib/nutrient-engine/types';
import { toEC25 } from '@/lib/nutrient-engine/utils/conversions';

import { ComputedValuesDisplay } from './computed-values-display';
import { FormActions } from './form-actions';
import { FormHeader } from './form-header';
import { FormInputsSection } from './form-inputs-section';
import { NotesInput } from './notes-input';
import { QualitySection } from './quality-section';

interface PhEcInputFormProps {
  onSubmit: (data: PhEcReadingFormData & { ec25c: number }) => void;
  onCancel: () => void;
  calibration?: Calibration;
  plantId?: string;
  reservoirId?: string;
  testID?: string;
}

export function PhEcInputForm({
  onSubmit,
  onCancel,
  calibration,
  plantId,
  reservoirId,
  testID = 'ph-ec-input-form',
}: PhEcInputFormProps) {
  const { control, handleSubmit, watch, formState } =
    useForm<PhEcReadingFormData>({
      resolver: zodResolver(phEcReadingSchema),
      defaultValues: {
        atcOn: false,
        ppmScale: PpmScale.PPM_500,
        plantId,
        reservoirId,
      },
    });

  const watchedValues = watch();
  const { ecRaw, tempC, atcOn, ppmScale } = watchedValues;

  const { ec25c, ppm, qualityFlags, confidence } = usePhEcComputation({
    ecRaw,
    tempC,
    atcOn,
    ppmScale,
    calibration,
  });

  return (
    <View className="flex-1" testID={testID}>
      <FormHeader />

      <FormInputsSection control={control} testID={testID} />

      {ec25c !== null && ppm !== null && (
        <ComputedValuesDisplay
          ec25c={ec25c}
          ppm={ppm}
          ppmScale={ppmScale}
          testID={`${testID}-computed`}
        />
      )}

      {ec25c !== null && (
        <QualitySection
          qualityFlags={qualityFlags}
          confidence={confidence}
          testID={testID}
        />
      )}

      <NotesInput control={control} testID={testID} />

      <FormActions
        onCancel={onCancel}
        onSubmit={handleSubmit((data) => {
          const computedEc25c = data.atcOn
            ? data.ecRaw
            : toEC25(data.ecRaw, data.tempC);
          onSubmit({ ...data, ec25c: computedEc25c });
        })}
        isValid={formState.isValid}
        testID={testID}
      />
    </View>
  );
}
