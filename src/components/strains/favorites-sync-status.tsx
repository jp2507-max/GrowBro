/**
 * Sync status indicator for favorites
 */

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { colors, Pressable, Text } from '@/components/ui';
import { translate } from '@/lib/i18n/utils';
import { getPendingSyncCount } from '@/lib/strains/favorites-sync-queue';
import { useFavorites } from '@/lib/strains/use-favorites';

interface FavoritesSyncStatusProps {
  testID?: string;
}

export function FavoritesSyncStatus({
  testID = 'favorites-sync-status',
}: FavoritesSyncStatusProps) {
  const isSyncing = useFavorites.use.isSyncing();
  const syncError = useFavorites.use.syncError();
  const fullSync = useFavorites.use.fullSync();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const updatePendingCount = () => {
      getPendingSyncCount()
        .then(setPendingCount)
        .catch((err: Error) => {
          console.error('[FavoritesSyncStatus] Failed to get count:', err);
        });
    };
    updatePendingCount();
    const interval = setInterval(updatePendingCount, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleRetrySync = () => {
    void fullSync().catch((err: Error) => {
      console.error('[FavoritesSyncStatus] Manual sync failed:', err);
    });
  };

  if (pendingCount === 0 && !syncError && !isSyncing) return null;

  return (
    <View testID={testID} className="px-4 py-2">
      {isSyncing ? (
        <View className="flex-row items-center gap-2 rounded-lg bg-sky-50 p-3">
          <ActivityIndicator size="small" color={colors.sky[500]} />
          <Text className="flex-1 text-sm text-sky-800">
            {translate('sync.syncing_favorites')}
          </Text>
        </View>
      ) : syncError ? (
        <Pressable
          onPress={handleRetrySync}
          className="flex-row items-center gap-2 rounded-lg bg-danger-50 p-3"
          accessibilityRole="button"
          accessibilityLabel={translate('sync.retry_sync_label')}
          accessibilityHint={translate('sync.retry_sync_hint')}
        >
          <Text className="text-lg">⚠️</Text>
          <View className="flex-1">
            <Text className="text-sm font-medium text-danger-800">
              {translate('sync.sync_failed')}
            </Text>
            <Text className="text-xs text-danger-700">{syncError}</Text>
          </View>
          <Text className="text-sm text-danger-600">
            {translate('sync.retry_button')}
          </Text>
        </Pressable>
      ) : pendingCount > 0 ? (
        <View className="flex-row items-center gap-2 rounded-lg bg-warning-50 p-3">
          <Text className="text-lg">📤</Text>
          <Text className="flex-1 text-sm text-warning-800">
            {translate(
              pendingCount === 1
                ? 'sync.pending_favorites_one'
                : 'sync.pending_favorites_other',
              { count: pendingCount }
            )}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
