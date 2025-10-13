import { zodResolver } from '@hookform/resolvers/zod';
import * as React from 'react';
import {
  type Control,
  Controller,
  type FieldErrors,
  useForm,
} from 'react-hook-form';
import { z } from 'zod';

import type { OptionType } from '@/components/ui';
import { Button, Input, Select, Text, View } from '@/components/ui';
import { translate } from '@/lib';
import { GrowingMedium } from '@/lib/nutrient-engine/types';

type ReservoirFormData = {
  name: string;
  volumeL: number;
  medium: string;
  targetPhMin: number;
  targetPhMax: number;
  targetEcMin25c: number;
  targetEcMax25c: number;
  ppmScale: '500' | '700';
  sourceWaterProfileId?: string;
};

type Props = {
  defaultValues?: Partial<ReservoirFormData>;
  waterProfiles?: { id: string; name: string }[];
  onSubmit: (data: ReservoirFormData) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  testID?: string;
};

type PHRangeFieldsProps = {
  control: Control<ReservoirFormData, any>;
  errors: FieldErrors<ReservoirFormData>;
};

type ECRangeFieldsProps = {
  control: Control<ReservoirFormData, any>;
  errors: FieldErrors<ReservoirFormData>;
};

type BasicInfoFieldsProps = {
  control: Control<ReservoirFormData, any>;
  errors: FieldErrors<ReservoirFormData>;
  mediumOptions: OptionType[];
};

type ConfigFieldsProps = {
  control: Control<ReservoirFormData, any>;
  waterProfileOptions: OptionType[];
};

const ppmScaleOptions: OptionType[] = [
  { value: '500', label: 'PPM 500 (NaCl/TDS)' },
  { value: '700', label: 'PPM 700 (442/KCl)' },
];

function PHRangeFields({ control, errors }: PHRangeFieldsProps) {
  return (
    <>
      <Text className="mt-2 text-sm font-medium text-neutral-700">
        {translate('nutrient.reservoir.targetPh')}
      </Text>
      <View className="flex-row gap-2">
        <Controller
          control={control}
          name="targetPhMin"
          render={({ field: { onChange, value } }) => (
            <Input
              label={translate('nutrient.reservoir.min')}
              keyboardType="decimal-pad"
              value={value?.toString() ?? ''}
              onChangeText={(text) => onChange(parseFloat(text))}
              error={errors.targetPhMin?.message}
              className="flex-1"
              testID="ph-min-input"
            />
          )}
        />
        <Controller
          control={control}
          name="targetPhMax"
          render={({ field: { onChange, value } }) => (
            <Input
              label={translate('nutrient.reservoir.max')}
              keyboardType="decimal-pad"
              value={value?.toString() ?? ''}
              onChangeText={(text) => onChange(parseFloat(text))}
              error={errors.targetPhMax?.message}
              className="flex-1"
              testID="ph-max-input"
            />
          )}
        />
      </View>
    </>
  );
}

function ECRangeFields({ control, errors }: ECRangeFieldsProps) {
  return (
    <>
      <Text className="mt-2 text-sm font-medium text-neutral-700">
        {translate('nutrient.reservoir.targetEc')}
      </Text>
      <View className="flex-row gap-2">
        <Controller
          control={control}
          name="targetEcMin25c"
          render={({ field: { onChange, value } }) => (
            <Input
              label={translate('nutrient.reservoir.min')}
              keyboardType="decimal-pad"
              value={value?.toString() ?? ''}
              onChangeText={(text) => onChange(parseFloat(text))}
              error={errors.targetEcMin25c?.message}
              className="flex-1"
              testID="ec-min-input"
            />
          )}
        />
        <Controller
          control={control}
          name="targetEcMax25c"
          render={({ field: { onChange, value } }) => (
            <Input
              label={translate('nutrient.reservoir.max')}
              keyboardType="decimal-pad"
              value={value?.toString() ?? ''}
              onChangeText={(text) => onChange(parseFloat(text))}
              error={errors.targetEcMax25c?.message}
              className="flex-1"
              testID="ec-max-input"
            />
          )}
        />
      </View>
    </>
  );
}

function BasicInfoFields({
  control,
  errors,
  mediumOptions,
}: BasicInfoFieldsProps) {
  return (
    <>
      <Controller
        control={control}
        name="name"
        render={({ field: { onChange, value } }) => (
          <Input
            label={translate('nutrient.reservoir.name')}
            placeholder={translate('nutrient.reservoir.namePlaceholder')}
            value={value}
            onChangeText={onChange}
            error={errors.name?.message}
            testID="name-input"
          />
        )}
      />

      <Controller
        control={control}
        name="volumeL"
        render={({ field: { onChange, value } }) => (
          <Input
            label={translate('nutrient.reservoir.volume')}
            placeholder="20"
            keyboardType="number-pad"
            value={value?.toString() ?? ''}
            onChangeText={(text) => onChange(parseInt(text, 10))}
            error={errors.volumeL?.message}
            testID="volume-input"
          />
        )}
      />

      <Controller
        control={control}
        name="medium"
        render={({ field: { onChange, value } }) => (
          <Select
            label={translate('nutrient.reservoir.medium')}
            options={mediumOptions}
            value={value}
            onSelect={(v) => onChange(String(v))}
            testID="medium-select"
          />
        )}
      />
    </>
  );
}

