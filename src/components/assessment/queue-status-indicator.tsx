import React from 'react';

import { Text, View } from '@/components/ui';
import { offlineQueueManager } from '@/lib/assessment/offline-queue-manager';
import type { QueueStatus } from '@/types/assessment';

/**
 * Queue status indicator badge
 * Shows pending/failed count for assessment requests
 */
export function QueueStatusIndicator() {
  const [status, setStatus] = React.useState<QueueStatus | null>(null);

  React.useEffect(() => {
    let mounted = true;

    const loadStatus = async () => {
      try {
        const queueStatus = await offlineQueueManager.getQueueStatus();
        if (mounted) {
          setStatus(queueStatus);
        }
      } catch (error) {
        console.error('Failed to load queue status:', error);
      }
    };

    void loadStatus();

    // Refresh status every 10 seconds
    const interval = setInterval(() => {
      void loadStatus();
    }, 10000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  if (!status) {
    return null;
  }

  const totalPending = status.pending + status.failed;

  if (totalPending === 0) {
    return null;
  }

  return (
    <View className="rounded-full bg-warning-500 px-2 py-1">
      <Text className="text-xs font-semibold text-white">
        {totalPending} pending
      </Text>
    </View>
  );
}
