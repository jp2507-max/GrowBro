import type { Collection, Model } from '@nozbe/watermelondb';

import { queryClient } from '@/api/common/api-provider';
import { NoopAnalytics } from '@/lib/analytics';
import { getItem, setItem } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { computeBackoffMs } from '@/lib/sync/backoff';
import {
  logEvent,
  recordDuration,
  recordPayloadSize,
} from '@/lib/sync/monitor';
import {
  categorizeSyncError,
  SyncSchemaMismatchError,
} from '@/lib/sync/sync-errors';
import {
  emitSyncPerformanceSnapshot,
  recordTotalDuration,
  type SyncTrigger,
} from '@/lib/sync/sync-performance-metrics';
import { getSyncState } from '@/lib/sync/sync-state';
import { TaskNotificationService } from '@/lib/task-notifications';
import { database } from '@/lib/watermelon';
import type { HarvestModel } from '@/lib/watermelon-models/harvest';
import type { HarvestAuditModel } from '@/lib/watermelon-models/harvest-audit';
import type { InventoryModel } from '@/lib/watermelon-models/inventory';
import type { InventoryBatchModel } from '@/lib/watermelon-models/inventory-batch';
import type { InventoryItemModel } from '@/lib/watermelon-models/inventory-item';
import type { InventoryMovementModel } from '@/lib/watermelon-models/inventory-movement';
import type { OccurrenceOverrideModel } from '@/lib/watermelon-models/occurrence-override';
import type { SeriesModel } from '@/lib/watermelon-models/series';
import type { TaskModel } from '@/lib/watermelon-models/task';

type TableName =
  | 'series'
  | 'tasks'
  | 'occurrence_overrides'
  | 'harvests'
  | 'inventory'
  | 'harvest_audits'
  | 'inventory_items'
  | 'inventory_batches'
  | 'inventory_movements';

type LocalDeletionPayload = { id: string; deleted_at_client?: string };

type SerializedRecord = Record<string, unknown> & { id: string };

type ChangesForTable<TRecord extends SerializedRecord = SerializedRecord> = {
  created: TRecord[];
  updated: TRecord[];
  deleted: LocalDeletionPayload[];
};

type ChangesByTable = Record<TableName, ChangesForTable>;

type RemoteDeletionPayload = { id: string; deleted_at: string };

type RemoteChangePayload = SerializedRecord & {
  createdAt?: unknown;
  updatedAt?: unknown;
  deletedAt?: unknown;
  server_revision?: unknown;
  server_updated_at_ms?: unknown;
  metadata?: unknown;
};

type RemoteChangeset = {
  created: RemoteChangePayload[];
  updated: RemoteChangePayload[];
  deleted: RemoteDeletionPayload[];
};

type ModelSnapshot = Record<string, unknown> & {
  id: string;
  createdAt?: Date | null;
  updatedAt?: Date | null;
  deletedAt?: Date | null;
  metadata?: unknown;
  serverRevision?: number | null;
  serverUpdatedAtMs?: number | null;
  _raw?:
    | (Record<string, unknown> & {
        server_revision?: unknown;
        server_updated_at_ms?: unknown;
        _status?: unknown;
      })
    | undefined;
};

type SyncModelMap = {
  series: SeriesModel;
  tasks: TaskModel;
  occurrence_overrides: OccurrenceOverrideModel;
  harvests: HarvestModel;
  inventory: InventoryModel;
  harvest_audits: HarvestAuditModel;
  inventory_items: InventoryItemModel;
  inventory_batches: InventoryBatchModel;
  inventory_movements: InventoryMovementModel;
};

type CollectionsMap = { [K in TableName]: Collection<SyncModelMap[K]> };

export type SyncRequest = {
  lastPulledAt: number | null;
  schemaVersion: string;
  tables: TableName[];
  cursor?: string;
};

export type SyncResponse = {
  serverTimestamp: number; // epoch millis
  changes: Partial<Record<TableName, RemoteChangeset>>;
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
  attempts?: number;
};

