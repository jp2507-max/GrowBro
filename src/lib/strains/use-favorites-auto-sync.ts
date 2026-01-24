/**
 * Hook to automatically sync favorites when network becomes available
 */

import { useEffect, useRef, useState } from 'react';
import { InteractionManager } from 'react-native';

import { useNetworkStatus } from '@/lib/hooks/use-network-status';
import { useSyncState } from '@/lib/sync/sync-state';

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

type FavoritesAutoSyncOptions = {
  enabled?: boolean;
};

export function useFavoritesAutoSync(
  options: FavoritesAutoSyncOptions = {}
): FavoritesAutoSyncState {
  const { enabled = true } = options;
  const { isInternetReachable } = useNetworkStatus();
  const fullSync = useFavorites.use.fullSync();
  const isSyncing = useFavorites.use.isSyncing();
  const syncError = useFavorites.use.syncError();
  const pipelineInFlight = useSyncState.use.pipelineInFlight();
  const wasOfflineRef = useRef(!isInternetReachable);
  const isSyncScheduledRef = useRef(false);
  const pendingOnlineSyncRef = useRef(false);
  const isMountedRef = useRef(true);
  const lastSyncAttemptRef = useRef(0);
  const [lastSyncAttempt, setLastSyncAttempt] = useState(0);
  const enabledRef = useRef(enabled);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      pendingOnlineSyncRef.current = false;
      wasOfflineRef.current = !isInternetReachable;
      return;
    }
    const now = Date.now();
    const timeSinceLastSync = now - lastSyncAttemptRef.current;
    const justCameOnline = wasOfflineRef.current && isInternetReachable;
    if (justCameOnline && pipelineInFlight) {
      pendingOnlineSyncRef.current = true;
    }
    const shouldHonorOnlineTransition =
      justCameOnline || pendingOnlineSyncRef.current;

    const shouldSync =
      isInternetReachable &&
      !isSyncing &&
      !pipelineInFlight &&
      (shouldHonorOnlineTransition || timeSinceLastSync > MIN_SYNC_INTERVAL);

    if (shouldSync && !isSyncScheduledRef.current) {
      pendingOnlineSyncRef.current = false;
      console.info('[useFavoritesAutoSync] Triggering auto-sync');
      setLastSyncAttempt(now);
      lastSyncAttemptRef.current = now;
      isSyncScheduledRef.current = true;

      InteractionManager.runAfterInteractions(() => {
        if (!isMountedRef.current) return;
        if (!enabledRef.current) {
          isSyncScheduledRef.current = false;
          return;
        }
        void fullSync()
          .catch((error: Error) => {
            console.error('[useFavoritesAutoSync] Auto-sync failed:', error);
          })
          .finally(() => {
            isSyncScheduledRef.current = false;
          });
      });
    }

    if (!isInternetReachable) {
      pendingOnlineSyncRef.current = false;
    }

    wasOfflineRef.current = !isInternetReachable;
  }, [enabled, isInternetReachable, isSyncing, fullSync, pipelineInFlight]);

  return {
    isSyncing,
    syncError,
    lastSyncAttempt,
  };
}
