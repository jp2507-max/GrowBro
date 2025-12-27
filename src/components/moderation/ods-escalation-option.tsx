import React from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Text, View } from '@/components/ui';

export function OdsEscalationOption({
  onEscalate,
  testID,
}: {
  onEscalate?: () => void;
  testID?: string;
}) {
  const { t } = useTranslation();
  return (
    <View
      className="mb-6 rounded-lg border border-primary-300 bg-primary-50 p-4 dark:border-primary-700 dark:bg-primary-950"
      testID={testID}
    >
      <Text className="mb-2 text-sm font-bold text-primary-900 dark:text-primary-100">
        {t('appeals.ods.title')}
      </Text>
      <Text className="mb-4 text-sm text-primary-800 dark:text-primary-200">
        {t('appeals.ods.description')}
      </Text>
      <Button
        variant="default"
        onPress={onEscalate}
        testID={testID ? `${testID}__odsButton` : undefined}
      >
        <Text>{t('appeals.ods.action.escalate')}</Text>
      </Button>
    </View>
  );
}

export default OdsEscalationOption;
