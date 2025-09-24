import React from 'react';

import { Button, Text, View } from '@/components/ui';
import { translate } from '@/lib';

type Props = {
  onRetry: () => void;
  className?: string;
};

export function StrainsErrorCard({
  onRetry,
  className,
}: Props): React.ReactElement {
  return (
    <View
      className={`rounded-2xl border border-warning-200 bg-warning-50 px-4 py-3 dark:border-warning-700 dark:bg-warning-900/30 ${className ?? ''}`}
      testID="strains-error-card"
      accessibilityRole="alert"
      accessibilityLabel={translate('strains.error')}
    >
      <Text className="text-sm text-warning-700 dark:text-warning-100">
        {translate('strains.error')}
      </Text>
      <Button
        label={translate('strains.retry')}
        onPress={onRetry}
        variant="ghost"
        testID="strains-error-card-retry"
        className="mt-2 self-start"
        textClassName="text-warning-700 dark:text-warning-100"
      />
    </View>
  );
}
