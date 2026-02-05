import { AppState, InteractionManager } from 'react-native';

import { getItem } from '@/lib/storage';
import { onConnectivityChange } from '@/lib/sync/network-manager';
import { getSyncPrefs } from '@/lib/sync/preferences';
import {
  isSyncPipelineInFlight,
  performSync,
} from '@/lib/sync/sync-coordinator';

type SetupSyncTriggersOptions = {
  onSuccess?: () => void;
};

type SyncState = {
  disposed: boolean;
  scheduledToken: number;
  lastOnline: boolean | null;
  lastAutoSyncAttemptAt: number;
};

const SYNC_DISABLED_UNTIL_KEY = 'sync.disabledUntilMs';

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

function createScheduler(
  state: SyncState,
  deferMs: number
): (task: () => void) => void {
  return (task: () => void) => {
    const token = (state.scheduledToken += 1);
    setTimeout(() => {
      if (state.disposed) return;
      if (token !== state.scheduledToken) return;
      InteractionManager.runAfterInteractions(() => {
        if (state.disposed) return;
        if (token !== state.scheduledToken) return;
        task();
      });
    }, deferMs);
  };
}

function createMaybeRunSync(
  state: SyncState,
  opts: SetupSyncTriggersOptions,
  minInterval: number
): () => Promise<void> {
  return async () => {
    if (state.disposed) return;
    if (isSyncPipelineInFlight()) return;
    const prefs = getSyncPrefs();
    if (!prefs.autoSyncEnabled) return;

    const disabledUntilMs = getItem<number>(SYNC_DISABLED_UNTIL_KEY);
    if (typeof disabledUntilMs === 'number' && disabledUntilMs > Date.now())
      return;

    const now = Date.now();
    if (now - state.lastAutoSyncAttemptAt < minInterval) return;
    state.lastAutoSyncAttemptAt = now;

    try {
      await performSync({
        withRetry: false,
        trackAnalytics: true,
        trigger: 'auto',
      });
      opts.onSuccess?.();
    } catch {
      // noop; retry/backoff is handled inside performSync
    }
  };
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
  const state: SyncState = {
    disposed: false,
    scheduledToken: 0,
    lastOnline: null,
    lastAutoSyncAttemptAt: 0,
  };
  const deferMs = 1500;
  const startupDeferMs = 10_000;
  const minAutoSyncIntervalMs = 60_000;

  const scheduleAfterInteractions = createScheduler(state, deferMs);
  const scheduleAfterStartupIdle = createScheduler(state, startupDeferMs);
  const maybeRunSync = createMaybeRunSync(state, opts, minAutoSyncIntervalMs);

  // Run once on registration (app start)
  scheduleAfterStartupIdle(() => {
    void maybeRunSync();
  });

  // Foreground trigger
  const appStateSub = AppState.addEventListener('change', (next) => {
    const nextState = String(next);
    const wasBackground = lastAppState && lastAppState !== 'active';
    lastAppState = nextState;
    if (nextState === 'active' && wasBackground) {
      scheduleAfterInteractions(() => void maybeRunSync());
    }
  });

  // Connectivity trigger
  const removeNet = onConnectivityChange((netState) => {
    const isOnline =
      netState.isConnected && (netState.isInternetReachable ?? true);
    if (state.lastOnline === null) {
      state.lastOnline = isOnline;
      return;
    }
    const restoredConnectivity = isOnline && !state.lastOnline;
    state.lastOnline = isOnline;
    if (restoredConnectivity) {
      scheduleAfterInteractions(() => {
        void maybeRunSync();
        void maybeProcessImageQueue();
      });
    }
  });

  return () => {
    state.disposed = true;
    try {
      if (appStateSub && 'remove' in appStateSub) appStateSub.remove();
    } catch {}
    try {
      removeNet?.();
    } catch {}
  };
}
