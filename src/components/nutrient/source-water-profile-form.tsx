import { zodResolver } from '@hookform/resolvers/zod';
import React from 'react';
import {
  type Control,
  Controller,
  type FieldErrors,
  useForm,
} from 'react-hook-form';
import { z } from 'zod';

import { Button, Input, Text, View } from '@/components/ui';
import { translate } from '@/lib';

const profileSchema = z.object({
  name: z.string().refine(
    (val) => val.length > 0,
    () => ({
      message: translate('nutrient.waterProfile.form.validation.nameRequired'),
    })
  ),
  baselineEc25c: z.number().min(0).max(5.0),
  alkalinityMgPerL: z.number().min(0).max(500),
  hardnessMgPerL: z.number().min(0).max(1000),
});

type ProfileFormData = z.infer<typeof profileSchema>;

type FieldProps = {
  control: Control<ProfileFormData>;
  errors?: FieldErrors<ProfileFormData>;
};

type Props = {
  defaultValues?: Partial<ProfileFormData>;
  onSubmit: (data: ProfileFormData) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  testID?: string;
};

function BaselineECField({ control, errors }: FieldProps) {
  return (
    <>
      <Controller
        control={control}
        name="baselineEc25c"
        render={({ field: { onChange, value } }) => (
          <Input
            label={translate('nutrient.waterProfile.form.baselineEc')}
            placeholder="0.2"
            keyboardType="decimal-pad"
            value={value?.toString() ?? ''}
            onChangeText={(text) => onChange(parseFloat(text) || 0)}
            error={errors?.baselineEc25c?.message}
            testID="baseline-ec-input"
          />
        )}
      />
      <Text className="text-xs text-neutral-500">
        {translate('nutrient.waterProfile.form.baselineEcHelper')}
      </Text>
    </>
  );
}

function AlkalinityField({ control, errors }: FieldProps) {
  return (
    <>
      <Controller
        control={control}
        name="alkalinityMgPerL"
        render={({ field: { onChange, value } }) => (
          <Input
            label={translate('nutrient.waterProfile.form.alkalinity')}
            placeholder="80"
            keyboardType="number-pad"
            value={value?.toString() ?? ''}
            onChangeText={(text) => onChange(parseInt(text, 10) || 0)}
            error={errors?.alkalinityMgPerL?.message}
            testID="alkalinity-input"
          />
        )}
      />
      <Text className="text-xs text-neutral-500">
        {translate('nutrient.waterProfile.form.alkalinityHelper')}
      </Text>
    </>
  );
}

function HardnessField({ control, errors }: FieldProps) {
  return (
    <>
      <Controller
        control={control}
        name="hardnessMgPerL"
        render={({ field: { onChange, value } }) => (
          <Input
            label={translate('nutrient.waterProfile.form.hardness')}
            placeholder="150"
            keyboardType="number-pad"
            value={value?.toString() ?? ''}
            onChangeText={(text) => onChange(parseInt(text, 10) || 0)}
            error={errors?.hardnessMgPerL?.message}
            testID="hardness-input"
          />
        )}
      />
      <Text className="text-xs text-neutral-500">
        {translate('nutrient.waterProfile.form.hardnessHelper')}
      </Text>
    </>
  );
}

function WaterProfileFormFields({ control, errors }: FieldProps) {
  return (
    <>
      <Controller
        control={control}
        name="name"
        render={({ field: { onChange, value } }) => (
          <Input
            label={translate('nutrient.waterProfile.form.name')}
            placeholder={translate(
              'nutrient.waterProfile.form.namePlaceholder'
            )}
            value={value}
            onChangeText={onChange}
            error={errors?.name?.message}
            testID="name-input"
          />
        )}
      />

      <BaselineECField control={control} errors={errors} />
      <AlkalinityField control={control} errors={errors} />
      <HardnessField control={control} errors={errors} />

      <View className="rounded-lg bg-primary-50 p-3">
        <Text className="text-xs text-primary-900">
          {translate('nutrient.waterProfile.form.educationalNote')}
        </Text>
      </View>
    </>
  );
}

export function SourceWaterProfileForm({
  defaultValues,
  onSubmit,
  onCancel,
  isSubmitting = false,
  testID,
}: Props): React.ReactElement {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: '',
      baselineEc25c: 0,
      alkalinityMgPerL: 0,
      hardnessMgPerL: 0,
      ...defaultValues,
    },
  });

  return (
    <View className="gap-4 p-4" testID={testID}>
      <Text className="text-lg font-semibold text-neutral-900">
        {translate('nutrient.waterProfile.form.name')}
      </Text>

      <WaterProfileFormFields control={control} errors={errors} />

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
          onPress={handleSubmit(onSubmit)}
          loading={isSubmitting}
          disabled={isSubmitting}
          className="flex-1"
          testID="submit-button"
        />
      </View>
    </View>
  );
}
