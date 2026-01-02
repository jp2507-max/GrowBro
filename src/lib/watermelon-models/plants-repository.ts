import { Q } from '@nozbe/watermelondb';

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

export async function upsertRemotePlants(
  plants: RemotePlant[]
): Promise<{ applied: number }> {
  if (plants.length === 0) return { applied: 0 };
  const collection = getCollection();
  const existing = await collection
    .query(Q.where('id', Q.oneOf(plants.map((p) => p.id))))
    .fetch();
  const existingMap = new Map(existing.map((model) => [model.id, model]));

  await database.write(async () => {
    for (const remote of plants) {
      const remoteUpdatedMs = toMillis(remote.updated_at) ?? 0;
      const current = existingMap.get(remote.id);

      if (current) {
        const localUpdatedMs = current.updatedAt?.getTime() ?? 0;
        if (remoteUpdatedMs <= localUpdatedMs) continue;
        await updatePlantFromRemote(current, remote, remoteUpdatedMs);
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
      }
    }
  });

  return { applied: plants.length };
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
