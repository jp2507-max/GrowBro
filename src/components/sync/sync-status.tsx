import React from 'react';
import { AppState, InteractionManager } from 'react-native';

import { ActivityIndicator, Text, View } from '@/components/ui';
import { translate } from '@/lib';
import { getItem } from '@/lib/storage';
import { useSyncState } from '@/lib/sync/sync-state';
import { getPendingChangesCount } from '@/lib/sync-engine';
import { cn } from '@/lib/utils';

type Props = {
  className?: string;
  testID?: string;
};

const SYNC_STATUS_POLL_INTERVAL_MS = 5000;
const SYNC_STATUS_STARTUP_DELAY_MS = 8000;
const SYNC_STATUS_FOREGROUND_DELAY_MS = 2000;

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
    let appStateSub: ReturnType<typeof AppState.addEventListener> | null = null;
    let pollToken = 0;

    const refresh = async (): Promise<void> => {
      const token = pollToken;
      try {
        const count = await getPendingChangesCount();
        if (!isMounted || token !== pollToken) return;
        setPendingCount(count);
        setLastSyncMs(getItem<number>('sync.lastPulledAt'));
      } catch (error) {
        if (__DEV__) {
          console.warn('[SyncStatus] Failed to refresh', error);
        }
      }
    };

    const refreshAfterInteractions = async (): Promise<void> => {
      await new Promise<void>((resolve) => {
        InteractionManager.runAfterInteractions(() => {
          void refresh().finally(resolve);
        });
      });
    };

    const loop = async (): Promise<void> => {
      const token = pollToken;
      if (AppState.currentState !== 'active') return;

      await refreshAfterInteractions();
      if (!isMounted || token !== pollToken) return;

      timeoutId = setTimeout(() => {
        void loop();
      }, SYNC_STATUS_POLL_INTERVAL_MS);
    };

    const startPolling = (delayMs: number): void => {
      const token = (pollToken += 1);
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        if (!isMounted || token !== pollToken) return;
        void loop();
      }, delayMs);
    };

    if (AppState.currentState === 'active') {
      startPolling(SYNC_STATUS_STARTUP_DELAY_MS);
    }

    appStateSub = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        startPolling(SYNC_STATUS_FOREGROUND_DELAY_MS);
      }
    });

    return () => {
      isMounted = false;
      pollToken += 1;
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      appStateSub?.remove();
    };
  }, []);

  const label = translate('sync.last_sync_and_pending', {
    time: formatTime(lastSyncMs ?? null),
    count: String(pendingCount),
  });

  return (
    <View
      className={cn('flex-row items-center gap-2 px-3 py-2', className)}
      testID={testID}
    >
      {syncInFlight ? <ActivityIndicator /> : null}
      <Text className="text-xs text-neutral-600 dark:text-neutral-400">
        {label}
      </Text>
    </View>
  );
}
