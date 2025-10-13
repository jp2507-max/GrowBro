/**
 * Range Input Pair Component
 *
 * Min/max inputs for pH or EC ranges
 */

import type { Control, FieldValues, Path } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { ControlledInput, Text, View } from '@/components/ui';

type RangeInputPairProps<TFormValues extends FieldValues> = {
  control: Control<TFormValues>;
  label: string;
  minName: Path<TFormValues>;
  maxName: Path<TFormValues>;
  minPlaceholder: string;
  maxPlaceholder: string;
  testID: string;
};

export function RangeInputPair<TFormValues extends FieldValues>({
  control,
  label,
  minName,
  maxName,
  minPlaceholder,
  maxPlaceholder,
  testID,
}: RangeInputPairProps<TFormValues>): JSX.Element {
  const { t } = useTranslation();

  return (
    <View className="mb-3">
      <Text className="mb-2 text-base font-medium text-neutral-700 dark:text-neutral-300">
        {label}
      </Text>
      <View className="flex-row gap-2">
        <View className="flex-1">
          <ControlledInput
            control={control}
            name={minName}
            label={t('nutrient.min')}
            keyboardType="decimal-pad"
            placeholder={minPlaceholder}
            testID={`${testID}-min`}
          />
        </View>
        <View className="flex-1">
          <ControlledInput
            control={control}
            name={maxName}
            label={t('nutrient.max')}
            keyboardType="decimal-pad"
            placeholder={maxPlaceholder}
            testID={`${testID}-max`}
          />
        </View>
      </View>
    </View>
  );
}
