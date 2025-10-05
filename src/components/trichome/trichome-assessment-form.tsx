/**
 * Trichome Assessment Form Component
 */

import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
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
}: {
  control: any;
  name: keyof TrichomeFormData;
  label: string;
  errors: any;
}) {
  return (
    <Controller
      control={control}
      name={name}
      rules={{
        min: { value: 0, message: 'Must be 0 or greater' },
        max: { value: 100, message: 'Must be 100 or less' },
      }}
      render={({ field: { onChange, onBlur, value } }) => (
        <Input
          label={label}
          placeholder="0-100"
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

function Disclaimer() {
  return (
    <View className="mb-4 rounded-md bg-neutral-100 p-3 dark:bg-charcoal-800">
      <Text className="text-xs italic text-neutral-600 dark:text-neutral-400">
        ⓘ This assessment is for your personal tracking. Results are educational
        and not professional advice.
      </Text>
    </View>
  );
}

function NotesInput({ control }: { control: any }) {
  return (
    <View className="mb-4">
      <Controller
        control={control}
        name="notes"
        render={({ field: { onChange, onBlur, value } }) => (
          <Input
            label="Notes (optional)"
            placeholder="Add any observations..."
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
        Log Trichome Assessment
      </Text>
      <View className="mb-4">
        <PercentInput
          control={control}
          name="clearPercent"
          label="Clear Trichomes (%)"
          errors={errors}
        />
      </View>
      <View className="mb-4">
        <PercentInput
          control={control}
          name="milkyPercent"
          label="Milky/Cloudy Trichomes (%)"
          errors={errors}
        />
      </View>
      <View className="mb-4">
        <PercentInput
          control={control}
          name="amberPercent"
          label="Amber Trichomes (%)"
          errors={errors}
        />
      </View>
      <TotalIndicator total={total} />
      <NotesInput control={control} />
      <Disclaimer />
      <Button
        label="Log Assessment"
        onPress={handleSubmit(onSubmit)}
        loading={loading}
        disabled={loading || total === 0}
        testID="submit-assessment-button"
      />
    </View>
  );
}
