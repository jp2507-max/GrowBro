/**
 * Trichome Assessment Form Component
 */

import * as React from 'react';
import type { Control, FieldErrors } from 'react-hook-form';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button, Input, Text } from '@/components/ui';

type TrichomeFormData = {
  clearPercent?: number;
  milkyPercent?: number;
  amberPercent?: number;
  notes?: string;
};

type Props = {
  onSubmit: (data: TrichomeFormData) => void | Promise<void>;
  loading?: boolean;
  className?: string;
};

function PercentInput({
  control,
  name,
  label,
  errors,
  t,
}: {
  control: Control<TrichomeFormData>;
  name: keyof TrichomeFormData;
  label: string;
  errors: FieldErrors<TrichomeFormData>;
  t: (key: string, options?: any) => string;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, onBlur, value } }) => (
        <Input
          label={label}
          placeholder={t('trichome.percentPlaceholder', {
            min: 0,
            max: 100,
          })}
          keyboardType="numeric"
          onBlur={onBlur}
          onChangeText={(text) =>
            onChange(isNaN(parseFloat(text)) ? undefined : parseFloat(text))
          }
          value={value?.toString() || ''}
          error={errors[name]?.message}
          testID={`${name}-input`}
        />
      )}
    />
  );
}

function TotalIndicator({ total }: { total: number }) {
  if (total === 0) return null;
  const isValid = total === 100;
  return (
    <View
      className={`mb-4 rounded-md p-2 ${isValid ? 'bg-success-100 dark:bg-success-900' : 'bg-warning-100 dark:bg-warning-900'}`}
    >
      <Text
        className={`text-sm ${isValid ? 'text-success-700 dark:text-success-300' : 'text-warning-700 dark:text-warning-300'}`}
      >
        Total: {total}% {!isValid && '(percentages should add up to 100%)'}
      </Text>
    </View>
  );
}

function Disclaimer({ t }: { t: (key: string) => string }) {
  return (
    <View className="mb-4 rounded-md bg-neutral-100 p-3 dark:bg-charcoal-800">
      <Text className="text-xs italic text-neutral-600 dark:text-neutral-400">
        {t('trichome.assessmentDisclaimer')}
      </Text>
    </View>
  );
}

function NotesInput({
  control,
  t,
}: {
  control: Control<TrichomeFormData>;
  t: (key: string, options?: any) => string;
}) {
  return (
    <View className="mb-4">
      <Controller
        control={control}
        name="notes"
        render={({ field: { onChange, onBlur, value } }) => (
          <Input
            label={t('trichome.notesLabel')}
            placeholder={t('trichome.notesPlaceholder')}
            multiline
            numberOfLines={3}
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
            testID="notes-input"
          />
        )}
      />
    </View>
  );
}

export function TrichomeAssessmentForm({
  onSubmit,
  loading = false,
  className = '',
}: Props) {
  const { t } = useTranslation();
  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<TrichomeFormData>();
  const total =
    (watch('clearPercent') || 0) +
    (watch('milkyPercent') || 0) +
    (watch('amberPercent') || 0);

  return (
    <View className={`${className}`} testID="trichome-assessment-form">
      <Text className="mb-4 text-lg font-semibold text-charcoal-950 dark:text-neutral-100">
        {t('trichome.formTitle')}
      </Text>
      <View className="mb-4">
        <PercentInput
          control={control}
          name="clearPercent"
          label={t('trichome.clearLabel')}
          errors={errors}
          t={t}
        />
      </View>
      <View className="mb-4">
        <PercentInput
          control={control}
          name="milkyPercent"
          label={t('trichome.milkyLabel')}
          errors={errors}
          t={t}
        />
      </View>
      <View className="mb-4">
        <PercentInput
          control={control}
          name="amberPercent"
          label={t('trichome.amberLabel')}
          errors={errors}
          t={t}
        />
      </View>
      <TotalIndicator total={total} />
      <NotesInput control={control} t={t} />
      <Disclaimer t={t} />
      <Button
        label={t('trichome.submitButton')}
        onPress={handleSubmit(onSubmit)}
        loading={loading}
        disabled={loading || total === 0}
        testID="submit-assessment-button"
      />
    </View>
  );
}
