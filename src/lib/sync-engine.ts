import { getItem, setItem } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
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

function nowMs(): number {
  return Date.now();
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
  const res = await fetch(`/sync/push`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Idempotency-Key': generateIdempotencyKey(),
    },
    body: JSON.stringify(batch),
  });
  if (!res.ok) {
    if (res.status === 409) throw new PushConflictError();
    throw new Error(`push failed: ${res.status}`);
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

class PushConflictError extends Error {
  constructor() {
    super('push conflict');
    this.name = 'PushConflictError';
  }
}

async function applyServerChanges(
  resp: SyncResponse
): Promise<{ appliedCount: number; changedTaskIds: string[] }> {
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

  return { appliedCount, changedTaskIds: changedIds };
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
  let applied = 0;
  const changedTaskIds: string[] = [];
  for (const p of payloads) {
    try {
      const coll = (
        table === 'tasks'
          ? repos.tasks
          : table === 'series'
            ? repos.series
            : repos.overrides
      ) as any;
      let existing: any | null = null;
      try {
        existing = await coll.find(p.id);
      } catch {
        existing = null;
      }
      if (!existing) {
        await coll.create((rec: any) => {
          for (const [k, v] of Object.entries(p)) {
            (rec as any)[k] = _normalizeIncomingValue(k, v);
          }
          (rec as any).updatedAt = (rec as any).updatedAt ?? new Date();
          (rec as any).createdAt = (rec as any).createdAt ?? new Date();
        });
      } else {
        await existing.update((rec: any) => {
          for (const [k, v] of Object.entries(p)) {
            (rec as any)[k] = _normalizeIncomingValue(k, v);
          }
          (rec as any).updatedAt = new Date();
        });
      }
      applied++;
      if (table === 'tasks') changedTaskIds.push(p.id);
    } catch {
      // Ignore individual row failures to keep sync resilient
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
  return pushedCount;
}

async function pullChangesOnce(req: SyncRequest): Promise<SyncResponse> {
  const token = await getBearerToken();
  const res = await fetch(`/sync/pull`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`pull failed: ${res.status}`);
  const data = (await res.json()) as SyncResponse;
  return data;
}

export async function synchronize(): Promise<SyncResult> {
  const lastPulledAt = getItem<number>(CHECKPOINT_KEY);

  // 1) Push local changes first (handle 409 conflicts)
  let pushed = 0;
  try {
    pushed = await pushChanges(lastPulledAt ?? null);
  } catch (err) {
    if (err instanceof PushConflictError) {
      // Pull once to resolve conflicts
      let cursor: string | undefined = undefined;
      do {
        const req: SyncRequest = {
          lastPulledAt: lastPulledAt ?? null,
          schemaVersion: '2025-08-23.v1',
          tables: SYNC_TABLES,
          cursor,
        };
        const resp = await pullChangesOnce(req);
        await applyServerChanges(resp);
        cursor = resp.hasMore ? resp.nextCursor : undefined;
        if (!resp.hasMore) break;
      } while (true);
      // Retry once
      pushed = await pushChanges(lastPulledAt ?? null);
    } else {
      throw err;
    }
  }

  // 2) Pull remote changes (paginate if needed)
  let cursor: string | undefined = undefined;
  let serverTimestamp: number | null = null;
  let applied = 0;
  let changedTaskIds: string[] = [];

  do {
    const req: SyncRequest = {
      lastPulledAt: lastPulledAt ?? null,
      schemaVersion: '2025-08-23.v1',
      tables: SYNC_TABLES,
      cursor,
    };
    const resp = await pullChangesOnce(req);
    serverTimestamp = resp.serverTimestamp;
    const { appliedCount, changedTaskIds: changed } =
      await applyServerChanges(resp);
    applied += appliedCount;
    changedTaskIds.push(...changed);
    cursor = resp.hasMore ? resp.nextCursor : undefined;
    if (!resp.hasMore) break;
  } while (true);

  // 3) Update checkpoint atomically after successful apply
  if (serverTimestamp !== null) await setItem(CHECKPOINT_KEY, serverTimestamp);

  // 4) Differentially re-plan notifications if tasks changed
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

  return { pushed, applied, serverTimestamp };
}

export function computeBackoffMs(
  attempt: number,
  baseMs: number = 1000,
  maxMs: number = 60_000
): number {
  const expo = Math.min(maxMs, baseMs * Math.pow(2, Math.max(0, attempt)));
  const jitter = Math.floor(Math.random() * Math.min(expo, 1000));
  return expo + jitter;
}

export async function runSyncWithRetry(
  maxAttempts: number = 5
): Promise<SyncResult> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const result = await synchronize();
      await setItem('sync.lastSuccessAt', nowMs());
      return result;
    } catch (err) {
      lastError = err;
      const delay = computeBackoffMs(attempt);
      await setItem('sync.nextAttemptAt', nowMs() + delay);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('sync failed');
}

// Pure helper for tests
export function diffServerChangedTaskIds(resp: SyncResponse): string[] {
  const ids = new Set<string>();
  for (const p of resp.changes.tasks?.created ?? []) ids.add(p.id);
  for (const p of resp.changes.tasks?.updated ?? []) ids.add(p.id);
  for (const p of resp.changes.tasks?.deleted ?? []) ids.add(p.id);
  return Array.from(ids);
}
