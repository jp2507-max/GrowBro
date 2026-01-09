import React from 'react';
import { useTranslation } from 'react-i18next';

import { Input, Text, View } from '@/components/ui';

type CounterArgumentsInputProps = {
  value: string;
  onChange: (value: string) => void;
  testID?: string;
};

export function CounterArgumentsInput({
  value,
  onChange,
  testID,
}: CounterArgumentsInputProps): React.ReactElement {
  const { t } = useTranslation();

  return (
    <View className="mb-4" testID={testID ?? 'counter-arguments-input'}>
      <Text
        className="mb-2 text-sm font-medium text-charcoal-900 dark:text-neutral-100"
        testID={testID ? `${testID}-label` : 'counter-arguments-input-label'}
      >
        {t('appeals.label.counter_arguments')} *
      </Text>
      <Text
        className="mb-2 text-xs text-neutral-600 dark:text-neutral-400"
        testID={testID ? `${testID}-hint` : 'counter-arguments-input-hint'}
      >
        {t('appeals.hint.counter_arguments')}
      </Text>
      <Input
        value={value}
        onChangeText={onChange}
        placeholder={t('appeals.placeholder.counter_arguments')}
        multiline
        numberOfLines={6}
        className="min-h-[120px]"
        maxLength={5000}
        testID={testID ? `${testID}-input` : 'counter-arguments-input-input'}
      />
      <Text
        className="mt-1 text-xs text-neutral-600 dark:text-neutral-400"
        testID={
          testID ? `${testID}-counter` : 'counter-arguments-input-counter'
        }
      >
        {t('appeals.counter.character_count', {
          current: value.length,
          max: 5000,
          minimum: 50,
        })}
      </Text>
    </View>
  );
}
