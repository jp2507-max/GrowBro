import { Q } from '@nozbe/watermelondb';

import { runSql } from '@/lib/database/unsafe-sql-utils';
import { database } from '@/lib/watermelon';
import type { PlantModel } from '@/lib/watermelon-models/plant';

type RemotePlant = {
  id: string;
  user_id: string | null;
  name: string;
  stage?: string | null;
  strain?: string | null;
  planted_at?: string | null;
  expected_harvest_at?: string | null;
  last_watered_at?: string | null;
  last_fed_at?: string | null;
  health?: string | null;
  environment?: string | null;
  photoperiod_type?: string | null;
  genetic_lean?: string | null;
  image_url?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
  deleted_at?: string | null;
};

type DeletedPlantRow = Record<string, unknown>;

export type DeletedPlantRecord = {
  id: string;
  userId: string | null;
  deletedAt: Date;
  updatedAt: Date;
};

export type DeletedPlantPurgeCandidate = {
  id: string;
  userId: string | null;
  deletedAtMs: number;
};

function getCollection() {
  return database.get<PlantModel>('plants');
}

function toMillis(dateLike: string | null | undefined): number | null {
  if (!dateLike) return null;
  const d = new Date(dateLike);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

function toDate(dateLike: string | number | Date | null | undefined): Date {
  if (dateLike instanceof Date) return dateLike;
  if (typeof dateLike === 'number') return new Date(dateLike);
  if (typeof dateLike === 'string') return new Date(dateLike);
  return new Date();
}

function toDateFromUnknown(value: unknown): Date | null {
  if (value instanceof Date)
    return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'string') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function toMillisFromUnknown(value: unknown): number | null {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (value instanceof Date) return value.getTime();
  return null;
}

function dedupeRemotePlants(plants: RemotePlant[]): RemotePlant[] {
  const map = new Map<string, RemotePlant>();
  for (const plant of plants) {
    map.set(plant.id, plant);
  }
  return Array.from(map.values());
}

function toDeletedPlantRecord(row: DeletedPlantRow): DeletedPlantRecord | null {
  const id = typeof row.id === 'string' ? row.id : null;
  if (!id) return null;
  const userId = typeof row.user_id === 'string' ? row.user_id : null;
  const deletedAt = toDateFromUnknown(row.deleted_at ?? row.updated_at);
  const updatedAt = toDateFromUnknown(row.updated_at ?? row.deleted_at);
  if (!deletedAt || !updatedAt) return null;
  return {
    id,
    userId,
    deletedAt,
    updatedAt,
  };
}

export async function getDeletedPlantIds(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const placeholders = ids.map(() => '?').join(', ');
  const sql = `SELECT id FROM plants WHERE id IN (${placeholders}) AND _status = 'deleted'`;
  const results = await runSql('plants', sql, ids);
  const rows = results[0]?.rows?._array ?? [];
  const deletedIds = new Set<string>();
  for (const row of rows) {
    const id = typeof row.id === 'string' ? row.id : null;
    if (id) deletedIds.add(id);
  }
  return deletedIds;
}

export async function getDeletedPlantsForUser(
  userId: string
): Promise<DeletedPlantRecord[]> {
  if (!userId) return [];
  const results = await runSql(
    'plants',
    "SELECT id, user_id, deleted_at, updated_at FROM plants WHERE _status = 'deleted' AND (user_id = ? OR user_id IS NULL)",
    [userId]
  );
  const rows = results[0]?.rows?._array ?? [];
  return rows
    .map((row) => toDeletedPlantRecord(row))
    .filter((row): row is DeletedPlantRecord => Boolean(row));
}

export async function getDeletedPlantsForPurge(
  cutoffMs: number
): Promise<DeletedPlantPurgeCandidate[]> {
  const results = await runSql(
    'plants',
    "SELECT id, user_id, deleted_at FROM plants WHERE _status = 'deleted' AND deleted_at IS NOT NULL AND deleted_at <= ?",
    [cutoffMs]
  );
  const rows = results[0]?.rows?._array ?? [];
  return rows
    .map((row) => {
      const id = typeof row.id === 'string' ? row.id : null;
      if (!id) return null;
      const userId = typeof row.user_id === 'string' ? row.user_id : null;
      const deletedAtMs = toMillisFromUnknown(row.deleted_at);
      if (!deletedAtMs) return null;
      return { id, userId, deletedAtMs };
    })
    .filter((row): row is DeletedPlantPurgeCandidate => Boolean(row && row.id));
}

export async function purgeDeletedPlantsByIds(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  await database.write(
    () => database.adapter.destroyDeletedRecords('plants', ids),
    'purgeDeletedPlantsByIds'
  );
  return ids.length;
}

export async function getPlantsNeedingSync(
  userId?: string
): Promise<PlantModel[]> {
  const collection = getCollection();
  const query = userId
    ? collection.query(Q.where('user_id', userId))
    : collection.query();
  const plants = await query.fetch();

  return plants.filter((plant) => {
    const updatedAtMs = plant.updatedAt?.getTime() ?? 0;
    const serverMs = plant.serverUpdatedAtMs ?? 0;
    return serverMs < updatedAtMs;
  });
}

export async function claimLocalPlantsForUser(userId: string): Promise<number> {
  if (!userId) return 0;

  const collection = getCollection();
  const rows = await collection
    .query(Q.where('user_id', null), Q.where('deleted_at', null))
    .fetch();

  if (rows.length === 0) return 0;

  const now = new Date();
  await database.write(async () => {
    for (const row of rows) {
      await row.update((record) => {
        record.userId = userId;
        record.updatedAt = now;
      });
    }
  });

  return rows.length;
}

export async function markPlantsAsSynced(
  ids: string[],
  serverTimestamps: Record<string, number | undefined> = {}
): Promise<void> {
  if (ids.length === 0) return;
  const collection = getCollection();
  const rows = await collection.query(Q.where('id', Q.oneOf(ids))).fetch();

  const now = Date.now();

  await database.write(async () => {
    for (const row of rows) {
      const ts = serverTimestamps[row.id] ?? now;
      await row.update((record) => {
        record.serverUpdatedAtMs = ts;
      });
    }
  });
}

/** Update existing plant record from remote data */
async function updatePlantFromRemote(
  current: PlantModel,
  remote: RemotePlant,
  remoteUpdatedMs: number
): Promise<void> {
  await current.update((record) => {
    record.userId = remote.user_id ?? null;
    record.name = remote.name;
    record.stage = remote.stage ?? null;
    record.strain = remote.strain ?? null;
    record.plantedAt = remote.planted_at ?? null;
    record.expectedHarvestAt = remote.expected_harvest_at ?? null;
    record.lastWateredAt = remote.last_watered_at ?? null;
    record.lastFedAt = remote.last_fed_at ?? null;
    record.health = remote.health ?? null;
    record.environment = remote.environment ?? null;
    record.photoperiodType = remote.photoperiod_type ?? null;
    record.geneticLean = remote.genetic_lean ?? null;
    // Preserve local file:// URI if remote is null/empty
    const hasValidLocalPhoto = current.imageUrl?.startsWith('file://');
    const remoteHasPhoto =
      remote.image_url && !remote.image_url.startsWith('file://');
    if (remoteHasPhoto || !hasValidLocalPhoto) {
      record.imageUrl = remote.image_url ?? null;
    }
    if (remoteHasPhoto) {
      const meta = (record.metadata ?? {}) as Record<string, unknown>;
      meta.remoteImagePath = remote.image_url;
      record.metadata = meta;
    }
    record.notes = remote.notes ?? null;
    if (remote.metadata) {
      const existingMeta = (record.metadata ?? {}) as Record<string, unknown>;
      record.metadata = { ...existingMeta, ...remote.metadata };
    }
    record.updatedAt = toDate(remote.updated_at ?? Date.now());
    record.serverUpdatedAtMs = remoteUpdatedMs || Date.now();
  });
}

export async function applyRemotePlantDeletions(
  plants: RemotePlant[]
): Promise<number> {
  if (plants.length === 0) return 0;
  const deleted = plants.filter((plant) => plant.deleted_at);
  if (deleted.length === 0) return 0;

  const collection = getCollection();
  const existing = await collection
    .query(Q.where('id', Q.oneOf(deleted.map((plant) => plant.id))))
    .fetch();
  if (existing.length === 0) return 0;

  const existingMap = new Map(existing.map((model) => [model.id, model]));
  let applied = 0;

  await database.write(async () => {
    for (const remote of deleted) {
      const current = existingMap.get(remote.id);
      if (!current) continue;
      if (current.syncStatus === 'deleted') continue;

      const remoteDeletedAt = toDate(
        remote.deleted_at ?? remote.updated_at ?? Date.now()
      );
      const remoteUpdatedAt = toDate(
        remote.updated_at ?? remote.deleted_at ?? Date.now()
      );
      const remoteUpdatedMs =
        toMillis(remote.updated_at ?? remote.deleted_at) ??
        remoteUpdatedAt.getTime();

      await current.update((record) => {
        record.userId = remote.user_id ?? record.userId ?? null;
        record.deletedAt = remoteDeletedAt;
        record.updatedAt = remoteUpdatedAt;
        record.serverUpdatedAtMs = remoteUpdatedMs;
      });

      await current.markAsDeleted();
      applied += 1;
    }
  });

  return applied;
}

export async function upsertRemotePlants(
  plants: RemotePlant[]
): Promise<{ applied: number }> {
  if (plants.length === 0) return { applied: 0 };
  const uniquePlants = dedupeRemotePlants(plants);
  // If remote sends tombstones, they must be applied via applyRemotePlantDeletions()
  // to avoid resurrecting records here.
  const activePlants = uniquePlants.filter((p) => !p.deleted_at);
  const collection = getCollection();
  const deletedIds = await getDeletedPlantIds(
    activePlants.map((plant) => plant.id)
  );
  const existing = await collection
    .query(Q.where('id', Q.oneOf(activePlants.map((p) => p.id))))
    .fetch();
  const existingMap = new Map(existing.map((model) => [model.id, model]));
  let applied = 0;

  await database.write(async () => {
    for (const remote of activePlants) {
      if (deletedIds.has(remote.id)) continue;
      const remoteUpdatedMs = toMillis(remote.updated_at) ?? 0;
      const current = existingMap.get(remote.id);

      if (current) {
        const localUpdatedMs = current.updatedAt?.getTime() ?? 0;
        if (remoteUpdatedMs <= localUpdatedMs) continue;
        await updatePlantFromRemote(current, remote, remoteUpdatedMs);
        applied += 1;
      } else {
        await collection.create((record) => {
          record._raw.id = remote.id;
          record.userId = remote.user_id ?? null;
          record.name = remote.name;
          record.stage = remote.stage ?? null;
          record.strain = remote.strain ?? null;
          record.plantedAt = remote.planted_at ?? null;
          record.expectedHarvestAt = remote.expected_harvest_at ?? null;
          record.lastWateredAt = remote.last_watered_at ?? null;
          record.lastFedAt = remote.last_fed_at ?? null;
          record.health = remote.health ?? null;
          record.environment = remote.environment ?? null;
          record.photoperiodType = remote.photoperiod_type ?? null;
          record.geneticLean = remote.genetic_lean ?? null;
          record.imageUrl = remote.image_url ?? null;
          record.notes = remote.notes ?? null;
          record.metadata = remote.metadata ?? undefined;
          const created = toDate(remote.created_at ?? Date.now());
          const updated = toDate(
            remote.updated_at ?? remote.created_at ?? Date.now()
          );
          record.createdAt = created;
          record.updatedAt = updated;
          record.serverUpdatedAtMs = remoteUpdatedMs || updated.getTime();
        });
        applied += 1;
      }
    }
  });

  return { applied };
}

export async function getAllPlantsForUser(
  userId?: string
): Promise<PlantModel[]> {
  const collection = getCollection();
  const query = userId
    ? collection.query(Q.where('user_id', userId))
    : collection.query();
  return query.fetch();
}
