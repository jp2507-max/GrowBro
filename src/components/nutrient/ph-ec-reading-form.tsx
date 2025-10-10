import { zodResolver } from '@hookform/resolvers/zod';
import React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import type { OptionType } from '@/components/ui';
import { Button, Input, Select, Text, View } from '@/components/ui';
import { translate } from '@/lib';
import { QualityFlag } from '@/lib/nutrient-engine/types';
import {
  formatPpmWithScale,
  toEC25,
} from '@/lib/nutrient-engine/utils/conversions';

const ppmScaleOptions: OptionType[] = [
  { value: '500', label: 'PPM 500 (NaCl/TDS)' },
  { value: '700', label: 'PPM 700 (442/KCl)' },
];

// Validation schema per design spec error handling
const readingSchema = z.object({
  ph: z
    .number()
    .min(0, 'pH must be between 0.00 and 14.00')
    .max(14, 'pH must be between 0.00 and 14.00'),
  ecRaw: z
    .number()
    .min(0, 'EC must be between 0.00 and 10.00 mS/cm')
    .max(10, 'EC must be between 0.00 and 10.00 mS/cm'),
  tempC: z
    .number()
    .min(5, 'Temperature must be between 5.00 and 40.00°C')
    .max(40, 'Temperature must be between 5.00 and 40.00°C'),
  atcOn: z.boolean(),
  ppmScale: z.enum(['500', '700']),
  reservoirId: z.string().optional(),
  plantId: z.string().optional(),
  meterId: z.string().optional(),
  note: z.string().optional(),
});

type ReadingFormData = z.infer<typeof readingSchema>;

type Props = {
  onSubmit: (data: ReadingFormData & { ec25c: number }) => void;
  defaultValues?: Partial<ReadingFormData>;
  reservoirs?: { id: string; name: string }[];
  isSubmitting?: boolean;
};

