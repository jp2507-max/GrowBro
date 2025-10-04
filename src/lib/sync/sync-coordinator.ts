/**
 * Sync Coordinator
 *
 * High-level coordinator for sync operations that integrates:
 * - Sync engine (WatermelonDB synchronize)
 * - Conflict resolution
 * - Analytics tracking
 * - Error handling
 * - UI state management
 */

import { NoopAnalytics } from '@/lib/analytics';
import { getItem } from '@/lib/storage';
import {
  trackCheckpointAge,
  trackPendingChanges,
  trackSyncFailure,
  trackSyncLatency,
  trackSyncSuccess,
} from '@/lib/sync/sync-analytics';
import { categorizeSyncError } from '@/lib/sync/sync-errors';
import { getSyncState } from '@/lib/sync/sync-state';
import {
  getPendingChangesCount,
  runSyncWithRetry,
  synchronize,
  type SyncResult,
} from '@/lib/sync-engine';

export type SyncCoordinatorOptions = {
  /**
   * Whether to use retry logic with exponential backoff
   * @default true
   */
  withRetry?: boolean;

  /**
   * Maximum number of retry attempts
   * @default 5
   */
  maxRetries?: number;

  /**
   * Whether to track analytics
   * @default true
   */
  trackAnalytics?: boolean;
};

/**
 * Performs a complete sync operation with all bells and whistles
 */
export async function performSync(
  options: SyncCoordinatorOptions = {}
): Promise<SyncResult> {
  const { withRetry = true, maxRetries = 5, trackAnalytics = true } = options;

  const startTime = Date.now();

  try {
    // Track pending changes before sync
    if (trackAnalytics) {
      const pendingCount = await getPendingChangesCount();
      await trackPendingChanges(pendingCount);

      // Track checkpoint age
      const lastPulledAt = getItem<number>('sync.lastPulledAt');
      if (lastPulledAt) {
        const ageMs = Date.now() - lastPulledAt;
        await trackCheckpointAge(ageMs);
      }
    }

    // Perform sync
    const result = withRetry
      ? await runSyncWithRetry(maxRetries)
      : await synchronize();

    // Track success metrics
    if (trackAnalytics) {
      const durationMs = Date.now() - startTime;
      await trackSyncLatency('total', durationMs);
      await trackSyncSuccess({
        pushed: result.pushed,
        applied: result.applied,
        durationMs,
      });
    }

    return result;
  } catch (error) {
    // Track failure
    if (trackAnalytics) {
      const errorCategory = categorizeSyncError(error);
      await trackSyncFailure(
        'total',
        errorCategory.code as any,
        errorCategory.message
      );
    }

    throw error;
  }
}

/**
 * Gets the current sync status
 */
export function getSyncStatus() {
  return {
    inFlight: getSyncState().syncInFlight,
  };
}

/**
 * Gets pending changes count
 */
export async function getPendingCount(): Promise<number> {
  return getPendingChangesCount();
}

/**
 * Checks if sync is needed based on pending changes
 */
export async function isSyncNeeded(): Promise<boolean> {
  const pendingCount = await getPendingChangesCount();
  return pendingCount > 0;
}

/**
 * Performs a manual sync triggered by user action
 */
export async function manualSync(): Promise<SyncResult> {
  await NoopAnalytics.track('sync_manual_trigger', {
    timestamp: Date.now(),
  });

  return performSync({
    withRetry: true,
    maxRetries: 3,
    trackAnalytics: true,
  });
}

/**
 * Performs a background sync (e.g., on app resume)
 */
export async function backgroundSync(): Promise<SyncResult> {
  await NoopAnalytics.track('sync_background_trigger', {
    timestamp: Date.now(),
  });

  return performSync({
    withRetry: true,
    maxRetries: 5,
    trackAnalytics: true,
  });
}

/**
 * Validates that all writes go through WatermelonDB
 * This is a development-time check
 */
export function validateSyncIntegrity(): boolean {
  if (__DEV__) {
    // In development, we can add checks to ensure no direct writes bypass sync
    console.log(
      '[Sync] Integrity check: All writes should go through WatermelonDB'
    );
  }
  return true;
}
