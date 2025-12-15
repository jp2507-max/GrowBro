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
        className="mb-2 text-sm font-medium text-text-primary"
        testID={testID ? `${testID}-label` : 'counter-arguments-input-label'}
      >
        {t('appeals.label.counterArguments')} *
      </Text>
      <Text
        className="mb-2 text-xs text-text-secondary"
        testID={testID ? `${testID}-hint` : 'counter-arguments-input-hint'}
      >
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
        testID={testID ? `${testID}-input` : 'counter-arguments-input-input'}
      />
      <Text
        className="mt-1 text-xs text-text-secondary"
        testID={
          testID ? `${testID}-counter` : 'counter-arguments-input-counter'
        }
      >
        {t('appeals.counter.characterCount', {
          current: value.length,
          max: 5000,
          minimum: 50,
        })}
      </Text>
    </View>
  );
}
