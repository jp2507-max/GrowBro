import { AppState } from 'react-native';

import { onConnectivityChange } from '@/lib/sync/network-manager';
import { getSyncPrefs } from '@/lib/sync/preferences';
import { performSync } from '@/lib/sync/sync-coordinator';
import { isSyncInFlight } from '@/lib/sync-engine';

type SetupSyncTriggersOptions = {
  onSuccess?: () => void;
};

/**
 * Process image upload queue when conditions allow.
 * Non-blocking, errors are logged but don't affect caller.
 */
async function maybeProcessImageQueue(): Promise<void> {
  try {
    const { processImageQueueOnce, cleanupCompletedQueueItems } = await import(
      '@/lib/uploads/queue'
    );
    const result = await processImageQueueOnce(5);
    if (result.processed > 0) {
      console.log(
        `[sync-triggers] Processed ${result.processed} image uploads`
      );
    }

    // Periodically clean up completed queue items (older than 24 hours)
    const cleanedUp = await cleanupCompletedQueueItems();
    if (cleanedUp > 0) {
      console.log(`[sync-triggers] Cleaned up ${cleanedUp} completed uploads`);
    }
  } catch (error) {
    console.warn('[sync-triggers] Image queue processing failed:', error);
  }
}

/**
 * Registers app lifecycle and connectivity triggers that run a sync when:
 * - App starts
 * - App returns to foreground
 * - Connectivity transitions to online (internet reachable)
 * Returns a cleanup function to remove listeners.
 */
export function setupSyncTriggers(
  opts: SetupSyncTriggersOptions = {}
): () => void {
  let lastAppState: string | null = AppState.currentState ?? null;
  let disposed = false;

  async function maybeRunSync(): Promise<void> {
    if (disposed) return;
    if (isSyncInFlight()) return;
    const prefs = getSyncPrefs();
    if (!prefs.autoSyncEnabled) return;
    try {
      await performSync({
        withRetry: false,
        maxRetries: 1,
        trackAnalytics: true,
        trigger: 'auto',
      });
      opts.onSuccess?.();
    } catch {
      // noop; retry/backoff is handled inside performSync
    }
  }

  // Run once on registration (app start)
  void maybeRunSync();

  // Foreground trigger
  const appStateSub = AppState.addEventListener('change', (next) => {
    const nextState = String(next);
    const wasBackground = lastAppState && lastAppState !== 'active';
    lastAppState = nextState;
    if (nextState === 'active' && wasBackground) {
      void maybeRunSync();
    }
  });

  // Connectivity trigger
  const removeNet = onConnectivityChange((state) => {
    if (state.isConnected && state.isInternetReachable) {
      void maybeRunSync();
      // Also try to process image queue on connectivity restore
      // (even if sync is skipped due to prefs, we may still have pending uploads)
      void maybeProcessImageQueue();
    }
  });

  return () => {
    disposed = true;
    try {
      // AppState.addEventListener returns an EventSubscription with remove()
      if (appStateSub && 'remove' in appStateSub) {
        appStateSub.remove();
      }
    } catch {}
    try {
      removeNet?.();
    } catch {}
  };
}
