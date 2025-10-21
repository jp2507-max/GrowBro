import React from 'react';
import { useTranslation } from 'react-i18next';

import { Text, View } from '@/components/ui';

export function DecisionOutcome({
  decision,
  reasoning,
  testID,
}: {
  decision?: string;
  reasoning?: string;
  testID?: string;
}) {
  const { t } = useTranslation();
  if (!decision) return null;
  const upheld = decision === 'upheld';
  return (
    <View
      className={`mb-6 rounded-lg p-4 ${upheld ? 'bg-success-100 dark:bg-success-900' : 'bg-danger-100 dark:bg-danger-900'}`}
      testID={testID}
    >
      <Text
        className={`mb-2 text-sm font-bold ${upheld ? 'text-success-900 dark:text-success-100' : 'text-danger-900 dark:text-danger-100'}`}
      >
        {t(`appeals.decision.${decision}`)}
      </Text>
      {reasoning && (
        <Text
          className={`text-sm ${upheld ? 'text-success-900 dark:text-success-100' : 'text-danger-900 dark:text-danger-100'}`}
        >
          {reasoning}
        </Text>
      )}
    </View>
  );
}

export default DecisionOutcome;