// eslint-disable-next-line max-lines-per-function
export function PhEcReadingForm({
  onSubmit,
  defaultValues,
  reservoirs = [],
  isSubmitting = false,
}: Props): React.ReactElement {
  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ReadingFormData>({
    resolver: zodResolver(readingSchema),
    defaultValues: {
      ppmScale: '500',
      atcOn: false,
      ...defaultValues,
    },
  });

  const ecRaw = watch('ecRaw');
  const tempC = watch('tempC');
  const atcOn = watch('atcOn');
  const ppmScale = watch('ppmScale');

  // Compute EC@25°C when values are available
  const ec25c = React.useMemo(() => {
    if (ecRaw == null || tempC == null) return null;
    try {
      // Skip double correction if ATC is on
      return atcOn ? ecRaw : toEC25(ecRaw, tempC);
    } catch {
      return null;
    }
  }, [ecRaw, tempC, atcOn]);

  // Compute PPM display
  const ppmDisplay = React.useMemo(() => {
    if (ec25c == null) return null;
    const ppm = Math.round(ec25c * (ppmScale === '500' ? 500 : 700));
    return formatPpmWithScale(ppm, ppmScale);
  }, [ec25c, ppmScale]);

  // Quality flags for display
  const qualityFlags = React.useMemo(() => {
    if (!ecRaw || !tempC) return [];

    const flags: QualityFlag[] = [];

    if (!atcOn) {
      flags.push(QualityFlag.NO_ATC);
    }

    if (tempC >= 28) {
      flags.push(QualityFlag.TEMP_HIGH);
    }

    return flags;
  }, [atcOn, tempC, ecRaw]);

  const handleFormSubmit = handleSubmit((data) => {
    if (ec25c == null) return;
    onSubmit({ ...data, ec25c });
  });

  const reservoirOptions: OptionType[] = reservoirs.map((r) => ({
    value: r.id,
    label: r.name,
  }));

  return (
    <View className="gap-4">
      {/* pH Input */}
      <Controller
        control={control}
        name="ph"
        render={({ field: { onChange, value } }) => (
          <Input
            label="pH"
            placeholder="7.0"
            keyboardType="decimal-pad"
            value={value?.toString() ?? ''}
            onChangeText={(text) => {
              const num = parseFloat(text);
              onChange(isNaN(num) ? undefined : num);
            }}
            error={errors.ph?.message}
            testID="ph-input"
          />
        )}
      />

      {/* EC Raw Input */}
      <Controller
        control={control}
        name="ecRaw"
        render={({ field: { onChange, value } }) => (
          <Input
            label="EC (mS/cm)"
            placeholder="2.0"
            keyboardType="decimal-pad"
            value={value?.toString() ?? ''}
            onChangeText={(text) => {
              const num = parseFloat(text);
              onChange(isNaN(num) ? undefined : num);
            }}
            error={errors.ecRaw?.message}
            testID="ec-raw-input"
          />
        )}
      />

      {/* Temperature Input */}
      <Controller
        control={control}
        name="tempC"
        render={({ field: { onChange, value } }) => (
          <Input
            label="Temperature (°C)"
            placeholder="22.0"
            keyboardType="decimal-pad"
            value={value?.toString() ?? ''}
            onChangeText={(text) => {
              const num = parseFloat(text);
              onChange(isNaN(num) ? undefined : num);
            }}
            error={errors.tempC?.message}
            testID="temp-input"
          />
        )}
      />

      {/* ATC Toggle */}
      <View className="flex-row items-center justify-between py-2">
        <Text className="text-base">{translate('nutrient.atc_label')}</Text>
        <Controller
          control={control}
          name="atcOn"
          render={({ field: { onChange, value } }) => (
            <Button
              variant={value ? 'default' : 'outline'}
              label={value ? 'ON' : 'OFF'}
              onPress={() => onChange(!value)}
              testID="atc-toggle"
            />
          )}
        />
      </View>

      {/* PPM Scale Selection */}
      <Controller
        control={control}
        name="ppmScale"
        render={({ field: { onChange, value } }) => (
          <Select
            label="PPM Scale"
            options={ppmScaleOptions}
            value={value}
            onSelect={onChange}
            testID="ppm-scale-select"
          />
        )}
      />

      {/* Computed Values Display */}
      {ec25c != null && (
        <View className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
          <Text className="text-sm font-semibold text-neutral-700">
            Computed Values
          </Text>
          <Text className="mt-1 text-base text-neutral-900">
            EC@25°C: {ec25c.toFixed(2)} mS/cm
          </Text>
          {ppmDisplay && (
            <Text className="mt-1 text-base text-neutral-900">
              {ppmDisplay}
            </Text>
          )}
        </View>
      )}

      {/* Quality Flags Badge */}
      {qualityFlags.length > 0 && (
        <View className="rounded-lg border border-warning-200 bg-warning-50 p-3">
          <Text className="text-sm font-semibold text-warning-700">
            ⚠️ Quality Flags
          </Text>
          {qualityFlags.includes(QualityFlag.NO_ATC) && (
            <Text className="mt-1 text-sm text-warning-800">
              • Manual temperature compensation applied
            </Text>
          )}
          {qualityFlags.includes(QualityFlag.TEMP_HIGH) && (
            <Text className="mt-1 text-sm text-warning-800">
              • Temperature ≥28°C may affect accuracy
            </Text>
          )}
        </View>
      )}

      {/* Reservoir Selection */}
      {reservoirOptions.length > 0 && (
        <Controller
          control={control}
          name="reservoirId"
          render={({ field: { onChange, value } }) => (
            <Select
              label="Reservoir (Optional)"
              options={reservoirOptions}
              value={value}
              onSelect={onChange}
              testID="reservoir-select"
            />
          )}
        />
      )}

      {/* Note Input */}
      <Controller
        control={control}
        name="note"
        render={({ field: { onChange, value } }) => (
          <Input
            label="Note (Optional)"
            placeholder="Any observations..."
            multiline
            numberOfLines={3}
            value={value ?? ''}
            onChangeText={onChange}
            testID="note-input"
          />
        )}
      />

      {/* Submit Button */}
      <Button
        label={translate('nutrient.save_reading')}
        onPress={handleFormSubmit}
        loading={isSubmitting}
        disabled={!ec25c || isSubmitting}
        testID="submit-button"
      />
    </View>
  );
}
