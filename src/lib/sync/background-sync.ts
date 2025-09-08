import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';

import { NoopAnalytics } from '@/lib/analytics';
import { isMetered, isOnline } from '@/lib/sync/network-manager';
import { getSyncPrefs } from '@/lib/sync/preferences';
import { runSyncWithRetry } from '@/lib/sync-engine';

const TASK_NAME = 'BACKGROUND_SYNC';

type SyncConstraints = {
  requiresWifi: boolean;
  requiresCharging: boolean; // Not enforceable via JS API; informational only
  minimumBatteryLevel: number; // Not enforceable via JS API; informational only
  minimumIntervalMinutes: number; // Best-effort hint; OS decides actual timing
};

let currentConstraints: SyncConstraints = {
  requiresWifi: false,
  requiresCharging: false,
  minimumBatteryLevel: 0,
  minimumIntervalMinutes: 15,
};

export function setConstraints(next: Partial<SyncConstraints>): void {
  currentConstraints = { ...currentConstraints, ...next };
}

async function shouldExecuteNow(): Promise<boolean> {
  const prefs = getSyncPrefs();
  if (!prefs.backgroundSyncEnabled) return false;
  const online = await isOnline();
  if (!online) return false;
  if (currentConstraints.requiresWifi || prefs.requiresWifi) {
    const metered = await isMetered();
    if (metered) return false;
  }
  return true;
}

// Define the background task handler in module scope (skip in test environment)
if (process.env.NODE_ENV !== 'test') {
  TaskManager.defineTask(TASK_NAME, async () => {
    try {
      const canRun = await shouldExecuteNow();
      if (!canRun) {
        await NoopAnalytics.track('sync_error', {
          stage: 'unknown',
          code: 'bg_constraints_blocked',
        });
        return BackgroundTask.BackgroundTaskResult.Success;
      }

      await runSyncWithRetry(3);
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch {
      await NoopAnalytics.track('sync_error', {
        stage: 'unknown',
        code: 'bg_error',
      });
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

export async function registerBackgroundTask(): Promise<void> {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
  if (isRegistered) return;
  await BackgroundTask.registerTaskAsync(TASK_NAME);
}

export async function unregisterBackgroundTask(): Promise<void> {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
  if (!isRegistered) return;
  await BackgroundTask.unregisterTaskAsync(TASK_NAME);
}

export async function executeBackgroundSyncOnceForTesting(): Promise<void> {
  await BackgroundTask.triggerTaskWorkerForTestingAsync?.();
}

export type { SyncConstraints };
