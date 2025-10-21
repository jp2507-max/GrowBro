import React from 'react';
import { useTranslation } from 'react-i18next';

import { Input, Text, View } from '@/components/ui';

type CounterArgumentsInputProps = {
  value: string;
  onChange: (value: string) => void;
};

export function CounterArgumentsInput({
  value,
  onChange,
}: CounterArgumentsInputProps) {
  const { t } = useTranslation();

  return (
    <View className="mb-4">
      <Text className="mb-2 text-sm font-medium text-charcoal-950 dark:text-neutral-100">
        {t('appeals.label.counterArguments')} *
      </Text>
      <Text className="mb-2 text-xs text-neutral-600 dark:text-neutral-400">
        {t('appeals.hint.counterArguments')}
      </Text>
      <Input
        value={value}
        onChangeText={onChange}
        placeholder={t('appeals.placeholder.counterArguments')}
        multiline
        numberOfLines={6}
        className="min-h-[120px]"
        maxLength={5000}
      />
      <Text className="mt-1 text-xs text-neutral-500 dark:text-neutral-500">
        {value.length} / 5000 characters (minimum 50)
      </Text>
    </View>
  );
}
