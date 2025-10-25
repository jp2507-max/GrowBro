import { useEffect, useRef } from 'react';
import { showMessage } from 'react-native-flash-message';

import { offlineQueueManager } from './offline-queue-manager';

/**
 * Hook to manage sync notifications for assessment queue
 * Shows notifications for persistent failures and sync completion
 */
export function useSyncNotifications() {
  const lastFailedCountRef = useRef(0);
  const lastCompletedCountRef = useRef(0);

  useEffect(() => {
    let mounted = true;

    const checkQueueStatus = async () => {
      if (!mounted) return;

      try {
        const status = await offlineQueueManager.getQueueStatus();

        // Notify about persistent failures (failed count increased)
        if (status.failed > lastFailedCountRef.current) {
          const newFailures = status.failed - lastFailedCountRef.current;
          showMessage({
            message: 'Assessment Sync Failed',
            description: `${newFailures} assessment${newFailures > 1 ? 's' : ''} failed to sync. Tap to retry.`,
            type: 'warning',
            duration: 5000,
            onPress: () => {
              void offlineQueueManager.retryFailed();
            },
          });
        }

        // Notify about successful sync (completed count increased significantly)
        if (
          status.completed > lastCompletedCountRef.current + 2 &&
          status.pending === 0 &&
          status.processing === 0
        ) {
          const newCompletions =
            status.completed - lastCompletedCountRef.current;
          showMessage({
            message: 'Assessments Synced',
            description: `${newCompletions} assessment${newCompletions > 1 ? 's' : ''} successfully synced.`,
            type: 'success',
            duration: 3000,
          });
        }

        // Update refs
        lastFailedCountRef.current = status.failed;
        lastCompletedCountRef.current = status.completed;
      } catch (error) {
        console.error('[useSyncNotifications] Failed to check status:', error);
      }
    };

    // Check immediately
    void checkQueueStatus();

    // Check every 30 seconds
    const interval = setInterval(() => {
      void checkQueueStatus();
    }, 30000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);
}

/**
 * Show notification for max retries exceeded
 */
export function notifyMaxRetriesExceeded(count: number): void {
  showMessage({
    message: 'Sync Failed',
    description: `${count} assessment${count > 1 ? 's' : ''} could not be synced after multiple attempts. Please check your connection and try again.`,
    type: 'danger',
    duration: 8000,
    onPress: () => {
      void offlineQueueManager.retryFailed();
    },
  });
}

/**
 * Show notification for network restored
 */
export function notifyNetworkRestored(): void {
  showMessage({
    message: 'Connection Restored',
    description: 'Syncing pending assessments...',
    type: 'info',
    duration: 2000,
  });
}

/**
 * Show notification for sync started
 */
export function notifySyncStarted(count: number): void {
  if (count === 0) return;

  showMessage({
    message: 'Syncing Assessments',
    description: `Processing ${count} pending assessment${count > 1 ? 's' : ''}...`,
    type: 'info',
    duration: 2000,
  });
}
