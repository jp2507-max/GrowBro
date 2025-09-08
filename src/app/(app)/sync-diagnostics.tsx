import React from 'react';

import { Button, ScrollView, Text, View } from '@/components/ui';
import { translate } from '@/lib';
import { clearLogs, getLogs, getMetrics, logEvent } from '@/lib/sync/monitor';
import { runSyncWithRetry } from '@/lib/sync-engine';

type Metrics = ReturnType<typeof getMetrics>;

type LogItem = ReturnType<typeof getLogs>[number];

function DiagnosticsHeader(): React.ReactElement {
  return (
    <View className="mb-4">
      <Text className="text-xl font-bold">
        {translate('diagnostics.title')}
      </Text>
      <Text className="text-neutral-500">
        {translate('diagnostics.subtitle')}
      </Text>
    </View>
  );
}

function DiagnosticsMetrics({
  metrics,
}: {
  metrics: Metrics;
}): React.ReactElement {
  return (
    <View className="mb-4">
      <Text className="text-lg font-semibold">
        {translate('diagnostics.metrics')}
      </Text>
      <Text>
        {translate('diagnostics.last_success_at')}:{' '}
        {metrics.lastSuccessAt
          ? new Date(metrics.lastSuccessAt).toLocaleString()
          : '-'}
      </Text>
      <Text>
        {translate('diagnostics.last_checkpoint_at')}:{' '}
        {metrics.lastCheckpointAt
          ? new Date(metrics.lastCheckpointAt).toLocaleString()
          : '-'}
      </Text>
      <Text>
        {translate('diagnostics.checkpoint_age_ms')}:{' '}
        {metrics.checkpointAgeMs ?? '-'}
      </Text>
      <Text>
        {translate('diagnostics.p50_ms', {
          push: metrics.p50.push ?? '-',
          pull: metrics.p50.pull ?? '-',
          apply: metrics.p50.apply ?? '-',
        })}
      </Text>
      <Text>
        {translate('diagnostics.p95_ms', {
          push: metrics.p95.push ?? '-',
          pull: metrics.p95.pull ?? '-',
          apply: metrics.p95.apply ?? '-',
        })}
      </Text>
      <Text>
        {translate('diagnostics.avg_payload', {
          operation: 'push',
          bytes: metrics.payload.pushAvgBytes ?? '-',
        })}
        ,{' '}
        {translate('diagnostics.avg_payload', {
          operation: 'pull',
          bytes: metrics.payload.pullAvgBytes ?? '-',
        })}
      </Text>
    </View>
  );
}

function DiagnosticsActions({
  onSyncNow,
  onClear,
}: {
  onSyncNow: () => void;
  onClear: () => void;
}): React.ReactElement {
  return (
    <View className="mb-4 flex-row gap-4">
      <Button
        label={translate('diagnostics.sync_now')}
        onPress={onSyncNow}
        accessibilityLabel={translate('diagnostics.sync_now')}
      />
      <Button
        label={translate('diagnostics.clear_logs')}
        variant="outline"
        onPress={onClear}
        accessibilityLabel={translate('diagnostics.clear_logs')}
      />
    </View>
  );
}

function DiagnosticsLogs({ logs }: { logs: LogItem[] }): React.ReactElement {
  return (
    <>
      <View className="mb-2">
        <Text className="text-lg font-semibold">
          {translate('diagnostics.logs')}
        </Text>
      </View>
      <View className="mb-12 gap-2">
        {logs.map((l) => (
          <View key={l.id} className="rounded-md border border-neutral-300 p-3">
            <Text className="text-xs text-neutral-500">
              {new Date(l.t).toLocaleString()} • {l.stage} • {l.level}
            </Text>
            <Text className="text-sm">{l.message}</Text>
            {l.code ? (
              <Text className="text-xs">code: {String(l.code)}</Text>
            ) : null}
          </View>
        ))}
      </View>
    </>
  );
}

export default function SyncDiagnostics(): React.ReactElement {
  const [, setRefreshTick] = React.useState(0);
  const metrics = getMetrics();
  const logs = getLogs();

  const onSyncNow = React.useCallback(async (): Promise<void> => {
    try {
      logEvent({ stage: 'total', message: 'manual sync invoked' });
      await runSyncWithRetry(1);
    } catch (e) {
      logEvent({
        level: 'error',
        stage: 'total',
        message: 'manual sync failed',
        data: { error: String(e) },
      });
    } finally {
      setRefreshTick((x) => x + 1);
    }
  }, []);

  const onClear = React.useCallback((): void => {
    clearLogs();
    setRefreshTick((x) => x + 1);
  }, []);

  return (
    <ScrollView className="flex-1 px-4 py-8">
      <DiagnosticsHeader />
      <DiagnosticsMetrics metrics={metrics} />
      <DiagnosticsActions onSyncNow={onSyncNow} onClear={onClear} />
      <DiagnosticsLogs logs={logs} />
    </ScrollView>
  );
}
