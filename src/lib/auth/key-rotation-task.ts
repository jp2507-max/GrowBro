/**
 * Background Task for Encryption Key Rotation
 *
 * Runs daily to check if encryption key rotation is needed.
 * Shows notifications to users when rotation is required.
 *
 * @module lib/auth/key-rotation-task
 */

// The background fetch module is provided by Expo native runtime. In test/node
// environments it may not be resolvable; silence the unresolved import lint rule.
import * as BackgroundFetch from 'expo-background-fetch';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';

import {
  checkKeyRotationStatus,
  shouldShowRotationWarning,
} from './key-rotation';

const KEY_ROTATION_CHECK_TASK = 'KEY_ROTATION_CHECK_TASK';

/**
 * Define the background task
 */
TaskManager.defineTask(KEY_ROTATION_CHECK_TASK, async () => {
  try {
    console.log('[key-rotation-task] Running background check...');

    const status = await checkKeyRotationStatus();

    // Show notification if rotation is needed
    if (shouldShowRotationWarning(status)) {
      await showRotationWarningNotification(status.daysUntilExpiry);
    }

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error('[key-rotation-task] Background task failed:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
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

    if (!isRegistered) {
      await BackgroundFetch.registerTaskAsync(KEY_ROTATION_CHECK_TASK, {
        minimumInterval: 60 * 60 * 24, // 24 hours
        stopOnTerminate: false,
        startOnBoot: true,
      });

      console.log('[key-rotation-task] Background task registered');
    }
  } catch (error) {
    console.error('[key-rotation-task] Failed to register task:', error);
  }
}

/**
 * Unregister the background task
 */
export async function unregisterKeyRotationTask(): Promise<void> {
  try {
    await BackgroundFetch.unregisterTaskAsync(KEY_ROTATION_CHECK_TASK);
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
