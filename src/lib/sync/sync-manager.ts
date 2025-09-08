import {
  hasUnsyncedChanges,
  synchronize as wmelonSynchronize,
} from '@nozbe/watermelondb/sync';

import { getItem, setItem } from '@/lib/storage';
import { database } from '@/lib/watermelon';

type SyncStatus = 'idle' | 'running' | 'error';

export type SyncOptions = {
  pullEndpoint: string;
  pushEndpoint: string;
  batchSize: number;
  retryAttempts: number;
  backoffMultiplier: number;
  maxBackoffDelay: number;
  enableBackgroundSync: boolean;
  syncOnAppStart: boolean;
  syncOnForeground: boolean;
  migrationsEnabledAtVersion?: number;
  timeoutMs?: number;
};

export type SyncResult = {
  pushed: number;
  applied: number;
  serverTimestamp: number | null;
};

const CHECKPOINT_KEY = 'sync.lastPulledAt';

let currentStatus: SyncStatus = 'idle';
let lastSyncTime: number | null = getItem<number>(CHECKPOINT_KEY);
let configured: SyncOptions | null = null;
let inFlight = false;

export function configureSync(options: SyncOptions): void {
  configured = options;
}

export function getSyncStatus(): SyncStatus {
  return currentStatus;
}

export function getLastSyncTime(): Date | null {
  return typeof lastSyncTime === 'number' ? new Date(lastSyncTime) : null;
}

export async function hasPendingLocalChanges(): Promise<boolean> {
  return hasUnsyncedChanges({ database });
}

function setStatus(status: SyncStatus): void {
  currentStatus = status;
}

async function pullChanges({
  lastPulledAt,
  schemaVersion,
  migration,
}: {
  lastPulledAt: number | null;
  schemaVersion: number;
  migration: any;
}) {
  if (!configured) throw new Error('Sync not configured');

  const url = `${configured.pullEndpoint}`;
  const controller = new AbortController();
  const timeoutMs = configured.timeoutMs ?? 30000; // Default 30s timeout
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lastPulledAt,
        schemaVersion,
        migration,
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`pull failed: ${res.status}`);
    const { changes, timestamp } = (await res.json()) as {
      changes: any;
      timestamp: number;
    };
    // Persist checkpoint for UI/metrics immediately
    await setItem(CHECKPOINT_KEY, timestamp);
    lastSyncTime = timestamp;
    return { changes, timestamp };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Pull request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function pushChanges({
  changes,
  lastPulledAt,
}: {
  changes: any;
  lastPulledAt: number | null;
}) {
  if (!configured) throw new Error('Sync not configured');

  const url = `${configured.pushEndpoint}`;
  const controller = new AbortController();
  const timeoutMs = configured.timeoutMs ?? 30000; // Default 30s timeout
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ changes, lastPulledAt }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`push failed: ${res.status}`);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Push request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function synchronize(): Promise<SyncResult> {
  if (!configured) throw new Error('Sync not configured');
  if (inFlight)
    return { pushed: 0, applied: 0, serverTimestamp: lastSyncTime ?? null };
  inFlight = true;
  setStatus('running');

  try {
    await wmelonSynchronize({
      database,
      pullChanges,
      pushChanges,
      migrationsEnabledAtVersion: configured.migrationsEnabledAtVersion,
    } as any);

    // Watermelon returns void; we persist checkpoint from database adapter via local storage
    const newCheckpoint = getItem<number>(CHECKPOINT_KEY);
    if (typeof newCheckpoint === 'number') lastSyncTime = newCheckpoint;
    setStatus('idle');
    inFlight = false;
    return { pushed: 0, applied: 0, serverTimestamp: lastSyncTime ?? null };
  } catch (err) {
    setStatus('error');
    inFlight = false;
    throw err;
  }
}

// Helper to manually set checkpoint (used by tests or migration scenarios)
export async function setLastPulledAt(timestampMs: number): Promise<void> {
  await setItem(CHECKPOINT_KEY, timestampMs);
  lastSyncTime = timestampMs;
}
