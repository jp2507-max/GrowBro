import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';

import { NoopAnalytics } from '@/lib/analytics';
import { isMetered, isOnline } from '@/lib/sync/network-manager';
import { getSyncPrefs } from '@/lib/sync/preferences';
import { performSync } from '@/lib/sync/sync-coordinator';

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
    const startedAt = Date.now();
    try {
      const canRun = await shouldExecuteNow();
      if (!canRun) {
        await NoopAnalytics.track('sync_error', {
          stage: 'unknown',
          code: 'bg_constraints_blocked',
        });
        await NoopAnalytics.track('background_worker_metrics', {
          worker: 'sync',
          trigger: 'background_task',
          result: 'blocked',
          duration_ms: Date.now() - startedAt,
          attempt_count: 0,
        });
        return BackgroundTask.BackgroundTaskResult.Success;
      }

      const result = await performSync({
        withRetry: true,
        maxRetries: 3,
        trackAnalytics: false,
        trigger: 'background',
      });

      await NoopAnalytics.track('background_worker_metrics', {
        worker: 'sync',
        trigger: 'background_task',
        result: 'success',
        duration_ms: Date.now() - startedAt,
        attempt_count: result.attempts ?? 1,
      });
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch {
      await NoopAnalytics.track('sync_error', {
        stage: 'unknown',
        code: 'bg_error',
      });
      await NoopAnalytics.track('background_worker_metrics', {
        worker: 'sync',
        trigger: 'background_task',
        result: 'error',
        duration_ms: Date.now() - startedAt,
        attempt_count: 0,
      });
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

export async function registerBackgroundTask(): Promise<void> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
    if (isRegistered) {
      console.log('[background-sync] Task already registered');
      return;
    }
    await BackgroundTask.registerTaskAsync(TASK_NAME);
    console.log('[background-sync] Task registered successfully');
  } catch (error) {
    // iOS requires BGTaskSchedulerPermittedIdentifiers in Info.plist
    // This is configured in app.config.cjs under ios.infoPlist
    // If you see this error, run: npx expo prebuild --clean
    console.warn(
      '[background-sync] Registration failed - iOS requires BGTaskSchedulerPermittedIdentifiers.',
      'Run "npx expo prebuild --clean" if config was recently updated.',
      error
    );
    throw error;
  }
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
