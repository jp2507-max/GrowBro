/**
 * Hook to automatically sync favorites when network becomes available
 */

import { useEffect, useRef, useState } from 'react';
import { InteractionManager } from 'react-native';

import { useNetworkStatus } from '@/lib/hooks/use-network-status';
import { isSyncPipelineInFlight } from '@/lib/sync/sync-coordinator';

import { useFavorites } from './use-favorites';

/**
 * Hook that automatically syncs favorites when:
 * - App comes back online
 * - App comes to foreground (if online)
 */
const MIN_SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes

type FavoritesAutoSyncState = {
  isSyncing: boolean;
  syncError: string | null;
  lastSyncAttempt: number;
};

export function useFavoritesAutoSync(): FavoritesAutoSyncState {
  const { isInternetReachable } = useNetworkStatus();
  const fullSync = useFavorites.use.fullSync();
  const isSyncing = useFavorites.use.isSyncing();
  const syncError = useFavorites.use.syncError();
  const wasOfflineRef = useRef(!isInternetReachable);
  const isSyncScheduledRef = useRef(false);
  const [lastSyncAttempt, setLastSyncAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const now = Date.now();
    const timeSinceLastSync = now - lastSyncAttempt;
    const justCameOnline = wasOfflineRef.current && isInternetReachable;

    const shouldSync =
      isInternetReachable &&
      !isSyncing &&
      !isSyncPipelineInFlight() &&
      (justCameOnline || timeSinceLastSync > MIN_SYNC_INTERVAL);

    if (shouldSync && !isSyncScheduledRef.current) {
      console.info('[useFavoritesAutoSync] Triggering auto-sync');
      setLastSyncAttempt(now);
      isSyncScheduledRef.current = true;

      InteractionManager.runAfterInteractions(() => {
        if (cancelled) return;
        void fullSync()
          .catch((error: Error) => {
            console.error('[useFavoritesAutoSync] Auto-sync failed:', error);
          })
          .finally(() => {
            isSyncScheduledRef.current = false;
          });
      });
    }

    wasOfflineRef.current = !isInternetReachable;

    return () => {
      cancelled = true;
    };
  }, [isInternetReachable, isSyncing, fullSync, lastSyncAttempt]);

  return {
    isSyncing,
    syncError,
    lastSyncAttempt,
  };
}