export type SyncRunOptions = {
  trigger?: SyncTrigger;
};

const SYNC_TABLES: TableName[] = [
  'series',
  'tasks',
  'occurrence_overrides',
  'harvests',
  'inventory',
  'harvest_audits',
  'inventory_items',
  'inventory_batches',
  'inventory_movements',
];
const MAX_PUSH_CHUNK_PER_TABLE = 1000; // per-batch limit (Req 6.2)
const CHECKPOINT_KEY = 'sync.lastPulledAt';
const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  process.env.API_BASE_URL ??
  process.env.API_URL ??
  '';

if (!API_BASE) {
  // Log missing API_BASE - warn in production, info in development
  const logMethod = __DEV__ ? console.info : console.warn;
  const devMessage = __DEV__ ? ' (expected in dev)' : '';
  logMethod(`SYNC: API_BASE is empty; sync is disabled${devMessage}`);
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

function serializeRecord(model: ModelSnapshot): SerializedRecord {
  // Shallow serialize commonly used fields. Keep names aligned with model properties
  const out: SerializedRecord = { id: String(model.id) };
  for (const key of Object.keys(model)) {
    if (key === 'id') continue;
    const value = model[key];
    out[key] = value instanceof Date ? value.toISOString() : value;
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

const ISO_DATE_PATTERN = /\d{4}-\d{2}-\d{2}T/;

// Comprehensive set of all date fields across all WatermelonDB models
// Fields decorated with @date that should be converted from ISO strings to Date objects
const DATE_FIELD_KEYS = new Set<keyof SerializedRecord>([
  // Standard audit fields (all models)
  'createdAt',
  'updatedAt',
  'deletedAt',

  // Task-specific
  'completedAt',

  // Inventory batch
  'expiresOn',
  'receivedAt',

  // Post/comment moderation
  'hiddenAt',
  'undoExpiresAt',

  // Assessment processing
  'processingStartedAt',
  'processingCompletedAt',
  'resolvedAt',

  // Notification preferences
  'lastUpdated',

  // Harvest stages
  'stageStartedAt',
  'stageCompletedAt',

  // Harvest audit
  'performedAt',

  // Notifications
  'readAt',
  'expiresAt',
  'archivedAt',

  // Playbook applications
  'appliedAt',

  // Device tokens
  'lastUsedAt',

  // Outbox retry scheduling
  'nextRetryAt',
]);

function _normalizeIncomingValue(key: string, value: unknown): unknown {
  if (value == null) return value;

  // Convert ISO string dates to Date objects for known date fields
  if (
    typeof value === 'string' &&
    DATE_FIELD_KEYS.has(key as keyof SerializedRecord) &&
    ISO_DATE_PATTERN.test(value)
  ) {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d;
  }

  // Handle numeric timestamps (server may send timestamps as numbers)
  // Convert common timestamp fields from milliseconds to Date objects
  if (
    typeof value === 'number' &&
    (key === 'createdAt' || key === 'updatedAt' || key === 'receivedAt')
  ) {
    return new Date(value);
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
    const slice = <TRow>(arr: TRow[]): TRow[] =>
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
        harvests: {
          created: slice(changes.harvests.created),
          updated: slice(changes.harvests.updated),
          deleted: slice(changes.harvests.deleted),
        },
        inventory: {
          created: slice(changes.inventory.created),
          updated: slice(changes.inventory.updated),
          deleted: slice(changes.inventory.deleted),
        },
        harvest_audits: {
          created: slice(changes.harvest_audits.created),
          updated: slice(changes.harvest_audits.updated),
          deleted: slice(changes.harvest_audits.deleted),
        },
        inventory_items: {
          created: slice(changes.inventory_items.created),
          updated: slice(changes.inventory_items.updated),
          deleted: slice(changes.inventory_items.deleted),
        },
        inventory_batches: {
          created: slice(changes.inventory_batches.created),
          updated: slice(changes.inventory_batches.updated),
          deleted: slice(changes.inventory_batches.deleted),
        },
        inventory_movements: {
          created: slice(changes.inventory_movements.created),
          updated: slice(changes.inventory_movements.updated),
          deleted: slice(changes.inventory_movements.deleted),
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

function bucketRowIntoChanges<K extends TableName>(params: {
  table: K;
  row: SyncModelMap[K];
  lastPulledAt: number | null;
  changes: ChangesByTable;
}): void {
  const { table, row, lastPulledAt, changes } = params;
  const model = row as unknown as ModelSnapshot;
  const createdAtMs = toMillis(model.createdAt);
  const updatedAtMs = toMillis(model.updatedAt);
  const deletedAtMs = toMillis(model.deletedAt);

  const hasDeleted = deletedAtMs !== null;
  const afterCheckpoint = (ts: number | null) =>
    lastPulledAt === null ? true : ts !== null && ts > lastPulledAt;

  if (hasDeleted) {
    // Tombstone
    if (afterCheckpoint(deletedAtMs)) {
      changes[table].deleted.push({
        id: model.id,
        deleted_at_client:
          model.deletedAt instanceof Date
            ? model.deletedAt.toISOString()
            : model.deletedAt != null
              ? String(model.deletedAt)
              : undefined,
      });
    }
    return;
  }

  const isCreated = afterCheckpoint(createdAtMs);
  const isUpdated = afterCheckpoint(updatedAtMs) && !isCreated;

  if (isCreated) changes[table].created.push(serializeRecord(model));
  else if (isUpdated) changes[table].updated.push(serializeRecord(model));
}

function createEmptyChanges(): ChangesByTable {
  return {
    series: { created: [], updated: [], deleted: [] },
    tasks: { created: [], updated: [], deleted: [] },
    occurrence_overrides: { created: [], updated: [], deleted: [] },
    harvests: { created: [], updated: [], deleted: [] },
    inventory: { created: [], updated: [], deleted: [] },
    harvest_audits: { created: [], updated: [], deleted: [] },
    inventory_items: { created: [], updated: [], deleted: [] },
    inventory_batches: { created: [], updated: [], deleted: [] },
    inventory_movements: { created: [], updated: [], deleted: [] },
  };
}

function addUserIdToChanges(changes: ChangesByTable, userId: string): void {
  const enrich = (records: SerializedRecord[]): SerializedRecord[] =>
    records.map((record) => ({ ...record, user_id: userId }));

  changes.series.created = enrich(changes.series.created);
  changes.series.updated = enrich(changes.series.updated);
  changes.tasks.created = enrich(changes.tasks.created);
  changes.tasks.updated = enrich(changes.tasks.updated);
  changes.occurrence_overrides.created = enrich(
    changes.occurrence_overrides.created
  );
  changes.occurrence_overrides.updated = enrich(
    changes.occurrence_overrides.updated
  );
  changes.harvests.created = enrich(changes.harvests.created);
  changes.harvests.updated = enrich(changes.harvests.updated);
  changes.inventory.created = enrich(changes.inventory.created);
  changes.inventory.updated = enrich(changes.inventory.updated);
  changes.harvest_audits.created = enrich(changes.harvest_audits.created);
  changes.harvest_audits.updated = enrich(changes.harvest_audits.updated);
  changes.inventory_items.created = enrich(changes.inventory_items.created);
  changes.inventory_items.updated = enrich(changes.inventory_items.updated);
  changes.inventory_batches.created = enrich(changes.inventory_batches.created);
  changes.inventory_batches.updated = enrich(changes.inventory_batches.updated);
  changes.inventory_movements.created = enrich(
    changes.inventory_movements.created
  );
  changes.inventory_movements.updated = enrich(
    changes.inventory_movements.updated
  );
}

async function fetchAllRepositoryData(
  repos: CollectionsMap
): Promise<
  [
    TaskModel[],
    SeriesModel[],
    OccurrenceOverrideModel[],
    HarvestModel[],
    InventoryModel[],
    HarvestAuditModel[],
    InventoryItemModel[],
    InventoryBatchModel[],
    InventoryMovementModel[],
  ]
> {
  return Promise.all([
    repos.tasks.query().fetch(),
    repos.series.query().fetch(),
    repos.occurrence_overrides.query().fetch(),
    repos.harvests.query().fetch(),
    repos.inventory.query().fetch(),
    repos['harvest_audits'].query().fetch(),
    repos['inventory_items'].query().fetch(),
    repos['inventory_batches'].query().fetch(),
    repos['inventory_movements'].query().fetch(),
  ]) as Promise<
    [
      TaskModel[],
      SeriesModel[],
      OccurrenceOverrideModel[],
      HarvestModel[],
      InventoryModel[],
      HarvestAuditModel[],
      InventoryItemModel[],
      InventoryBatchModel[],
      InventoryMovementModel[],
    ]
  >;
}

async function collectLocalChanges(
  lastPulledAt: number | null
): Promise<ChangesByTable> {
  const changes = createEmptyChanges();

  const repos = getAllRepos();
  const [
    taskRows,
    seriesRows,
    overrideRows,
    harvestRows,
    inventoryRows,
    auditRows,
    inventoryItemRows,
    inventoryBatchRows,
    inventoryMovementRows,
  ] = await fetchAllRepositoryData(repos);

  for (const r of seriesRows)
    bucketRowIntoChanges({ table: 'series', row: r, lastPulledAt, changes });
  for (const r of taskRows)
    bucketRowIntoChanges({ table: 'tasks', row: r, lastPulledAt, changes });
  for (const r of overrideRows)
    bucketRowIntoChanges({
      table: 'occurrence_overrides',
      row: r,
      lastPulledAt,
      changes,
    });
  for (const r of harvestRows)
    bucketRowIntoChanges({ table: 'harvests', row: r, lastPulledAt, changes });
  for (const r of inventoryRows)
    bucketRowIntoChanges({ table: 'inventory', row: r, lastPulledAt, changes });
  for (const r of auditRows)
    bucketRowIntoChanges({
      table: 'harvest_audits',
      row: r,
      lastPulledAt,
      changes,
    });
  for (const r of inventoryItemRows)
    bucketRowIntoChanges({
      table: 'inventory_items',
      row: r,
      lastPulledAt,
      changes,
    });
  for (const r of inventoryBatchRows)
    bucketRowIntoChanges({
      table: 'inventory_batches',
      row: r,
      lastPulledAt,
      changes,
    });
  for (const r of inventoryMovementRows)
    bucketRowIntoChanges({
      table: 'inventory_movements',
      row: r,
      lastPulledAt,
      changes,
    });
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

function getAllRepos(): CollectionsMap {
  return {
    tasks: database.collections.get<TaskModel>('tasks'),
    series: database.collections.get<SeriesModel>('series'),
    occurrence_overrides: database.collections.get<OccurrenceOverrideModel>(
      'occurrence_overrides'
    ),
    harvests: database.collections.get<HarvestModel>('harvests'),
    inventory: database.collections.get<InventoryModel>('inventory'),
    harvest_audits:
      database.collections.get<HarvestAuditModel>('harvest_audits'),
    inventory_items:
      database.collections.get<InventoryItemModel>('inventory_items'),
    inventory_batches:
      database.collections.get<InventoryBatchModel>('inventory_batches'),
    inventory_movements: database.collections.get<InventoryMovementModel>(
      'inventory_movements'
    ),
  };
}

async function applyUpsertsCoreTables(
  changes: SyncResponse['changes']
): Promise<{ applied: number; changedTaskIds: string[] }> {
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

  const applied = sC + sU + tC + tU + oC + oU;
  const changedIds = [
    ...sCIds,
    ...sUIds,
    ...tCIds,
    ...tUIds,
    ...oCIds,
    ...oUIds,
  ];

  return { applied, changedTaskIds: changedIds };
}

async function applyUpsertsHarvestTables(
  changes: SyncResponse['changes']
): Promise<{ applied: number; changedTaskIds: string[] }> {
  const { applied: hC, changedTaskIds: hCIds } = await upsertBatch(
    'harvests',
    changes.harvests?.created ?? []
  );
  const { applied: hU, changedTaskIds: hUIds } = await upsertBatch(
    'harvests',
    changes.harvests?.updated ?? []
  );
  const { applied: iC, changedTaskIds: iCIds } = await upsertBatch(
    'inventory',
    changes.inventory?.created ?? []
  );
  const { applied: iU, changedTaskIds: iUIds } = await upsertBatch(
    'inventory',
    changes.inventory?.updated ?? []
  );
  const { applied: aC, changedTaskIds: aCIds } = await upsertBatch(
    'harvest_audits',
    changes.harvest_audits?.created ?? []
  );
  const { applied: aU, changedTaskIds: aUIds } = await upsertBatch(
    'harvest_audits',
    changes.harvest_audits?.updated ?? []
  );

  const applied = hC + hU + iC + iU + aC + aU;
  const changedIds = [
    ...hCIds,
    ...hUIds,
    ...iCIds,
    ...iUIds,
    ...aCIds,
    ...aUIds,
  ];

  return { applied, changedTaskIds: changedIds };
}

async function applyUpsertsInventoryConsumables(
  changes: SyncResponse['changes']
): Promise<{ applied: number; changedTaskIds: string[] }> {
  const { applied: iiC } = await upsertBatch(
    'inventory_items',
    changes.inventory_items?.created ?? []
  );
  const { applied: iiU } = await upsertBatch(
    'inventory_items',
    changes.inventory_items?.updated ?? []
  );
  const { applied: ibC } = await upsertBatch(
    'inventory_batches',
    changes.inventory_batches?.created ?? []
  );
  const { applied: ibU } = await upsertBatch(
    'inventory_batches',
    changes.inventory_batches?.updated ?? []
  );
  // inventory_movements: only created allowed (immutable)
  const { applied: imC } = await upsertBatch(
    'inventory_movements',
    changes.inventory_movements?.created ?? []
  );

  const applied = iiC + iiU + ibC + ibU + imC;

  return { applied, changedTaskIds: [] };
}

async function applyUpserts(
  changes: SyncResponse['changes']
): Promise<{ applied: number; changedTaskIds: string[] }> {
  const coreResult = await applyUpsertsCoreTables(changes);
  const harvestResult = await applyUpsertsHarvestTables(changes);
  const inventoryConsumablesResult =
    await applyUpsertsInventoryConsumables(changes);

  return {
    applied:
      coreResult.applied +
      harvestResult.applied +
      inventoryConsumablesResult.applied,
    changedTaskIds: [
      ...coreResult.changedTaskIds,
      ...harvestResult.changedTaskIds,
      ...inventoryConsumablesResult.changedTaskIds,
    ],
  };
}

async function applyDeletes(
  changes: SyncResponse['changes']
): Promise<{ applied: number; changedTaskIds: string[] }> {
  let applied = 0;
  const changedIds: string[] = [];

  // Core tables
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

  // Harvest tables
  const { applied: dH, changedTaskIds: dHIds } = await applyDeletesBatch(
    'harvests',
    changes.harvests?.deleted ?? []
  );
  const { applied: dI, changedTaskIds: dIIds } = await applyDeletesBatch(
    'inventory',
    changes.inventory?.deleted ?? []
  );
  const { applied: dA, changedTaskIds: dAIds } = await applyDeletesBatch(
    'harvest_audits',
    changes.harvest_audits?.deleted ?? []
  );

  // Inventory consumables tables
  const { applied: dII } = await applyDeletesBatch(
    'inventory_items',
    changes.inventory_items?.deleted ?? []
  );
  const { applied: dIB } = await applyDeletesBatch(
    'inventory_batches',
    changes.inventory_batches?.deleted ?? []
  );
  const { applied: dIM } = await applyDeletesBatch(
    'inventory_movements',
    changes.inventory_movements?.deleted ?? []
  );

  applied = dT + dS + dO + dH + dI + dA + dII + dIB + dIM;
  changedIds.push(...dTIds, ...dSIds, ...dOIds, ...dHIds, ...dIIds, ...dAIds);

  return { applied, changedTaskIds: changedIds };
}

async function applyServerChanges(
  resp: SyncResponse
): Promise<{ appliedCount: number; changedTaskIds: string[] }> {
  const _started = nowMs();
  const { changes } = resp;
  let appliedCount = 0;
  const changedIds: string[] = [];

  await database.write(async () => {
    const upsertResult = await applyUpserts(changes);
    const deleteResult = await applyDeletes(changes);

    appliedCount = upsertResult.applied + deleteResult.applied;
    changedIds.push(
      ...upsertResult.changedTaskIds,
      ...deleteResult.changedTaskIds
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

function getCollectionByTable<K extends TableName>(
  table: K,
  repos: CollectionsMap
): Collection<SyncModelMap[K]> {
  return repos[table];
}

function applyPayloadToRecord(
  target: ModelSnapshot,
  payload: RemoteChangePayload
): void {
  const targetRecord = target as Record<string, unknown>;
  for (const [key, value] of Object.entries(payload)) {
    // Preserve id and updatedAt handling outside; but copy server revision
    // and server timestamps as authoritative fields onto the local record
    if (key === 'id') continue;
    // Map server fields to local properties where appropriate
    if (key === 'server_revision') {
      if (value != null) {
        const numericValue = Number(value);
        if (Number.isFinite(numericValue)) {
          target.serverRevision = numericValue;
        }
      }
      continue;
    }
    if (key === 'server_updated_at_ms') {
      if (value != null) {
        const numericValue =
          typeof value === 'number'
            ? value
            : toMillis(value as Date | string | number | null | undefined);
        if (numericValue != null && Number.isFinite(numericValue)) {
          target.serverUpdatedAtMs = numericValue;
        }
      }
      continue;
    }
    if (key === 'updatedAt') continue;
    targetRecord[key] = _normalizeIncomingValue(key, value);
  }
}

function safeParseNumber(value: unknown): number | null {
  if (value == null) return null;
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : null;
}

function parseMetadataSafe(currentMetaRaw: unknown): Record<string, unknown> {
  let currentMeta: Record<string, unknown> = {};
  if (typeof currentMetaRaw === 'string' && currentMetaRaw.trim().length) {
    try {
      const parsed = JSON.parse(currentMetaRaw) as unknown;
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        !Array.isArray(parsed)
      ) {
        currentMeta = parsed as Record<string, unknown>;
      }
    } catch {
      currentMeta = {};
    }
  } else if (
    typeof currentMetaRaw === 'object' &&
    currentMetaRaw !== null &&
    !Array.isArray(currentMetaRaw)
  ) {
    currentMeta = currentMetaRaw as Record<string, unknown>;
  }
  return currentMeta;
}

export function maybeMarkNeedsReview(
  table: TableName,
  rec: ModelSnapshot,
  payload: RemoteChangePayload
): void {
  if (table !== 'tasks') return;

  // Prefer server_revision if present, otherwise compare server_updated_at_ms
  const record = rec as Record<string, unknown>;
  const localRevRaw =
    rec._raw?.server_revision ??
    rec.serverRevision ??
    (record._rev as unknown) ??
    null;
  const serverRevRaw = payload.server_revision ?? null;
  const localServerTsRaw =
    rec._raw?.server_updated_at_ms ??
    rec.serverUpdatedAtMs ??
    (record.server_updated_at_ms as unknown) ??
    toMillis(
      rec.updatedAt ??
        (record.updatedAt as Date | string | number | null | undefined) ??
        null
    );
  const serverServerTsRaw =
    payload.server_updated_at_ms ??
    toMillis(payload.updatedAt as Date | string | number | null | undefined);

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
    const currentMetaRaw = rec.metadata;
    const currentMeta = parseMetadataSafe(currentMetaRaw);
    rec.metadata = {
      ...currentMeta,
      needsReview: true,
    };
  }
}

async function handleCreate<ModelType extends Model>(
  coll: Collection<ModelType>,
  payload: RemoteChangePayload
): Promise<void> {
  await coll.create((rec) => {
    const record = rec as unknown as ModelSnapshot;
    if (record._raw) {
      record._raw.id = payload.id;
    }
    // Apply payload and authoritative server metadata. For createdAt/updatedAt
    // prefer server-provided values if present; do not synthesize from client
    applyPayloadToRecord(record, payload);
    if (payload.createdAt != null) {
      const normalizedCreated = _normalizeIncomingValue(
        'createdAt',
        payload.createdAt
      );
      if (normalizedCreated instanceof Date) {
        record.createdAt = normalizedCreated;
      }
    }
    if (payload.updatedAt != null) {
      const normalizedUpdated = _normalizeIncomingValue(
        'updatedAt',
        payload.updatedAt
      );
      if (normalizedUpdated instanceof Date) {
        record.updatedAt = normalizedUpdated;
      }
    }
    const revision = safeParseNumber(payload.server_revision);
    if (revision != null) {
      record.serverRevision = revision;
    }
    const serverUpdatedAt = safeParseNumber(payload.server_updated_at_ms);
    if (serverUpdatedAt != null) {
      record.serverUpdatedAtMs = serverUpdatedAt;
    }
  });
}

function determineServerAuthority(
  localData: { rev: number | null; serverTs: number | null },
  serverData: { rev: unknown; serverTs: unknown }
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

function applyServerPayloadToRecord(
  rec: ModelSnapshot,
  payload: RemoteChangePayload
): void {
  applyPayloadToRecord(rec, payload);
  if (payload.updatedAt != null) {
    const normalizedUpdated = _normalizeIncomingValue(
      'updatedAt',
      payload.updatedAt
    );
    if (normalizedUpdated instanceof Date) {
      rec.updatedAt = normalizedUpdated;
    }
  }
  const revision = safeParseNumber(payload.server_revision);
  if (revision != null && rec._raw) {
    rec._raw.server_revision = revision;
  }
  const serverUpdatedAt = safeParseNumber(payload.server_updated_at_ms);
  if (serverUpdatedAt != null && rec._raw) {
    rec._raw.server_updated_at_ms = serverUpdatedAt;
  }
}

function computeConflictResolutionValues(
  existing: ModelSnapshot,
  payload: RemoteChangePayload
) {
  const rawExisting = existing as Record<string, unknown>;
  const localRev =
    existing._raw?.server_revision ??
    existing.serverRevision ??
    (rawExisting._rev as unknown) ??
    null;
  const serverRev = payload.server_revision ?? null;
  const localServerTs =
    existing._raw?.server_updated_at_ms ??
    existing.serverUpdatedAtMs ??
    (rawExisting.server_updated_at_ms as unknown) ??
    toMillis(existing.updatedAt ?? null);
  const serverServerTs =
    payload.server_updated_at_ms ??
    toMillis(payload.updatedAt as Date | string | number | null | undefined);

  return { localRev, serverRev, localServerTs, serverServerTs };
}

function determineServerAuthorityWithRecordCheck(
  existing: ModelSnapshot,
  conflictValues: {
    localRev: number | null;
    serverRev: number | null;
    localServerTs: number | null;
    serverServerTs: number | null;
  }
): boolean {
  let serverIsAuthoritative = determineServerAuthority(
    { rev: conflictValues.localRev, serverTs: conflictValues.localServerTs },
    { rev: conflictValues.serverRev, serverTs: conflictValues.serverServerTs }
  );

  // Replace DB-wide hasUnsyncedChanges() with record-level check
  const hasUnsyncedRecord = existing._raw?._status !== 'synced';
  if (serverIsAuthoritative && hasUnsyncedRecord) {
    serverIsAuthoritative = false;
  }

  return serverIsAuthoritative;
}

async function handleUpdate<ModelType extends Model>(
  table: TableName,
  existing: ModelType,
  payload: RemoteChangePayload
): Promise<void> {
  // Conflict resolver disabled - using direct resolution
  // const resolver = createConflictResolver();

  // Pre-compute all values outside the synchronous update callback
  const { localRev, serverRev, localServerTs, serverServerTs } =
    computeConflictResolutionValues(
      existing as unknown as ModelSnapshot,
      payload
    );

  const parsedValues = {
    localRev: safeParseNumber(localRev),
    serverRev: safeParseNumber(serverRev),
    localServerTs: safeParseNumber(localServerTs),
    serverServerTs: safeParseNumber(serverServerTs),
  } as const;

  const serverIsAuthoritative = determineServerAuthorityWithRecordCheck(
    existing as unknown as ModelSnapshot,
    parsedValues
  );

  // Detect conflicts outside the update callback (disabled)
  // detectAndLogConflicts(resolver, table, { existing, payload });

  // Perform synchronous update
  await existing.update((rec) => {
    const record = rec as unknown as ModelSnapshot;
    maybeMarkNeedsReview(table, record, payload);

    if (serverIsAuthoritative) {
      applyServerPayloadToRecord(record, payload);
    }
  });
}

async function upsertBatch(
  table: TableName,
  payloads: RemoteChangePayload[]
): Promise<{ applied: number; changedTaskIds: string[] }> {
  const repos = getAllRepos();
  const coll = getCollectionByTable(table, repos);
  let applied = 0;
  const changedTaskIds: string[] = [];
  for (const payload of payloads) {
    try {
      let existing: Model | null = null;
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
  const repos = getAllRepos();
  const coll = getCollectionByTable(table, repos);
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

  // Get current user ID for RLS
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user?.id;

  // Enrich all records with user_id for RLS
  if (userId) addUserIdToChanges(toPush, userId);

  // Enforce immutability for inventory_movements (Requirements 1.4, 10.6)
  // Only 'created' movements are allowed; filter out any updated/deleted
  if (toPush.inventory_movements.updated.length > 0) {
    console.warn(
      `[Sync] Filtered ${toPush.inventory_movements.updated.length} invalid UPDATE operations on inventory_movements (immutable table)`
    );
    toPush.inventory_movements.updated = [];
  }
  if (toPush.inventory_movements.deleted.length > 0) {
    console.warn(
      `[Sync] Filtered ${toPush.inventory_movements.deleted.length} invalid DELETE operations on inventory_movements (immutable table)`
    );
    toPush.inventory_movements.deleted = [];
  }

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
  maxAttempts: number = 5,
  options: SyncRunOptions = {}
): Promise<SyncResult> {
  // Guard: return early if sync already in flight
  if (isSyncInFlight()) {
    throw new Error('sync already in flight');
  }

  const trigger: SyncTrigger = options.trigger ?? 'auto';
  let lastError: unknown = null;
  getSyncState().setSyncInFlight(true);
  try {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const attemptStart = nowMs();
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
            queryClient.invalidateQueries({ queryKey: ['harvests'] }),
            queryClient.invalidateQueries({ queryKey: ['inventory'] }),
          ]);
        } catch {}
        await setItem('sync.lastSuccessAt', nowMs());
        const durationMs = nowMs() - attemptStart;
        recordTotalDuration(durationMs);
        await emitSyncPerformanceSnapshot({
          trigger,
          attempt: attempt + 1,
          totalDurationMs: durationMs,
        });
        return { ...result, attempts: attempt + 1 };
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
