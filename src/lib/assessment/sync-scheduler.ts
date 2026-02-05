import { InteractionManager } from 'react-native';

import { onConnectivityChange } from '@/lib/sync/network-manager';

import { offlineQueueManager } from './offline-queue-manager';
import {
  notifyNetworkRestored,
  notifySyncStarted,
} from './use-sync-notifications';

let syncInterval: ReturnType<typeof setInterval> | null = null;
let connectivityUnsubscribe: (() => void) | null = null;
let isRunning = false;
let wasOffline = false;
let isProcessing = false;
let scheduledProcess: ReturnType<
  typeof InteractionManager.runAfterInteractions
> | null = null;

const SYNC_INTERVAL_MS = 30 * 1000; // 30 seconds

/**
 * Start automatic sync scheduler
 * Monitors network connectivity and processes queue when online
 */
export function startSyncScheduler(): void {
  if (isRunning) {
    return;
  }

  isRunning = true;

  const scheduleProcessQueue = (): void => {
    if (!isRunning) return;
    if (scheduledProcess) return;
    scheduledProcess = InteractionManager.runAfterInteractions(() => {
      scheduledProcess = null;
      if (!isRunning) return;
      void processQueueSafely();
    });
  };

  // Set up periodic sync
  syncInterval = setInterval(() => {
    scheduleProcessQueue();
  }, SYNC_INTERVAL_MS);

  // Set up connectivity change listener
  connectivityUnsubscribe = onConnectivityChange((state) => {
    const isOnline = state.isConnected && state.isInternetReachable;

    // When connectivity is restored, immediately process queue
    if (isOnline && wasOffline) {
      notifyNetworkRestored();
      scheduleProcessQueue();
    }

    wasOffline = !isOnline;
  });

  // Initial sync attempt
  scheduleProcessQueue();
}

/**
 * Stop automatic sync scheduler
 */
export function stopSyncScheduler(): void {
  if (!isRunning) {
    return;
  }

  isRunning = false;

  if (scheduledProcess) {
    scheduledProcess.cancel();
    scheduledProcess = null;
  }

  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }

  if (connectivityUnsubscribe) {
    connectivityUnsubscribe();
    connectivityUnsubscribe = null;
  }
}

/**
 * Process queue with error handling
 */
async function processQueueSafely(): Promise<void> {
  if (isProcessing) {
    console.log(
      '[SyncScheduler] Queue processing already in progress, skipping.'
    );
    return;
  }

  isProcessing = true;
  let pendingCount = 0;

  try {
    // Get queue status before processing
    const statusBefore = await offlineQueueManager.getQueueStatus();
    pendingCount = statusBefore.pending + statusBefore.failed;

    if (pendingCount > 0) {
      notifySyncStarted(pendingCount);
    }

    await offlineQueueManager.processQueue();
  } catch (error) {
    console.error('[SyncScheduler] Failed to process queue:', error);
  } finally {
    isProcessing = false;
  }
}

/**
 * Manually trigger queue processing
 */
export async function triggerSync(): Promise<void> {
  await processQueueSafely();
}

/**
 * Check if sync scheduler is running
 */
export function isSyncSchedulerRunning(): boolean {
  return isRunning;
}
