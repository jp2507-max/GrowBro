import React from 'react';

import { Text, View } from '@/components/ui';
import { translate } from '@/lib';

type Props = {
  isVisible: boolean;
};

export function StrainsOfflineBanner({
  isVisible,
}: Props): React.ReactElement | null {
  if (!isVisible) return null;

  return (
    <View
      className="mb-3 rounded-xl border border-warning-200 bg-warning-50 px-4 py-2 dark:border-warning-800 dark:bg-warning-900/20"
      testID="strains-offline-banner"
      accessibilityRole="alert"
      accessibilityLabel={translate('strains.offline_notice')}
      accessibilityHint={translate('accessibility.strains.offline_banner_hint')}
    >
      <Text className="text-sm text-warning-700 dark:text-warning-100">
        {translate('strains.offline_notice')}
      </Text>
    </View>
  );
}
