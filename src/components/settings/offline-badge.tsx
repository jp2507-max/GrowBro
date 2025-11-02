/**
 * OfflineBadge component
 *
 * Displays an inline badge indicating offline status
 * Requirements: 2.6, 2.9
 */

import React from 'react';

import { Text, View } from '../ui';

interface OfflineBadgeProps {
  testID?: string;
}

export function OfflineBadge({
  testID = 'offline-badge',
}: OfflineBadgeProps): React.ReactElement {
  return (
    <View
      className="rounded-full bg-warning-100 px-2 py-0.5 dark:bg-warning-900"
      testID={testID}
    >
      <Text
        className="text-xs font-medium text-warning-700 dark:text-warning-300"
        tx="settings.offline"
      />
    </View>
  );
}
