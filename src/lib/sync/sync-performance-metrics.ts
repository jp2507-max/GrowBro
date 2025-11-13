import { type AnalyticsEvents, NoopAnalytics } from '@/lib/analytics';
import { getMetrics, recordDuration } from '@/lib/sync/monitor';

type NullableNumber = number | null | undefined;

export type SyncTrigger = 'manual' | 'auto' | 'background' | 'diagnostic';

export type SyncPerformanceSnapshotParams = {
  trigger: SyncTrigger;
  attempt: number;
  totalDurationMs: number;
};

function assignMetric(
  target: Record<string, string | number>,
  key: string,
  value: NullableNumber
): void {
  if (typeof value === 'number' && Number.isFinite(value)) {
    target[key] = Math.round(value);
  }
}

export async function emitSyncPerformanceSnapshot(
  params: SyncPerformanceSnapshotParams
): Promise<void> {
  const snapshot: AnalyticsEvents['sync_metrics_snapshot'] = {
    trigger: params.trigger,
    attempt: params.attempt,
    total_ms: Math.round(params.totalDurationMs),
  };

  const metrics = getMetrics();
  const { p50, p95, payload, checkpointAgeMs } = metrics;

  if (p50) {
    assignMetric(snapshot, 'push_p50_ms', p50.push);
    assignMetric(snapshot, 'pull_p50_ms', p50.pull);
    assignMetric(snapshot, 'apply_p50_ms', p50.apply);
    assignMetric(snapshot, 'total_p50_ms', p50.total);
  }

  if (p95) {
    assignMetric(snapshot, 'push_p95_ms', p95.push);
    assignMetric(snapshot, 'pull_p95_ms', p95.pull);
    assignMetric(snapshot, 'apply_p95_ms', p95.apply);
    assignMetric(snapshot, 'total_p95_ms', p95.total);
  }

  if (payload) {
    assignMetric(snapshot, 'payload_push_avg_bytes', payload.pushAvgBytes);
    assignMetric(snapshot, 'payload_pull_avg_bytes', payload.pullAvgBytes);
  }

  assignMetric(snapshot, 'checkpoint_age_ms', checkpointAgeMs);

  try {
    await NoopAnalytics.track('sync_metrics_snapshot', snapshot);
  } catch (error) {
    if (__DEV__) {
      console.warn('[sync] failed to emit performance snapshot', error);
    }
  }
}

export function recordTotalDuration(ms: number): void {
  recordDuration('total', ms);
}
