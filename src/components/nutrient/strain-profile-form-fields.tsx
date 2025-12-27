/**
 * Strain Profile Form Fields
 *
 * Extracted form field components for the strain profile save dialog.
 */

import { type Control, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button, Input, Text, View } from '@/components/ui';

export type StrainProfileFormData = {
  name: string;
  notes?: string;
  publishPrivately: boolean;
};

type NameFieldProps = {
  control: Control<StrainProfileFormData>;
  testID: string;
};

export function NameField({ control, testID }: NameFieldProps) {
  const { t } = useTranslation();
  return (
    <Controller
      control={control}
      name="name"
      render={({ field, fieldState }) => (
        <Input
          label={t('nutrient.strainName')}
          placeholder={t('nutrient.strainNamePlaceholder')}
          value={field.value}
          onChangeText={field.onChange}
          error={fieldState.error?.message}
          testID={`${testID}-name`}
        />
      )}
    />
  );
}

type NotesFieldProps = {
  control: Control<StrainProfileFormData>;
  testID: string;
};

export function NotesField({ control, testID }: NotesFieldProps) {
  const { t } = useTranslation();
  return (
    <Controller
      control={control}
      name="notes"
      render={({ field }) => (
        <Input
          label={t('nutrient.notes')}
          placeholder={t('nutrient.strainNotesPlaceholder')}
          value={field.value ?? ''}
          onChangeText={field.onChange}
          multiline
          numberOfLines={3}
          testID={`${testID}-notes`}
        />
      )}
    />
  );
}

type PublishToggleFieldProps = {
  control: Control<StrainProfileFormData>;
  testID: string;
};

export function PublishToggleField({
  control,
  testID,
}: PublishToggleFieldProps) {
  const { t } = useTranslation();
  return (
    <Controller
      control={control}
      name="publishPrivately"
      render={({ field }) => (
        <View className="mt-3 flex-row items-center justify-between">
          <Text className="flex-1 text-sm text-neutral-700 dark:text-neutral-300">
            {t('nutrient.publishPrivately')}
          </Text>
          <Button
            variant={field.value ? 'default' : 'outline'}
            label={field.value ? t('common.yes') : t('common.no')}
            onPress={() => field.onChange(!field.value)}
            testID={`${testID}-publish-toggle`}
          />
        </View>
      )}
    />
  );
}
