import React from 'react';

import { ActivityIndicator, Text, View } from '@/components/ui';
import { translate } from '@/lib';
import { getItem } from '@/lib/storage';
import { getPendingChangesCount, isSyncInFlight } from '@/lib/sync-engine';

type Props = {
  className?: string;
  testID?: string;
};

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
  const [pendingCount, setPendingCount] = React.useState<number>(0);
  const [inFlight, setInFlight] = React.useState<boolean>(false);
  const [lastSyncMs, setLastSyncMs] = React.useState<number | null>(
    getItem<number>('sync.lastPulledAt')
  );

  async function refresh(): Promise<void> {
    const [count] = await Promise.all([getPendingChangesCount()]);
    setPendingCount(count);
    setInFlight(isSyncInFlight());
    setLastSyncMs(getItem<number>('sync.lastPulledAt'));
  }

  React.useEffect(() => {
    void refresh();
    const id = setInterval(refresh, 1000);
    return () => clearInterval(id);
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
      {inFlight ? <ActivityIndicator /> : null}
      <Text className="text-xs text-neutral-600">{label}</Text>
    </View>
  );
}
