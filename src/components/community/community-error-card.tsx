import React from 'react';

import { Button, Text, View } from '@/components/ui';
import { translate } from '@/lib';

type Props = {
  onRetry: () => void;
  testID?: string;
};

export function CommunityErrorCard({
  onRetry,
  testID,
}: Props): React.ReactElement {
  return (
    <View
      className="rounded-2xl border border-warning-200 bg-warning-50 px-4 py-3 dark:border-warning-700 dark:bg-warning-900/30"
      testID={testID ?? 'community-error-card'}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      accessibilityLabel={translate('community.load_error')}
    >
      <Text className="text-sm text-warning-700 dark:text-warning-100">
        {translate('community.load_error')}
      </Text>
      <Button
        label={translate('common.retry')}
        onPress={onRetry}
        variant="ghost"
        testID="community-error-card-retry"
        className="mt-2 self-start"
        textClassName="text-warning-700 dark:text-warning-100"
        accessibilityHint={translate('accessibility.common.retry_hint')}
      />
    </View>
  );
}
