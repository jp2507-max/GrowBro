import Sanitizer from '@/lib/log-sanitizer';
import { getItem, setItem } from '@/lib/storage';

export type SyncStage = 'push' | 'pull' | 'apply' | 'total' | 'bg' | 'unknown';

export type SyncLogEvent = {
  id: string;
  t: number;
  level: 'info' | 'error';
  stage: SyncStage;
  message: string;
  code?: string | number;
  data?: Record<string, unknown>;
};

type DurationBuckets = Partial<Record<SyncStage, number[]>>;

const MAX_LOGS = 200;
const sanitizer = new Sanitizer();

let logs: SyncLogEvent[] = [];
let durations: DurationBuckets = {};
let payloadSizes: Partial<Record<'push' | 'pull', number[]>> = {};

let _ctr = 0;
function genId(): string {
  _ctr = (_ctr + 1) % 1_000_000;
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}-${_ctr}`;
}

function clampSize(): void {
  if (logs.length > MAX_LOGS) logs = logs.slice(logs.length - MAX_LOGS);
}

export function recordDuration(stage: SyncStage, ms: number): void {
  if (!durations[stage]) durations[stage] = [];
  durations[stage]!.push(Math.max(0, Math.round(ms)));
  // keep only recent 200 samples per stage
  if (durations[stage]!.length > 200) {
    durations[stage] = durations[stage]!.slice(-200);
  }
}

export function recordPayloadSize(kind: 'push' | 'pull', bytes: number): void {
  if (!payloadSizes[kind]) payloadSizes[kind] = [];
  payloadSizes[kind]!.push(Math.max(0, Math.round(bytes)));
  if (payloadSizes[kind]!.length > 200) {
    payloadSizes[kind] = payloadSizes[kind]!.slice(-200);
  }
}

export function logEvent(params: {
  level?: 'info' | 'error';
  stage?: SyncStage;
  message: string;
  code?: string | number;
  data?: Record<string, unknown>;
}): void {
  const now = Date.now();
  const { level = 'info', stage = 'unknown', message, code } = params;
  const safeData = params.data
    ? sanitizer.sanitizeObject(params.data)
    : undefined;
  logs.push({
    id: genId(),
    t: now,
    level,
    stage,
    message,
    code,
    data: safeData,
  });
  clampSize();
}

export function clearLogs(): void {
  logs = [];
  durations = {};
  payloadSizes = {};
}

export function getLogs(): SyncLogEvent[] {
  return logs.slice().reverse(); // newest first
}

function percentile(values: number[], p: number): number | null {
  if (!values || values.length === 0) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor((p / 100) * sorted.length))
  );
  return sorted[idx];
}

export function getMetrics(): {
  p50: Partial<Record<SyncStage, number | null>>;
  p95: Partial<Record<SyncStage, number | null>>;
  payload: { pushAvgBytes: number | null; pullAvgBytes: number | null };
  lastSuccessAt: number | null;
  lastCheckpointAt: number | null;
  nextAttemptAt: number | null;
  checkpointAgeMs: number | null;
} {
  const p50: Partial<Record<SyncStage, number | null>> = {};
  const p95: Partial<Record<SyncStage, number | null>> = {};
  for (const stage of Object.keys(durations) as SyncStage[]) {
    const arr = durations[stage] ?? [];
    p50[stage] = percentile(arr, 50);
    p95[stage] = percentile(arr, 95);
  }
  const lastSuccessAt = getItem<number>('sync.lastSuccessAt');
  const lastCheckpointAt = getItem<number>('sync.lastPulledAt');
  const nextAttemptAt = getItem<number>('sync.nextAttemptAt');
  const checkpointAgeMs =
    typeof lastCheckpointAt === 'number'
      ? Math.max(0, Date.now() - lastCheckpointAt)
      : null;
  const pushArr = payloadSizes.push ?? [];
  const pullArr = payloadSizes.pull ?? [];
  const pushAvg = pushArr.length
    ? Math.round(pushArr.reduce((a, b) => a + b, 0) / pushArr.length)
    : null;
  const pullAvg = pullArr.length
    ? Math.round(pullArr.reduce((a, b) => a + b, 0) / pullArr.length)
    : null;
  return {
    p50,
    p95,
    payload: { pushAvgBytes: pushAvg, pullAvgBytes: pullAvg },
    lastSuccessAt: lastSuccessAt ?? null,
    lastCheckpointAt: lastCheckpointAt ?? null,
    nextAttemptAt: nextAttemptAt ?? null,
    checkpointAgeMs,
  };
}

export async function markManualSyncStart(): Promise<void> {
  await setItem('sync.manual.lastStart', Date.now());
}

export function getManualSyncStart(): number | null {
  return getItem<number>('sync.manual.lastStart');
}
