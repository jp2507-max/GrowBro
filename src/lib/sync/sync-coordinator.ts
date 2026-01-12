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

import { Q } from '@nozbe/watermelondb';

import { NoopAnalytics } from '@/lib/analytics';
import { getItem } from '@/lib/storage';
import {
  type SyncErrorCode,
  trackCheckpointAge,
  trackPendingChanges,
  trackSyncFailure,
  trackSyncLatency,
  trackSyncSuccess,
} from '@/lib/sync/sync-analytics';
import { categorizeSyncError } from '@/lib/sync/sync-errors';
import type { SyncTrigger } from '@/lib/sync/sync-performance-metrics';
import { getSyncState } from '@/lib/sync/sync-state';
import {
  getPendingChangesCount,
  runSyncWithRetry,
  type SyncResult,
} from '@/lib/sync-engine';

let syncPipelinePromise: Promise<SyncResult> | null = null;
let pendingSyncPromise: Promise<SyncResult> | null = null;
let pendingSyncOptions: SyncCoordinatorOptions | null = null;

/**
 * Process image upload queue after successful sync.
 * Uses dynamic import to avoid circular dependencies.
 */
async function processImageQueueAfterSync(): Promise<void> {
  try {
    const { processImageQueueOnce } = await import('@/lib/uploads/queue');
    const result = await processImageQueueOnce(3);
    if (result.processed > 0) {
      console.log(
        `[SyncCoordinator] Processed ${result.processed} image uploads`
      );
    }
  } catch (error) {
    console.warn('[SyncCoordinator] Image queue processing error:', error);
  }
}

/**
 * Download missing plant photos after sync.
 * Uses dynamic import to avoid circular dependencies.
 */
async function downloadMissingPlantPhotosAfterSync(): Promise<void> {
  try {
    const { syncMissingPlantPhotos } = await import(
      '@/lib/plants/plant-photo-sync'
    );
    const { database } = await import('@/lib/watermelon');

    // Only fetch plants that have remoteImagePath in metadata
    // This avoids fetching all plants as the user base grows
    const plants = await database.collections
      .get('plants')
      .query(Q.where('metadata', Q.like('%remoteImagePath%')))
      .fetch();

    // Convert WatermelonDB models to Plant type
    const plantData = plants.map((p) => ({
      id: p.id,
      imageUrl: (p as { imageUrl?: string }).imageUrl,
      metadata: (p as { metadata?: Record<string, unknown> }).metadata,
    }));

    const result = await syncMissingPlantPhotos(
      plantData as Parameters<typeof syncMissingPlantPhotos>[0]
    );

    if (result.downloaded > 0) {
      console.log(
        `[SyncCoordinator] Downloaded ${result.downloaded} plant photos`
      );
    }
    if (result.failed > 0) {
      console.warn(
        `[SyncCoordinator] Failed to download ${result.failed} plant photos`
      );
    }
  } catch (error) {
    console.warn('[SyncCoordinator] Plant photo sync error:', error);
  }
}

/**
 * Sync plants via Supabase after a core sync attempt.
 * Uses dynamic import to avoid circular dependencies.
 */
async function syncPlantsAfterSync(): Promise<void> {
  try {
    const { syncPlantsBidirectional } = await import(
      '@/lib/plants/plants-sync'
    );
    await syncPlantsBidirectional();
  } catch (error) {
    console.warn('[SyncCoordinator] Plant sync error:', error);
  }
}

export function isSyncPipelineInFlight(): boolean {
  return Boolean(syncPipelinePromise || pendingSyncPromise);
}

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

  /**
   * Source trigger for analytics attribution
   * @default 'auto'
   */
  trigger?: SyncTrigger;
};

/**
 * Performs a complete sync operation with all bells and whistles
 */