function FormActions({
  onCancel,
  onSubmit,
  isSubmitting,
}: {
  onCancel: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}) {
  return (
    <View className="mt-4 flex-row gap-3">
      <Button
        variant="outline"
        label={translate('settings.cancel')}
        onPress={onCancel}
        className="flex-1"
        testID="cancel-button"
      />
      <Button
        label={translate('settings.save_changes')}
        onPress={onSubmit}
        loading={isSubmitting}
        disabled={isSubmitting}
        className="flex-1"
        testID="submit-button"
      />
    </View>
  );
}

function ConfigFields({ control, waterProfileOptions }: ConfigFieldsProps) {
  return (
    <>
      <Controller
        control={control}
        name="ppmScale"
        render={({ field: { onChange, value } }) => (
          <Select
            label={translate('nutrient.ppm_scale_label')}
            options={ppmScaleOptions}
            value={value}
            onSelect={(v) => onChange(String(v))}
            testID="ppm-scale-select"
          />
        )}
      />

      {waterProfileOptions.length > 0 && (
        <Controller
          control={control}
          name="sourceWaterProfileId"
          render={({ field: { onChange, value } }) => (
            <Select
              label={translate('nutrient.waterProfile.title')}
              options={waterProfileOptions}
              value={value}
              onSelect={(v) => onChange(String(v))}
              testID="water-profile-select"
            />
          )}
        />
      )}
    </>
  );
}

function createReservoirSchema() {
  return z
    .object({
      name: z
        .string()
        .min(1, translate('nutrient.reservoir.validation.nameRequired')),
      volumeL: z.number().min(1).max(10000),
      medium: z.string(),
      targetPhMin: z.number().min(0).max(14),
      targetPhMax: z.number().min(0).max(14),
      targetEcMin25c: z.number().min(0).max(10),
      targetEcMax25c: z.number().min(0).max(10),
      ppmScale: z.enum(['500', '700']),
      sourceWaterProfileId: z.string().optional(),
    })
    .superRefine((data, ctx) => {
      if (data.targetPhMin >= data.targetPhMax) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Minimum pH must be less than maximum pH',
          path: ['targetPhMin'],
        });
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Maximum pH must be greater than minimum pH',
          path: ['targetPhMax'],
        });
      }

      if (data.targetEcMin25c >= data.targetEcMax25c) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Minimum EC must be less than maximum EC',
          path: ['targetEcMin25c'],
        });
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Maximum EC must be greater than minimum EC',
          path: ['targetEcMax25c'],
        });
      }
    });
}

function getMediumOptions(): OptionType[] {
  return [
    { value: GrowingMedium.SOIL, label: translate('nutrient.medium.soil') },
    { value: GrowingMedium.COCO, label: translate('nutrient.medium.coco') },
    { value: GrowingMedium.HYDRO, label: translate('nutrient.medium.hydro') },
    {
      value: GrowingMedium.SOILLESS,
      label: translate('nutrient.medium.soilless'),
    },
  ];
}

export function ReservoirForm({
  defaultValues,
  waterProfiles = [],
  onSubmit,
  onCancel,
  isSubmitting = false,
  testID,
}: Props): React.ReactElement {
  const reservoirSchema = createReservoirSchema();

  const mediumOptions: OptionType[] = getMediumOptions();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ReservoirFormData>({
    resolver: zodResolver(reservoirSchema),
    defaultValues: {
      name: '',
      volumeL: 20,
      medium: GrowingMedium.COCO,
      targetPhMin: 5.8,
      targetPhMax: 6.2,
      targetEcMin25c: 1.0,
      targetEcMax25c: 2.0,
      ppmScale: '500',
      ...defaultValues,
    },
  });

  const waterProfileOptions: OptionType[] = waterProfiles.map((p) => ({
    value: p.id,
    label: p.name,
  }));

  return (
    <View className="gap-4 p-4" testID={testID}>
      <BasicInfoFields
        control={control}
        errors={errors}
        mediumOptions={mediumOptions}
      />
      <PHRangeFields control={control} errors={errors} />
      <ECRangeFields control={control} errors={errors} />
      <ConfigFields
        control={control}
        waterProfileOptions={waterProfileOptions}
      />
      <FormActions
        onCancel={onCancel}
        onSubmit={handleSubmit(onSubmit)}
        isSubmitting={isSubmitting}
      />
    </View>
  );
}
