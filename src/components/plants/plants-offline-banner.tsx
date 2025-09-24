import React from 'react';

import { Text, View } from '@/components/ui';
import { translate } from '@/lib';

type Props = {
  isVisible: boolean;
};

export function PlantsOfflineBanner({
  isVisible,
}: Props): React.ReactElement | null {
  if (!isVisible) return null;

  return (
    <View
      className="mb-3 rounded-xl border border-warning-200 bg-warning-50 px-4 py-2 dark:border-warning-800 dark:bg-warning-900/20"
      testID="plants-offline-banner"
      accessibilityRole="alert"
      accessibilityLabel={translate('plants.offline_notice')}
    >
      <Text className="text-sm text-warning-700 dark:text-warning-100">
        {translate('plants.offline_notice')}
      </Text>
    </View>
  );
}