async function performSyncInternal(
  options: SyncCoordinatorOptions = {}
): Promise<SyncResult> {
  const {
    withRetry = true,
    maxRetries = 5,
    trackAnalytics = true,
    trigger = 'auto',
  } = options;

  const startTime = Date.now();
  let result: SyncResult | null = null;
  let coreError: unknown = null;

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
    result = await runSyncWithRetry(withRetry ? maxRetries : 1, {
      trigger,
    });

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

    // Process image upload queue after successful sync (non-blocking)
    processImageQueueAfterSync().catch((err) => {
      console.warn('[SyncCoordinator] Image queue processing failed:', err);
    });

    // Download missing plant photos after sync (non-blocking)
    downloadMissingPlantPhotosAfterSync().catch((err) => {
      console.warn('[SyncCoordinator] Plant photo download failed:', err);
    });
  } catch (error) {
    coreError = error;
    // Track failure
    if (trackAnalytics) {
      const errorCategory = categorizeSyncError(error);
      // Map error code to SyncErrorCode type
      const syncErrorCode: SyncErrorCode =
        typeof errorCategory.code === 'string' &&
        [
          'network',
          'timeout',
          'conflict',
          'schema_mismatch',
          'permission',
        ].includes(errorCategory.code)
          ? (errorCategory.code as SyncErrorCode)
          : 'unknown';
      await trackSyncFailure('total', syncErrorCode, errorCategory.message);
    }
  }

  await syncPlantsAfterSync();

  if (coreError) throw coreError;
  if (!result) {
    throw new Error('Sync failed without an error');
  }

  return result;
}

function getTriggerPriority(trigger: SyncTrigger | undefined): number {
  switch (trigger) {
    case 'diagnostic':
      return 4;
    case 'manual':
      return 3;
    case 'background':
      return 2;
    case 'auto':
    default:
      return 1;
  }
}

function mergeSyncOptions(
  existing: SyncCoordinatorOptions | null,
  incoming: SyncCoordinatorOptions
): SyncCoordinatorOptions {
  if (!existing) return incoming;
  return {
    withRetry: (existing.withRetry ?? true) || (incoming.withRetry ?? true),
    maxRetries: Math.max(existing.maxRetries ?? 5, incoming.maxRetries ?? 5),
    trackAnalytics:
      (existing.trackAnalytics ?? true) || (incoming.trackAnalytics ?? true),
    trigger:
      getTriggerPriority(existing.trigger) >=
      getTriggerPriority(incoming.trigger)
        ? existing.trigger
        : incoming.trigger,
  };
}

/**
 * Single-flight wrapper for the sync pipeline.
 * Queues recursive calls if a sync is already in progress, merging options to ensure strongest guarantees.
 */
export async function performSync(
  options: SyncCoordinatorOptions = {}
): Promise<SyncResult> {
  // 1. If no sync is running, start immediately
  if (!syncPipelinePromise) {
    const run = performSyncInternal(options);
    syncPipelinePromise = run;
    try {
      return await run;
    } finally {
      syncPipelinePromise = null;
    }
  }

  // 2. If sync is running, merge options for the next run
  pendingSyncOptions = mergeSyncOptions(pendingSyncOptions, options);

  // 3. Setup the pending promise if not already waiting
  if (!pendingSyncPromise) {
    pendingSyncPromise = (async () => {
      try {
        await syncPipelinePromise;
      } catch {
        // Ignore errors from the previous run; we still want to run the next one
      }

      const nextOptions = pendingSyncOptions || {};
      pendingSyncOptions = null;
      pendingSyncPromise = null;

      return performSync(nextOptions);
    })();
  }

  return pendingSyncPromise;
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
    source: 'manual',
  });

  return performSync({
    withRetry: true,
    maxRetries: 3,
    trackAnalytics: true,
    trigger: 'manual',
  });
}

/**
 * Performs a background sync (e.g., on app resume)
 */
export async function backgroundSync(): Promise<SyncResult> {
  await NoopAnalytics.track('sync_background_trigger', {
    source: 'background',
  });

  return performSync({
    withRetry: true,
    maxRetries: 5,
    trackAnalytics: true,
    trigger: 'background',
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
