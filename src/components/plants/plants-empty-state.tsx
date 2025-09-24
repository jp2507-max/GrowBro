import React from 'react';

import { Text, View } from '@/components/ui';
import { translate } from '@/lib';

type Props = {
  query: string;
  showOfflineNotice: boolean;
};

export function PlantsEmptyState({
  query,
  showOfflineNotice,
}: Props): React.ReactElement {
  const messageKey =
    query.length > 0 ? 'plants.no_results' : 'plants.empty_state';

  return (
    <View
      className="flex-1 items-center justify-center gap-3 px-6 py-12"
      testID="plants-empty-state"
      accessibilityRole="summary"
    >
      {showOfflineNotice ? (
        <Text className="text-center text-sm text-warning-700 dark:text-warning-200">
          {translate('plants.offline_notice')}
        </Text>
      ) : null}
      <Text className="text-center text-base text-neutral-600 dark:text-neutral-300">
        {translate(messageKey)}
      </Text>
    </View>
  );
}
