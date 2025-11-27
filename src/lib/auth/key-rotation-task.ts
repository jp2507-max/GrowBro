/**
 * Background Task for Encryption Key Rotation
 *
 * Runs daily to check if encryption key rotation is needed.
 * Shows notifications to users when rotation is required.
 *
 * Uses expo-background-task (replaces deprecated expo-background-fetch).
 *
 * @module lib/auth/key-rotation-task
 */

import * as BackgroundTask from 'expo-background-task';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';

import {
  checkKeyRotationStatus,
  shouldShowRotationWarning,
} from './key-rotation';

const KEY_ROTATION_CHECK_TASK = 'KEY_ROTATION_CHECK_TASK';

/**
 * Define the background task
 * Note: This must be called in global scope, not inside a React component.
 */
TaskManager.defineTask(KEY_ROTATION_CHECK_TASK, async () => {
  try {
    console.log('[key-rotation-task] Running background check...');

    const status = await checkKeyRotationStatus();

    // Show notification if rotation is needed
    if (shouldShowRotationWarning(status)) {
      await showRotationWarningNotification(status.daysUntilExpiry);
    }

    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (error) {
    console.error('[key-rotation-task] Background task failed:', error);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/**
 * Register the background task
 */
export async function registerKeyRotationTask(): Promise<void> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(
      KEY_ROTATION_CHECK_TASK
    );

    if (isRegistered) {
      console.log('[key-rotation-task] Task already registered');
      return;
    }

    // expo-background-task handles scheduling internally
    // iOS: BGTaskScheduler with 'processing' mode
    // Android: WorkManager
    await BackgroundTask.registerTaskAsync(KEY_ROTATION_CHECK_TASK);

    console.log('[key-rotation-task] Background task registered successfully');
  } catch (error) {
    // expo-background-task requires:
    // - iOS: BGTaskSchedulerPermittedIdentifiers and UIBackgroundModes: ['processing'] in Info.plist
    // - Android: No extra configuration needed
    // This is configured in app.config.cjs under ios.infoPlist
    console.warn(
      '[key-rotation-task] Registration failed - iOS requires BGTaskSchedulerPermittedIdentifiers.',
      'Run "npx expo prebuild --clean" if config was recently updated.',
      error
    );
    // Don't rethrow - key rotation is not critical for app function
  }
}

/**
 * Unregister the background task
 */
export async function unregisterKeyRotationTask(): Promise<void> {
  try {
    await BackgroundTask.unregisterTaskAsync(KEY_ROTATION_CHECK_TASK);
    console.log('[key-rotation-task] Background task unregistered');
  } catch (error) {
    console.error('[key-rotation-task] Failed to unregister task:', error);
  }
}

/**
 * Show notification warning about upcoming key rotation
 */
async function showRotationWarningNotification(
  daysRemaining: number
): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Security Update Required',
        body: `Your encryption keys will expire in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}. Please open the app to complete the security update.`,
        data: {
          type: 'key_rotation_warning',
          daysRemaining,
        },
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null, // Show immediately
    });

    console.log(
      `[key-rotation-task] Rotation warning notification sent (${daysRemaining} days)`
    );
  } catch (error) {
    console.error(
      '[key-rotation-task] Failed to show rotation notification:',
      error
    );
  }
}

/**
 * Check rotation status immediately (for manual checks)
 */
export async function checkRotationNow(): Promise<void> {
  try {
    const status = await checkKeyRotationStatus();

    if (status.needsRotation) {
      console.log(
        '[key-rotation-task] Rotation needed! Days until expiry:',
        status.daysUntilExpiry
      );
    } else {
      console.log(
        '[key-rotation-task] No rotation needed. Days until expiry:',
        status.daysUntilExpiry
      );
    }
  } catch (error) {
    console.error('[key-rotation-task] Manual check failed:', error);
  }
}
