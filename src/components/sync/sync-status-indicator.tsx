import React from 'react';
import { ActivityIndicator } from 'react-native';

import { Text, View } from '@/components/ui';
import { colors } from '@/components/ui/colors';
import { useSyncState } from '@/lib/sync/sync-state';

type SyncStatusIndicatorProps = {
  showLabel?: boolean;
  size?: 'small' | 'large';
};

export function SyncStatusIndicator({
  showLabel = true,
  size = 'small',
}: SyncStatusIndicatorProps) {
  const syncInFlight = useSyncState.use.syncInFlight();

  if (!syncInFlight) {
    return null;
  }

  return (
    <View className="flex-row items-center gap-2">
      <ActivityIndicator
        size={size}
        color={colors.primary[600]}
        testID="sync-status-indicator"
      />
      {showLabel && (
        <Text
          className="text-sm text-neutral-600 dark:text-neutral-400"
          tx="community.sync.status.syncing"
        />
      )}
    </View>
  );
}
