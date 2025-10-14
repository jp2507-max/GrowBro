/**
 * Use Sync Status Hook
 * React hook for observing sync worker state
 */

import { useEffect, useState } from 'react';

import type { SyncState, SyncStatus } from '../sync/types';

/**
 * Hook to observe sync status
 * Returns current sync state and metadata
 *
 * @param syncWorker - SyncWorker instance (optional)
 * @returns Current sync status
 */
export function useSyncStatus(syncWorker?: {
  getStatus: () => SyncStatus;
}): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>({
    state: 'idle',
    pendingChanges: 0,
    retryAttempt: 0,
  });

  useEffect(() => {
    if (!syncWorker) {
      return;
    }

    // Initial status
    setStatus(syncWorker.getStatus());

    // Poll for status updates (can be replaced with event-based updates)
    const interval = setInterval(() => {
      setStatus(syncWorker.getStatus());
    }, 1000);

    return () => {
      clearInterval(interval);
    };
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
export function useSyncState(syncWorker?: {
  getStatus: () => SyncStatus;
}): SyncState {
  const status = useSyncStatus(syncWorker);
  return status.state;
}

/**
 * Hook to check if currently syncing
 *
 * @param syncWorker - SyncWorker instance
 * @returns True if syncing
 */
export function useIsSyncing(syncWorker?: {
  getStatus: () => SyncStatus;
}): boolean {
  const state = useSyncState(syncWorker);
  return state === 'syncing';
}

/**
 * Hook to check if offline
 *
 * @param syncWorker - SyncWorker instance
 * @returns True if offline
 */
export function useIsOffline(syncWorker?: {
  getStatus: () => SyncStatus;
}): boolean {
  const state = useSyncState(syncWorker);
  return state === 'offline';
}
