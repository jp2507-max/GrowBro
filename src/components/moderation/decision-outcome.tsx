import React from 'react';
import { useTranslation } from 'react-i18next';

import { Text, View } from '@/components/ui';

type DecisionOutcomeProps = {
  decision?: string;
  reasoning?: string;
  testID?: string;
};

export function DecisionOutcome({
  decision,
  reasoning,
  testID,
}: DecisionOutcomeProps): React.ReactElement | null {
  const { t } = useTranslation();
  if (!decision) return null;
  let status: 'success' | 'danger' | 'warning';
  if (decision === 'upheld') {
    status = 'success';
  } else if (decision === 'rejected') {
    status = 'danger';
  } else if (decision === 'partial') {
    status = 'warning';
  } else {
    status = 'warning'; // fallback
  }
  const bgClass =
    status === 'success'
      ? 'bg-success-100 dark:bg-success-900'
      : status === 'danger'
        ? 'bg-danger-100 dark:bg-danger-900'
        : 'bg-warning-100 dark:bg-warning-900';
  const textClass =
    status === 'success'
      ? 'text-success-900 dark:text-success-100'
      : status === 'danger'
        ? 'text-danger-900 dark:text-danger-100'
        : 'text-warning-900 dark:text-warning-100';
  return (
    <View className={`mb-6 rounded-lg p-4 ${bgClass}`} testID={testID}>
      <Text className={`mb-2 text-sm font-bold ${textClass}`}>
        {t(`appeals.decision.${decision}`)}
      </Text>
      {reasoning && <Text className={`text-sm ${textClass}`}>{reasoning}</Text>}
    </View>
  );
}

export default DecisionOutcome;
