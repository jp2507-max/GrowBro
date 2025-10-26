import React from 'react';

import { Button, Text, View } from '@/components/ui';
import { offlineQueueManager } from '@/lib/assessment/offline-queue-manager';
import { triggerSync } from '@/lib/assessment/sync-scheduler';
import type { QueueStatus } from '@/types/assessment';

type QueueStatusSheetProps = {
  onClose?: () => void;
};

/**
 * Detailed queue status view
 * Shows breakdown of pending/processing/completed/failed requests
 */
export function QueueStatusSheet({ onClose }: QueueStatusSheetProps) {
  const [status, setStatus] = React.useState<QueueStatus | null>(null);
  const [isRetrying, setIsRetrying] = React.useState(false);
  const [isSyncing, setIsSyncing] = React.useState(false);

  const loadStatus = React.useCallback(async () => {
    try {
      const queueStatus = await offlineQueueManager.getQueueStatus();
      setStatus(queueStatus);
    } catch (error) {
      console.error('Failed to load queue status:', error);
    }
  }, []);

  React.useEffect(() => {
    void loadStatus();

    // Refresh status every 5 seconds
    const interval = setInterval(() => {
      void loadStatus();
    }, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [loadStatus]);

  const handleRetryFailed = async () => {
    setIsRetrying(true);
    try {
      await offlineQueueManager.retryFailed();
      await loadStatus();
    } catch (error) {
      console.error('Failed to retry:', error);
    } finally {
      setIsRetrying(false);
    }
  };

  const handleSyncNow = async () => {
    setIsSyncing(true);
    try {
      await triggerSync();
      await loadStatus();
    } catch (error) {
      console.error('Failed to sync:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  if (!status) {
    return (
      <View className="p-4">
        <Text className="text-neutral-500">Loading...</Text>
      </View>
    );
  }

  return (
    <View className="p-4">
      <View className="mb-4">
        <Text className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
          Assessment Queue
        </Text>
      </View>

      <View className="mb-6 gap-3">
        <StatusRow label="Pending" count={status.pending} color="warning" />
        <StatusRow
          label="Processing"
          count={status.processing}
          color="primary"
        />
        <StatusRow label="Completed" count={status.completed} color="success" />
        <StatusRow label="Failed" count={status.failed} color="danger" />
        {status.stalled !== undefined && status.stalled > 0 && (
          <StatusRow label="Stalled" count={status.stalled} color="danger" />
        )}
      </View>

      <View className="gap-2">
        {status.pending > 0 && (
          <Button
            label="Sync Now"
            onPress={handleSyncNow}
            disabled={isSyncing}
            variant="default"
            testID="sync-now-button"
          />
        )}
        {status.failed > 0 && (
          <Button
            label="Retry Failed"
            onPress={handleRetryFailed}
            disabled={isRetrying}
            variant="secondary"
            testID="retry-failed-button"
          />
        )}
        {onClose && (
          <Button
            label="Close"
            onPress={onClose}
            variant="outline"
            testID="close-button"
          />
        )}
      </View>

      {status.lastUpdated && (
        <Text className="mt-4 text-xs text-neutral-500">
          Last updated: {new Date(status.lastUpdated).toLocaleTimeString()}
        </Text>
      )}
    </View>
  );
}

type StatusRowProps = {
  label: string;
  count: number;
  color: 'primary' | 'success' | 'warning' | 'danger';
};

function StatusRow({ label, count, color }: StatusRowProps) {
  const colorClasses = {
    primary:
      'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300',
    success:
      'bg-success-100 text-success-700 dark:bg-success-900 dark:text-success-300',
    warning:
      'bg-warning-100 text-warning-700 dark:bg-warning-900 dark:text-warning-300',
    danger:
      'bg-danger-100 text-danger-700 dark:bg-danger-900 dark:text-danger-300',
  };

  return (
    <View className="flex-row items-center justify-between rounded-lg bg-neutral-100 p-3 dark:bg-neutral-800">
      <Text className="font-medium text-neutral-900 dark:text-neutral-100">
        {label}
      </Text>
      <View className={`rounded-full px-3 py-1 ${colorClasses[color]}`}>
        <Text className="text-sm font-semibold">{count}</Text>
      </View>
    </View>
  );
}
