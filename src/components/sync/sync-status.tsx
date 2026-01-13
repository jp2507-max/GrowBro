import React from 'react';

import { ActivityIndicator, Text, View } from '@/components/ui';
import { translate } from '@/lib';
import { getItem } from '@/lib/storage';
import { useSyncState } from '@/lib/sync/sync-state';
import { getPendingChangesCount } from '@/lib/sync-engine';

type Props = {
  className?: string;
  testID?: string;
};

const SYNC_STATUS_POLL_INTERVAL_MS = 5000;

function formatTime(ts: number | null): string {
  if (!ts) return '-';
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function SyncStatus({
  className,
  testID,
}: Props): React.ReactElement | null {
  const syncInFlight = useSyncState.use.syncInFlight();
  const [pendingCount, setPendingCount] = React.useState<number>(0);
  const [lastSyncMs, setLastSyncMs] = React.useState<number | null>(
    getItem<number>('sync.lastPulledAt')
  );

  React.useEffect(() => {
    let isMounted = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const refresh = async (): Promise<void> => {
      try {
        const count = await getPendingChangesCount();
        if (!isMounted) return;
        setPendingCount(count);
        setLastSyncMs(getItem<number>('sync.lastPulledAt'));
      } catch (error) {
        if (__DEV__) {
          console.warn('[SyncStatus] Failed to refresh', error);
        }
      }
    };

    const loop = async (): Promise<void> => {
      await refresh();
      if (!isMounted) return;
      timeoutId = setTimeout(() => {
        void loop();
      }, SYNC_STATUS_POLL_INTERVAL_MS);
    };

    void loop();

    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };
  }, []);

  const label = translate('sync.last_sync_and_pending', {
    time: formatTime(lastSyncMs ?? null),
    count: String(pendingCount),
  });

  return (
    <View
      className={`flex-row items-center gap-2 px-3 py-2 ${className ?? ''}`}
      testID={testID}
    >
      {syncInFlight ? <ActivityIndicator /> : null}
      <Text className="text-xs text-neutral-600">{label}</Text>
    </View>
  );
}
