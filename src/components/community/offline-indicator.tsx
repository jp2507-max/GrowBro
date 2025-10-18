/**
 * OfflineIndicator component
 *
 * Banner showing offline status with:
 * - Network connectivity status
 * - Pending sync queue count
 * - Retry sync button when offline
 */

import NetInfo from '@react-native-community/netinfo';
import React from 'react';

import { Button, Text, View } from '@/components/ui';

interface OfflineIndicatorProps {
  onRetrySync?: () => void;
  testID?: string;
}

export function OfflineIndicator({
  onRetrySync,
  testID = 'offline-indicator',
}: OfflineIndicatorProps): React.ReactElement | null {
  const [isOnline, setIsOnline] = React.useState(true);

  React.useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected ?? true);
    });

    return unsubscribe;
  }, []);

  if (isOnline) return null;

  return (
    <View
      className="mx-4 mb-4 rounded-lg bg-warning-100 p-3 dark:bg-warning-900/30"
      testID={testID}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-1">
          <Text
            className="text-sm font-semibold text-warning-900 dark:text-warning-200"
            testID={`${testID}-title`}
            tx="community.offline_title"
          />
          <Text
            className="mt-1 text-xs text-warning-800 dark:text-warning-300"
            testID={`${testID}-message`}
            tx="community.offline_message"
          />
        </View>

        {onRetrySync && (
          <Button
            tx="community.retry_sync"
            onPress={onRetrySync}
            size="sm"
            variant="secondary"
            testID={`${testID}-retry-button`}
          />
        )}
      </View>
    </View>
  );
}
