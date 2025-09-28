import React from 'react';

import { Button, Text, View } from '@/components/ui';
import { translate } from '@/lib';

type Props = {
  onRetry: () => void;
  className?: string;
};

export function PlantsErrorCard({
  onRetry,
  className,
}: Props): React.ReactElement {
  return (
    <View
      className={`rounded-2xl border border-warning-200 bg-warning-50 px-4 py-3 dark:border-warning-700 dark:bg-warning-900/30 ${className ?? ''}`}
      testID="plants-error-card"
      accessibilityRole="alert"
      accessibilityLabel={translate('plants.error')}
      accessibilityHint={translate('accessibility.plants.error_card_hint')}
    >
      <Text className="text-sm text-warning-700 dark:text-warning-100">
        {translate('plants.error')}
      </Text>
      <Button
        label={translate('plants.retry')}
        onPress={onRetry}
        variant="ghost"
        testID="plants-error-card-retry"
        className="mt-2 self-start"
        textClassName="text-warning-700 dark:text-warning-100"
      />
    </View>
  );
}
