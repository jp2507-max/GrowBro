import { queryClient } from '@/api/common/api-provider';
import { NoopAnalytics } from '@/lib/analytics';
import { getItem, setItem } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { computeBackoffMs } from '@/lib/sync/backoff';
import {
  buildConflict,
  type Conflict,
  createConflictResolver,
} from '@/lib/sync/conflict-resolver';
import {
  logEvent,
  recordDuration,
  recordPayloadSize,
} from '@/lib/sync/monitor';
import {
  categorizeSyncError,
  SyncSchemaMismatchError,
} from '@/lib/sync/sync-errors';
import { getSyncState } from '@/lib/sync/sync-state';
import { TaskNotificationService } from '@/lib/task-notifications';
import { database } from '@/lib/watermelon';

type TableName = 'series' | 'tasks' | 'occurrence_overrides';

type ChangesForTable<T = any> = {
  created: T[];
  updated: T[];
  deleted: { id: string; deleted_at_client?: string }[];
};

type ChangesByTable = Record<TableName, ChangesForTable>;

export type SyncRequest = {
  lastPulledAt: number | null;
  schemaVersion: string;
  tables: TableName[];
  cursor?: string;
};

export type SyncResponse = {
  serverTimestamp: number; // epoch millis
  changes: Record<
    TableName,
    {
      created: any[];
      updated: any[];
      deleted: { id: string; deleted_at: string }[];
    }
  >;
  hasMore: boolean;
  nextCursor?: string;
  migrationRequired: boolean;
};

// Per-record shape additions: server_revision is an optional monotonically
// increasing integer assigned by the server on each write. server_updated_at_ms
// is an authoritative server timestamp in epoch milliseconds. Clients MUST
// prefer server_revision for conflict resolution when present; otherwise use
// server_updated_at_ms. Do NOT rely on client clocks for LWW comparisons.

export type PushRequest = {
  lastPulledAt: number | 0;
  changes: ChangesByTable;
};

export type SyncResult = {
  pushed: number;
  applied: number;
  serverTimestamp: number | null;
};

const SYNC_TABLES: TableName[] = ['series', 'tasks', 'occurrence_overrides'];
const MAX_PUSH_CHUNK_PER_TABLE = 1000; // per-batch limit (Req 6.2)
const CHECKPOINT_KEY = 'sync.lastPulledAt';
const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  process.env.API_BASE_URL ??
  process.env.API_URL ??
  '';

if (!API_BASE) {
  console.warn('SYNC: API_BASE is empty; network calls will fail on device');
}

const REQUEST_TIMEOUT_MS = 30000; // 30 second timeout

function nowMs(): number {
  return Date.now();
}

// Exposed UI flags - backed by Zustand store
export function isSyncInFlight(): boolean {
  return getSyncState().syncInFlight;
}

function generateIdempotencyKey(): string {
  // Simple RFC4122-ish random; sufficient for client idempotency header
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function getBearerToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? null;
  return token ?? null;
}

function toMillis(
  dateLike: Date | string | number | undefined | null
): number | null {
  if (!dateLike) return null;
  if (typeof dateLike === 'number') return dateLike;
  if (dateLike instanceof Date) return dateLike.getTime();
  const d = new Date(dateLike);
  return isNaN(d.getTime()) ? null : d.getTime();
}

function serializeRecord(model: any): Record<string, any> {
  // Shallow serialize commonly used fields. Keep names aligned with model properties
  const out: Record<string, any> = {};
  for (const key of Object.keys(model)) {
    const value = (model as any)[key];
    if (value instanceof Date) out[key] = value.toISOString();
    else out[key] = value;
  }
  // Ensure dates are ISO strings
  if (model.createdAt instanceof Date)
    out.createdAt = model.createdAt.toISOString();
  if (model.updatedAt instanceof Date)
    out.updatedAt = model.updatedAt.toISOString();
  if (model.deletedAt instanceof Date)
    out.deletedAt = model.deletedAt.toISOString();
  return out;
}

