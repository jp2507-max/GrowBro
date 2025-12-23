/**
 * Use Sync Status Hook
 * React hook for observing sync worker state
 */

import { useEffect, useState } from 'react';

import type { SyncState, SyncStatus } from '../sync/types';

type SyncStatusSource = {
  getStatus: () => SyncStatus;
  subscribeStatus?: (listener: (status: SyncStatus) => void) => () => void;
};

/**
 * Hook to observe sync status
 * Returns current sync state and metadata
 *
 * @param syncWorker - SyncWorker instance (optional)
 * @returns Current sync status
 */
export function useSyncStatus(syncWorker?: SyncStatusSource): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>({
    state: 'idle',
    pendingChanges: 0,
    retryAttempt: 0,
  });

  useEffect(() => {
    if (!syncWorker) {
      return;
    }

    // Prefer event subscription when available
    if (typeof syncWorker.subscribeStatus === 'function') {
      // Seed initial status before subscribing to future updates
      setStatus(syncWorker.getStatus());
      return syncWorker.subscribeStatus(setStatus);
    }

    // Fallback: poll if no event API
    setStatus(syncWorker.getStatus());
    const interval = setInterval(() => setStatus(syncWorker.getStatus()), 1000);
    return () => clearInterval(interval);
  }, [syncWorker]);

  return status;
}

/**
 * Hook for simplified sync state
 * Returns just the current state without metadata
 *
 * @param syncWorker - SyncWorker instance
 * @returns Current sync state
 */
export function useSyncState(syncWorker?: SyncStatusSource): SyncState {
  const status = useSyncStatus(syncWorker);
  return status.state;
}

/**
 * Hook to check if currently syncing
 *
 * @param syncWorker - SyncWorker instance
 * @returns True if syncing
 */
export function useIsSyncing(syncWorker?: SyncStatusSource): boolean {
  const state = useSyncState(syncWorker);
  return state === 'syncing';
}

/**
 * Hook to check if offline
 *
 * @param syncWorker - SyncWorker instance
 * @returns True if offline
 */
export function useIsOffline(syncWorker?: SyncStatusSource): boolean {
  const state = useSyncState(syncWorker);
  return state === 'offline';
}
