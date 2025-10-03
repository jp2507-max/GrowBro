/**
 * Hook to automatically sync favorites when network becomes available
 */

import { useEffect, useRef } from 'react';

import { useNetworkStatus } from '@/lib/hooks/use-network-status';

import { useFavorites } from './use-favorites';

/**
 * Hook that automatically syncs favorites when:
 * - App comes back online
 * - App comes to foreground (if online)
 */
const MIN_SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes

export function useFavoritesAutoSync() {
  const { isInternetReachable } = useNetworkStatus();
  const fullSync = useFavorites.use.fullSync();
  const isSyncing = useFavorites.use.isSyncing();
  const syncError = useFavorites.use.syncError();
  const wasOfflineRef = useRef(!isInternetReachable);
  const lastSyncAttemptRef = useRef(0);

  useEffect(() => {
    const now = Date.now();
    const timeSinceLastSync = now - lastSyncAttemptRef.current;
    const justCameOnline = !wasOfflineRef.current && isInternetReachable;

    const shouldSync =
      isInternetReachable &&
      !isSyncing &&
      (justCameOnline || timeSinceLastSync > MIN_SYNC_INTERVAL);

    if (shouldSync) {
      console.info('[useFavoritesAutoSync] Triggering auto-sync');
      lastSyncAttemptRef.current = now;

      void fullSync().catch((error: Error) => {
        console.error('[useFavoritesAutoSync] Auto-sync failed:', error);
      });
    }

    wasOfflineRef.current = !isInternetReachable;
  }, [isInternetReachable, isSyncing, fullSync]);

  return {
    isSyncing,
    syncError,
    lastSyncAttempt: lastSyncAttemptRef.current,
  };
}