function _normalizeIncomingValue(_key: string, value: any): any {
  if (value == null) return value;
  if (typeof value === 'string' && /\d{4}-\d{2}-\d{2}T/.test(value)) {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d;
  }
  // normalize server snake_case timestamps to camel where needed
  if (_key === 'createdAt' && typeof value === 'number') return new Date(value);
  if (_key === 'updatedAt' && typeof value === 'number') return new Date(value);
  return value;
}

// (no _getCollections helper; use explicit local maps where needed)

function countChanges(changes: ChangesByTable): number {
  return SYNC_TABLES.reduce(
    (sum, t) =>
      sum +
      changes[t].created.length +
      changes[t].updated.length +
      changes[t].deleted.length,
    0
  );
}

function buildPushBatches(
  changes: ChangesByTable,
  lastPulledAt: number | null
): PushRequest[] {
  const maxLen = Math.max(
    ...SYNC_TABLES.map((t) =>
      Math.max(
        changes[t].created.length,
        changes[t].updated.length,
        changes[t].deleted.length
      )
    )
  );
  const batches = Math.max(1, Math.ceil(maxLen / MAX_PUSH_CHUNK_PER_TABLE));
  const out: PushRequest[] = [];
  for (let i = 0; i < batches; i++) {
    const slice = (arr: any[]) =>
      arr.slice(
        i * MAX_PUSH_CHUNK_PER_TABLE,
        (i + 1) * MAX_PUSH_CHUNK_PER_TABLE
      );
    const batch: PushRequest = {
      lastPulledAt: lastPulledAt ?? 0,
      changes: {
        series: {
          created: slice(changes.series.created),
          updated: slice(changes.series.updated),
          deleted: slice(changes.series.deleted),
        },
        tasks: {
          created: slice(changes.tasks.created),
          updated: slice(changes.tasks.updated),
          deleted: slice(changes.tasks.deleted),
        },
        occurrence_overrides: {
          created: slice(changes.occurrence_overrides.created),
          updated: slice(changes.occurrence_overrides.updated),
          deleted: slice(changes.occurrence_overrides.deleted),
        },
      },
    };
    if (countChanges(batch.changes) > 0) out.push(batch);
  }
  return out;
}

