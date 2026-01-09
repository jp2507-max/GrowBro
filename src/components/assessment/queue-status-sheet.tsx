import React from 'react';
import { showMessage } from 'react-native-flash-message';

import { Button, Text, View } from '@/components/ui';
import { offlineQueueManager } from '@/lib/assessment/offline-queue-manager';
import { triggerSync } from '@/lib/assessment/sync-scheduler';
import type { TxKeyPath } from '@/lib/i18n';
import { translate } from '@/lib/i18n/utils';
import type { QueueStatus } from '@/types/assessment';

type QueueStatusSheetProps = {
  status?: QueueStatus | null;
  onClose?: () => void;
};

/**
 * Detailed queue status view
 * Shows breakdown of pending/processing/completed/failed requests
 */
export function QueueStatusSheet({
  onClose,
  status: statusProp,
}: QueueStatusSheetProps): React.ReactElement {
  const [status, setStatus] = React.useState<QueueStatus | null>(
    statusProp ?? null
  );
  const [isRetrying, setIsRetrying] = React.useState(false);
  const [isSyncing, setIsSyncing] = React.useState(false);
  const isControlled = statusProp !== undefined;

  const loadStatus = React.useCallback(async (): Promise<void> => {
    try {
      const queueStatus = await offlineQueueManager.getQueueStatus();
      setStatus(queueStatus);
    } catch (error) {
      console.error('Failed to load queue status:', error);
    }
  }, []);

  React.useEffect(() => {
    if (isControlled) {
      setStatus(statusProp ?? null);
      return;
    }

    void loadStatus();

    // Refresh status every 5 seconds
    const interval = setInterval(() => {
      void loadStatus();
    }, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [isControlled, loadStatus, statusProp]);

  const handleRetryFailed = async (): Promise<void> => {
    setIsRetrying(true);
    try {
      await offlineQueueManager.retryFailed();
      await loadStatus();
    } catch (error) {
      console.error('Failed to retry failed assessments:', error);
      showMessage({
        message: translate('assessment.queue.retry_error'),
        type: 'danger',
        duration: 4000,
      });
    } finally {
      setIsRetrying(false);
    }
  };

  const handleSyncNow = async (): Promise<void> => {
    setIsSyncing(true);
    try {
      await triggerSync();
      await loadStatus();
    } catch (error) {
      console.error('Failed to trigger sync:', error);
      showMessage({
        message: translate('assessment.queue.sync_error'),
        type: 'danger',
        duration: 4000,
      });
    } finally {
      setIsSyncing(false);
    }
  };

  if (!status) {
    return (
      <View className="p-4">
        <Text
          tx="assessment.loading"
          className="text-neutral-500"
          testID="queue-status.loading"
        />
      </View>
    );
  }

  return (
    <View className="p-4">
      <View className="mb-4">
        <Text
          tx="assessment.title"
          className="text-xl font-bold text-neutral-900 dark:text-neutral-100"
          testID="queue-status.title"
        />
      </View>

      <StatusBreakdown status={status} />

      <ActionButtons
        status={status}
        isRetrying={isRetrying}
        isSyncing={isSyncing}
        onRetryFailed={handleRetryFailed}
        onSyncNow={handleSyncNow}
        onClose={onClose}
      />

      {status.lastUpdated && (
        <Text
          tx="assessment.last_updated"
          txOptions={{
            time: new Date(status.lastUpdated).toLocaleTimeString(),
          }}
          className="mt-4 text-xs text-neutral-500"
          testID="queue-status.last-updated"
        />
      )}
    </View>
  );
}

type StatusRowProps = {
  id: string;
  tx: TxKeyPath;
  count: number;
  color: 'primary' | 'success' | 'warning' | 'danger';
};

function StatusRow({ id, tx, count, color }: StatusRowProps) {
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
    <View
      className="flex-row items-center justify-between rounded-lg bg-neutral-100 p-3 dark:bg-neutral-800"
      testID={`queue-status-row-${id}`}
    >
      <Text
        tx={tx}
        className="font-medium text-neutral-900 dark:text-neutral-100"
      />
      <View className={`rounded-full px-3 py-1 ${colorClasses[color]}`}>
        <Text className="text-sm font-semibold">{count}</Text>
      </View>
    </View>
  );
}

function StatusBreakdown({ status }: { status: QueueStatus }) {
  const rows: StatusRowProps[] = [
    {
      id: 'pending',
      tx: 'assessment.status.pending' as TxKeyPath,
      count: status.pending,
      color: 'warning',
    },
    {
      id: 'processing',
      tx: 'assessment.status.processing' as TxKeyPath,
      count: status.processing,
      color: 'primary',
    },
    {
      id: 'completed',
      tx: 'assessment.status.completed' as TxKeyPath,
      count: status.completed,
      color: 'success',
    },
    {
      id: 'failed',
      tx: 'assessment.status.failed' as TxKeyPath,
      count: status.failed,
      color: 'danger',
    },
  ];

  if (typeof status.stalled === 'number' && status.stalled > 0) {
    rows.push({
      id: 'stalled',
      tx: 'assessment.status.stalled' as TxKeyPath,
      count: status.stalled,
      color: 'danger',
    });
  }

  return (
    <View className="mb-6 gap-3">
      {rows.map((row) => (
        <StatusRow key={row.id} {...row} />
      ))}
    </View>
  );
}

type ActionButtonsProps = {
  status: QueueStatus;
  isRetrying: boolean;
  isSyncing: boolean;
  onRetryFailed: () => Promise<void>;
  onSyncNow: () => Promise<void>;
  onClose?: () => void;
};

function ActionButtons({
  status,
  isRetrying,
  isSyncing,
  onRetryFailed,
  onSyncNow,
  onClose,
}: ActionButtonsProps) {
  return (
    <View className="gap-2">
      {status.pending > 0 ? (
        <Button
          tx="assessment.sync_now"
          onPress={onSyncNow}
          disabled={isSyncing}
          variant="default"
          testID="queue-status.sync-now"
        />
      ) : null}

      {status.failed > 0 ? (
        <Button
          tx="assessment.retry_failed"
          onPress={onRetryFailed}
          disabled={isRetrying}
          variant="secondary"
          testID="queue-status.retry-failed"
        />
      ) : null}

      {onClose ? (
        <Button
          tx="assessment.close"
          onPress={onClose}
          variant="outline"
          testID="queue-status.close"
        />
      ) : null}
    </View>
  );
}

export default QueueStatusSheet;
