import { AppState } from 'react-native';

import { onConnectivityChange } from '@/lib/sync/network-manager';
import { getSyncPrefs } from '@/lib/sync/preferences';
import { isSyncInFlight, runSyncWithRetry } from '@/lib/sync-engine';

type SetupSyncTriggersOptions = {
  onSuccess?: () => void;
};

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
      await runSyncWithRetry(1, { trigger: 'auto' });
      opts.onSuccess?.();
    } catch {
      // noop; retry/backoff is handled inside runSyncWithRetry
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
    }
  });

  return () => {
    disposed = true;
    try {
      (appStateSub as any)?.remove?.();
    } catch {}
    try {
      removeNet?.();
    } catch {}
  };
}