async function sendPushBatch(
  batch: PushRequest,
  token: string | null
): Promise<void> {
  const _started = nowMs();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const body = JSON.stringify(batch);
    const res = await fetch(`${API_BASE}/sync/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'Idempotency-Key': generateIdempotencyKey(),
      },
      body,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      if (res.status === 409) throw new PushConflictError();
      try {
        await NoopAnalytics.track('sync_error', {
          stage: 'push',
          code: res.status,
        });
      } catch {}
      throw new Error(`push failed: ${res.status}`);
    }
    recordDuration('push', nowMs() - _started);
    try {
      recordPayloadSize('push', body.length);
    } catch {}
    logEvent({ stage: 'push', message: 'push batch ok' });
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === 'AbortError') {
      try {
        await NoopAnalytics.track('sync_error', {
          stage: 'push',
          code: 'timeout',
        });
      } catch {}
      throw new Error('Request timeout: push operation exceeded 30 seconds');
    }

    try {
      await NoopAnalytics.track('sync_error', { stage: 'push' });
    } catch {}
    logEvent({
      level: 'error',
      stage: 'push',
      message: 'push failed',
      data: { error: String(error) },
    });
    throw error;
  }
}

async function collectLocalChanges(
  lastPulledAt: number | null
): Promise<ChangesByTable> {
  const changes: ChangesByTable = {
    series: { created: [], updated: [], deleted: [] },
    tasks: { created: [], updated: [], deleted: [] },
    occurrence_overrides: { created: [], updated: [], deleted: [] },
  };

  const repos = {
    tasks: database.collections.get('tasks' as any),
    series: database.collections.get('series' as any),
    overrides: database.collections.get('occurrence_overrides' as any),
  } as const;

  const [taskRows, seriesRows, overrideRows] = await Promise.all([
    (repos.tasks as any).query().fetch(),
    (repos.series as any).query().fetch(),
    (repos.overrides as any).query().fetch(),
  ]);

  function bucketRow(table: TableName, row: any) {
    const createdAtMs = toMillis(row.createdAt);
    const updatedAtMs = toMillis(row.updatedAt);
    const deletedAtMs = toMillis(row.deletedAt);

    const hasDeleted = deletedAtMs !== null;
    const afterCheckpoint = (ts: number | null) =>
      lastPulledAt === null ? true : ts !== null && ts > lastPulledAt;

    if (hasDeleted) {
      // Tombstone
      if (afterCheckpoint(deletedAtMs)) {
        changes[table].deleted.push({
          id: row.id,
          deleted_at_client:
            row.deletedAt.toISOString?.() ?? String(row.deletedAt),
        });
      }
      return;
    }

    const isCreated = afterCheckpoint(createdAtMs);
    const isUpdated = afterCheckpoint(updatedAtMs) && !isCreated;

    if (isCreated) changes[table].created.push(serializeRecord(row));
    else if (isUpdated) changes[table].updated.push(serializeRecord(row));
  }

  for (const r of seriesRows as any[]) bucketRow('series', r);
  for (const r of taskRows as any[]) bucketRow('tasks', r);
  for (const r of overrideRows as any[]) bucketRow('occurrence_overrides', r);
  return changes;
}

/**
 * Returns a count of locally pending changes (created+updated+deleted across all tables)
 * since the last successful checkpoint. Used for UI badges and summaries.
 */
export async function getPendingChangesCount(): Promise<number> {
  const lastPulledAt = getItem<number>(CHECKPOINT_KEY);
  const changes = await collectLocalChanges(lastPulledAt ?? null);
  return countChanges(changes);
}

class PushConflictError extends Error {
  constructor() {
    super('push conflict');
    this.name = 'PushConflictError';
  }
}

async function applyServerChanges(
  resp: SyncResponse
): Promise<{ appliedCount: number; changedTaskIds: string[] }> {
  const _started = nowMs();
  const { changes } = resp;
  let appliedCount = 0;
  const changedIds: string[] = [];

  await database.write(async () => {
    const { applied: sC, changedTaskIds: sCIds } = await upsertBatch(
      'series',
      changes.series?.created ?? []
    );
    const { applied: sU, changedTaskIds: sUIds } = await upsertBatch(
      'series',
      changes.series?.updated ?? []
    );
    const { applied: tC, changedTaskIds: tCIds } = await upsertBatch(
      'tasks',
      changes.tasks?.created ?? []
    );
    const { applied: tU, changedTaskIds: tUIds } = await upsertBatch(
      'tasks',
      changes.tasks?.updated ?? []
    );
    const { applied: oC, changedTaskIds: oCIds } = await upsertBatch(
      'occurrence_overrides',
      changes.occurrence_overrides?.created ?? []
    );
    const { applied: oU, changedTaskIds: oUIds } = await upsertBatch(
      'occurrence_overrides',
      changes.occurrence_overrides?.updated ?? []
    );

    const { applied: dT, changedTaskIds: dTIds } = await applyDeletesBatch(
      'tasks',
      changes.tasks?.deleted ?? []
    );
    const { applied: dS, changedTaskIds: dSIds } = await applyDeletesBatch(
      'series',
      changes.series?.deleted ?? []
    );
    const { applied: dO, changedTaskIds: dOIds } = await applyDeletesBatch(
      'occurrence_overrides',
      changes.occurrence_overrides?.deleted ?? []
    );

    appliedCount = sC + sU + tC + tU + oC + oU + dT + dS + dO;
    changedIds.push(
      ...sCIds,
      ...sUIds,
      ...tCIds,
      ...tUIds,
      ...oCIds,
      ...oUIds,
      ...dTIds,
      ...dSIds,
      ...dOIds
    );
  });

  recordDuration('apply', nowMs() - _started);
  logEvent({
    stage: 'apply',
    message: 'apply ok',
    data: { applied: appliedCount },
  });
  return { appliedCount, changedTaskIds: changedIds };
}

function getCollectionByTable(
  table: TableName,
  repos: {
    tasks: any;
    series: any;
    overrides: any;
  }
): any {
  return (
    table === 'tasks'
      ? repos.tasks
      : table === 'series'
        ? repos.series
        : repos.overrides
  ) as any;
}

function applyPayloadToRecord(target: any, payload: any): void {
  for (const [key, value] of Object.entries(payload)) {
    // Preserve id and updatedAt handling outside; but copy server revision
    // and server timestamps as authoritative fields onto the local record
    if (key === 'id') continue;
    // Map server fields to local properties where appropriate
    if (key === 'server_revision') {
      if (value != null) {
        const numericValue = Number(value);
        if (Number.isFinite(numericValue)) {
          (target as any).serverRevision = numericValue;
        }
      }
      continue;
    }
    if (key === 'server_updated_at_ms') {
      if (value != null) {
        const numericValue =
          typeof value === 'number' ? value : toMillis(value as any);
        if (numericValue != null && Number.isFinite(numericValue)) {
          (target as any).serverUpdatedAtMs = numericValue;
        }
      }
      continue;
    }
    if (key === 'updatedAt') continue;
    (target as any)[key] = _normalizeIncomingValue(key, value);
  }
}

function safeParseNumber(value: any): number | null {
  if (value == null) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function parseMetadataSafe(currentMetaRaw: any): Record<string, any> {
  let currentMeta: Record<string, any> = {};
  if (typeof currentMetaRaw === 'string' && currentMetaRaw.trim().length) {
    try {
      const parsed = JSON.parse(currentMetaRaw);
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        !Array.isArray(parsed)
      ) {
        currentMeta = parsed;
      }
    } catch {
      currentMeta = {};
    }
  } else if (
    typeof currentMetaRaw === 'object' &&
    currentMetaRaw !== null &&
    !Array.isArray(currentMetaRaw)
  ) {
    currentMeta = currentMetaRaw;
  }
  return currentMeta;
}

export function maybeMarkNeedsReview(
  table: TableName,
  rec: any,
  payload: any
): void {
  if (table !== 'tasks') return;

  // Prefer server_revision if present, otherwise compare server_updated_at_ms
  const localRevRaw =
    (rec as any)._raw?.server_revision ?? (rec as any)._rev ?? null;
  const serverRevRaw = payload.server_revision ?? null;
  const localServerTsRaw =
    (rec as any)._raw?.server_updated_at_ms ??
    (rec as any).server_updated_at_ms ??
    toMillis((rec as any).updatedAt as any);
  const serverServerTsRaw =
    payload.server_updated_at_ms ?? toMillis(payload.updatedAt as any);

  const localRev = safeParseNumber(localRevRaw);
  const serverRev = safeParseNumber(serverRevRaw);
  const localServerTs = safeParseNumber(localServerTsRaw);
  const serverServerTs = safeParseNumber(serverServerTsRaw);

  let serverIsNewer = false;
  if (serverRev != null && localRev != null) {
    serverIsNewer = serverRev > localRev;
  } else if (serverServerTs != null && localServerTs != null) {
    serverIsNewer = serverServerTs > localServerTs;
  } else if (serverServerTs != null && localServerTs == null) {
    serverIsNewer = true;
  }

  if (serverIsNewer) {
    const currentMetaRaw = (rec as any).metadata;
    const currentMeta = parseMetadataSafe(currentMetaRaw);
    (rec as any).metadata = {
      ...currentMeta,
      needsReview: true,
    };
  }
}

async function handleCreate(coll: any, payload: any): Promise<void> {
  await coll.create((rec: any) => {
    (rec as any).id = payload.id;
    // Apply payload and authoritative server metadata. For createdAt/updatedAt
    // prefer server-provided values if present; do not synthesize from client
    applyPayloadToRecord(rec, payload);
    if (payload.createdAt != null) {
      (rec as any).createdAt = _normalizeIncomingValue(
        'createdAt',
        payload.createdAt
      );
    }
    if (payload.updatedAt != null) {
      (rec as any).updatedAt = _normalizeIncomingValue(
        'updatedAt',
        payload.updatedAt
      );
    }
    if (payload.server_revision != null) {
      (rec as any).serverRevision = Number(payload.server_revision);
    }
    if (payload.server_updated_at_ms != null) {
      (rec as any).serverUpdatedAtMs = Number(payload.server_updated_at_ms);
    }
  });
}

function determineServerAuthority(
  localData: { rev: number | null; serverTs: number | null },
  serverData: { rev: any; serverTs: any }
): boolean {
  const { rev: localRev, serverTs: localServerTs } = localData;
  const { rev: serverRev, serverTs: serverServerTs } = serverData;

  if (serverRev != null && localRev != null) {
    return Number(serverRev) > Number(localRev);
  } else if (serverServerTs != null && localServerTs != null) {
    return Number(serverServerTs) > Number(localServerTs);
  } else if (serverServerTs != null && localServerTs == null) {
    return true;
  }
  return false;
}

function applyServerPayloadToRecord(rec: any, payload: any): void {
  applyPayloadToRecord(rec, payload);
  if (payload.updatedAt != null) {
    (rec as any).updatedAt = _normalizeIncomingValue(
      'updatedAt',
      payload.updatedAt
    );
  }
  if (payload.server_revision != null) {
    (rec as any).serverRevision = Number(payload.server_revision);
  }
  if (payload.server_updated_at_ms != null) {
    (rec as any).serverUpdatedAtMs = Number(payload.server_updated_at_ms);
  }
}

async function handleUpdate(
  table: TableName,
  existing: any,
  payload: any
): Promise<void> {
  const resolver = createConflictResolver();

  // Pre-compute all values outside the synchronous update callback

  // Determine if server is authoritative
  // NOTE: P1 BUG - Server revision metadata not persisted in WatermelonDB schema
  // The WatermelonDB schema for tasks (and other tables) currently only defines
  // created_at/updated_at/deleted_at columns without server_revision or
  // server_updated_at_ms fields. This means these values are never persisted
  // and _raw will always return undefined after record reload, causing conflict
  // resolution to fall back to client timestamps and lose server-authoritative ordering.
  // TODO: Add server_revision and server_updated_at_ms fields to WatermelonDB schema
  // TODO: Update migration to persist these fields properly
  const localRev = existing._raw.server_revision ?? null;
  const serverRev = payload.server_revision ?? null;
  const localServerTs =
    existing._raw.server_updated_at_ms ?? toMillis(existing.updatedAt);
  const serverServerTs =
    payload.server_updated_at_ms ?? toMillis(payload.updatedAt as any);

  let serverIsAuthoritative = determineServerAuthority(
    {
      rev: localRev,
      serverTs: localServerTs,
    },
    {
      rev: serverRev,
      serverTs: serverServerTs,
    }
  );

  // Replace DB-wide hasUnsyncedChanges() with record-level check
  const hasUnsyncedRecord = existing._raw._status !== 'synced';
  if (serverIsAuthoritative && hasUnsyncedRecord) {
    serverIsAuthoritative = false;
  }

  // Create local snapshot for conflict detection
  const localSnapshot: Record<string, unknown> = { ...existing };

  // Detect conflicts outside the update callback
  try {
    const conflict: Conflict = buildConflict({
      tableName: table,
      recordId: existing.id,
      localRecord: localSnapshot,
      remoteRecord: payload,
    });
    if (conflict.conflictFields.length > 0) {
      resolver.logConflict(conflict);
    }
  } catch {}

  // Perform synchronous update
  await existing.update((rec: any) => {
    // Always call maybeMarkNeedsReview to flag conflicts
    maybeMarkNeedsReview(table, rec, payload);

    // Only apply server fields when server is authoritative
    if (serverIsAuthoritative) {
      applyServerPayloadToRecord(rec, payload);
    }
  });
}

async function upsertBatch(
  table: TableName,
  payloads: any[]
): Promise<{ applied: number; changedTaskIds: string[] }> {
  const repos = {
    tasks: database.collections.get('tasks' as any),
    series: database.collections.get('series' as any),
    overrides: database.collections.get('occurrence_overrides' as any),
  } as const;
  const coll = getCollectionByTable(table, repos);
  let applied = 0;
  const changedTaskIds: string[] = [];
  for (const payload of payloads) {
    try {
      let existing: any | null = null;
      try {
        existing = await coll.find(payload.id);
      } catch {
        existing = null;
      }
      if (!existing) await handleCreate(coll, payload);
      else await handleUpdate(table, existing, payload);
      applied++;
      if (table === 'tasks') changedTaskIds.push(payload.id);
    } catch {
      // ignore row failure
    }
  }
  return { applied, changedTaskIds };
}

async function applyDeletesBatch(
  table: TableName,
  deletions: { id: string }[]
): Promise<{ applied: number; changedTaskIds: string[] }> {
  const repos = {
    tasks: database.collections.get('tasks' as any),
    series: database.collections.get('series' as any),
    overrides: database.collections.get('occurrence_overrides' as any),
  } as const;
  const coll = (
    table === 'tasks'
      ? repos.tasks
      : table === 'series'
        ? repos.series
        : repos.overrides
  ) as any;
  let applied = 0;
  const changedTaskIds: string[] = [];
  for (const d of deletions) {
    try {
      const row = await coll.find(d.id);
      await row.markAsDeleted();
      applied++;
      if (table === 'tasks') changedTaskIds.push(d.id);
    } catch {
      // Row may not exist locally; ignore
    }
  }
  return { applied, changedTaskIds };
}

async function pushChanges(lastPulledAt: number | null): Promise<number> {
  const toPush = await collectLocalChanges(lastPulledAt);
  const total = countChanges(toPush);
  if (total === 0) return 0;

  const token = await getBearerToken();
  const batches = buildPushBatches(toPush, lastPulledAt);
  let pushedCount = 0;
  for (const batch of batches) {
    await sendPushBatch(batch, token);
    pushedCount += countChanges(batch.changes);
  }
  try {
    await NoopAnalytics.track('sync_push', {
      pushed: pushedCount,
      queue_length: total,
    });
  } catch {}
  return pushedCount;
}

async function pullChangesOnce(req: SyncRequest): Promise<SyncResponse> {
  const _started = nowMs();
  const token = await getBearerToken();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const body = JSON.stringify(req);
    const res = await fetch(`${API_BASE}/sync/pull`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      try {
        await NoopAnalytics.track('sync_error', {
          stage: 'pull',
          code: res.status,
        });
      } catch {}
      throw new Error(`pull failed: ${res.status}`);
    }
    const data = (await res.json()) as SyncResponse;
    recordDuration('pull', nowMs() - _started);
    try {
      recordPayloadSize('pull', body.length);
    } catch {}
    logEvent({
      stage: 'pull',
      message: 'pull ok',
      data: { hasMore: data.hasMore },
    });
    return data;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === 'AbortError') {
      try {
        await NoopAnalytics.track('sync_error', {
          stage: 'pull',
          code: 'timeout',
        });
      } catch {}
      throw new Error('Request timeout: pull operation exceeded 30 seconds');
    }

    try {
      await NoopAnalytics.track('sync_error', { stage: 'pull' });
    } catch {}
    logEvent({
      level: 'error',
      stage: 'pull',
      message: 'pull failed',
      data: { error: String(error) },
    });
    throw error;
  }
}

async function pushWithConflictResolution(
  lastPulledAt: number | null
): Promise<number> {
  try {
    return await pushChanges(lastPulledAt);
  } catch (err) {
    if (err instanceof PushConflictError) {
      // Pull once to resolve conflicts
      let cursor: string | undefined = undefined;
      let hasMore = true;

      while (hasMore) {
        const req: SyncRequest = {
          lastPulledAt,
          schemaVersion: '2025-08-23.v1',
          tables: SYNC_TABLES,
          cursor,
        };
        const resp = await pullChangesOnce(req);
        await applyServerChanges(resp);
        cursor = resp.hasMore ? resp.nextCursor : undefined;
        hasMore = resp.hasMore;
      }
      // Retry once
      return await pushChanges(lastPulledAt);
    }
    throw err;
  }
}

async function pullAllChanges(lastPulledAt: number | null): Promise<{
  serverTimestamp: number;
  applied: number;
  changedTaskIds: string[];
}> {
  let cursor: string | undefined = undefined;
  let serverTimestamp: number = 0;
  let applied = 0;
  let changedTaskIds: string[] = [];

  // Initial pull
  const initialReq: SyncRequest = {
    lastPulledAt,
    schemaVersion: '2025-08-23.v1',
    tables: SYNC_TABLES,
    cursor,
  };
  let resp = await pullChangesOnce(initialReq);
  if (resp.migrationRequired) {
    throw new SyncSchemaMismatchError();
  }
  serverTimestamp = resp.serverTimestamp;
  const { appliedCount, changedTaskIds: changed } =
    await applyServerChanges(resp);
  applied += appliedCount;
  try {
    await NoopAnalytics.track('sync_pull_applied', {
      applied: appliedCount,
      has_more: resp.hasMore,
    });
  } catch {}
  changedTaskIds.push(...changed);
  cursor = resp.hasMore ? resp.nextCursor : undefined;

  // Continue pulling while hasMore
  while (resp.hasMore) {
    const req: SyncRequest = {
      lastPulledAt,
      schemaVersion: '2025-08-23.v1',
      tables: SYNC_TABLES,
      cursor,
    };
    resp = await pullChangesOnce(req);
    if (resp.migrationRequired) {
      throw new SyncSchemaMismatchError();
    }
    serverTimestamp = resp.serverTimestamp;
    const { appliedCount: newApplied, changedTaskIds: newChanged } =
      await applyServerChanges(resp);
    applied += newApplied;
    try {
      await NoopAnalytics.track('sync_pull_applied', {
        applied: newApplied,
        has_more: resp.hasMore,
      });
    } catch {}
    changedTaskIds.push(...newChanged);
    cursor = resp.hasMore ? resp.nextCursor : undefined;
  }

  return { serverTimestamp, applied, changedTaskIds };
}

async function updateNotificationsForChangedTasks(
  changedTaskIds: string[]
): Promise<void> {
  if (changedTaskIds.length > 0) {
    try {
      const notifier = new TaskNotificationService();
      await notifier.rehydrateNotifications(
        Array.from(new Set(changedTaskIds))
      );
    } catch {
      // Non-fatal
    }
  }
}

export async function synchronize(): Promise<SyncResult> {
  const lastPulledAt = getItem<number>(CHECKPOINT_KEY);

  // 1) Push local changes first (handle 409 conflicts)
  const pushed = await pushWithConflictResolution(lastPulledAt ?? null);

  // 2) Pull remote changes (paginate if needed)
  const { serverTimestamp, applied, changedTaskIds } = await pullAllChanges(
    lastPulledAt ?? null
  );

  // 3) Update checkpoint atomically after successful apply
  if (serverTimestamp !== null) await setItem(CHECKPOINT_KEY, serverTimestamp);
  try {
    if (typeof lastPulledAt === 'number') {
      await NoopAnalytics.track('sync_checkpoint_age_ms', {
        ms: Math.max(0, Date.now() - lastPulledAt),
      });
    }
  } catch {}

  // 4) Differentially re-plan notifications if tasks changed
  await updateNotificationsForChangedTasks(changedTaskIds);

  return { pushed, applied, serverTimestamp };
}

export async function runSyncWithRetry(
  maxAttempts: number = 5
): Promise<SyncResult> {
  // Guard: return early if sync already in flight
  if (isSyncInFlight()) {
    throw new Error('sync already in flight');
  }

  let lastError: unknown = null;
  getSyncState().setSyncInFlight(true);
  try {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const result = await synchronize();
        // Invalidate only relevant keys to avoid unnecessary refetches
        try {
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['tasks'] }),
            queryClient.invalidateQueries({ queryKey: ['series'] }),
            queryClient.invalidateQueries({
              queryKey: ['occurrence_overrides'],
            }),
          ]);
        } catch {}
        await setItem('sync.lastSuccessAt', nowMs());
        return result;
      } catch (err) {
        lastError = err;
        const categorized = categorizeSyncError(err);

        // Non-retryable errors: bail out immediately
        if (!categorized.retryable) {
          throw err;
        }

        const delay = computeBackoffMs(attempt);
        await setItem('sync.nextAttemptAt', nowMs() + delay);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    throw lastError instanceof Error ? lastError : new Error('sync failed');
  } finally {
    getSyncState().setSyncInFlight(false);
  }
}

// Pure helper for tests
export function diffServerChangedTaskIds(resp: SyncResponse): string[] {
  const ids = new Set<string>();
  for (const p of resp.changes.tasks?.created ?? []) ids.add(p.id);
  for (const p of resp.changes.tasks?.updated ?? []) ids.add(p.id);
  for (const p of resp.changes.tasks?.deleted ?? []) ids.add(p.id);
  return Array.from(ids);
}
