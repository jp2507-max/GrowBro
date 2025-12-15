import { getOptionalAuthenticatedUserId } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import {
  getPlantsNeedingSync,
  markPlantsAsSynced,
  upsertRemotePlants,
} from '@/lib/watermelon-models/plants-repository';

type SyncResult = { pushed: number; pulled: number };

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return value.toISOString();
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export async function syncPlantsToCloud(): Promise<number> {
  const userId = await getOptionalAuthenticatedUserId();
  if (!userId) {
    if (__DEV__) {
      console.info('[PlantsSync] skipped push: no user session');
    }
    return 0;
  }

  const pending = await getPlantsNeedingSync(userId);
  if (pending.length === 0) {
    if (__DEV__) {
      console.info('[PlantsSync] no pending plants to push');
    }
    return 0;
  }

  const syncable = pending.filter((plant) => isUuid(plant.id));
  const skipped = pending.length - syncable.length;

  if (skipped > 0 && __DEV__) {
    console.warn('[PlantsSync] skipped plants with non-UUID ids', {
      skipped,
    });
  }

  if (syncable.length === 0) {
    return 0;
  }

  const startedAt = Date.now();

  const payload = syncable.map((plant) => ({
    id: plant.id,
    user_id: userId,
    name: plant.name,
    stage: plant.stage ?? null,
    strain: plant.strain ?? null,
    planted_at: plant.plantedAt ?? null,
    expected_harvest_at: plant.expectedHarvestAt ?? null,
    last_watered_at: plant.lastWateredAt ?? null,
    last_fed_at: plant.lastFedAt ?? null,
    health: plant.health ?? null,
    environment: plant.environment ?? null,
    photoperiod_type: plant.photoperiodType ?? null,
    genetic_lean: plant.geneticLean ?? null,
    image_url: plant.imageUrl ?? null,
    notes: plant.notes ?? null,
    metadata: plant.metadata ?? null,
    created_at: toIso(plant.createdAt) ?? new Date().toISOString(),
    updated_at: toIso(plant.updatedAt) ?? new Date().toISOString(),
  }));

  const { data, error } = await supabase
    .from('plants')
    .upsert(payload, { onConflict: 'id' })
    .select('id, updated_at');

  if (error) {
    console.error('[PlantsSync] failed to push plants', {
      message: error.message,
      code: error.code,
      details: error.details,
    });
    throw error;
  }

  const timestampMap =
    data?.reduce<Record<string, number>>((acc, row) => {
      const ts = row.updated_at
        ? new Date(row.updated_at).getTime()
        : Date.now();
      acc[row.id] = ts;
      return acc;
    }, {}) ?? {};

  await markPlantsAsSynced(
    syncable.map((p) => p.id),
    timestampMap
  );

  if (__DEV__) {
    const duration = Date.now() - startedAt;
    console.info(
      `[PlantsSync] pushed ${syncable.length} plant(s) to cloud in ${duration}ms`
    );
  }

  return syncable.length;
}

export async function pullPlantsFromCloud(): Promise<number> {
  const userId = await getOptionalAuthenticatedUserId();
  if (!userId) return 0;

  const { data, error } = await supabase
    .from('plants')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    throw error;
  }

  const rows = data ?? [];
  if (rows.length === 0) return 0;

  await upsertRemotePlants(rows);
  return rows.length;
}

export async function syncPlantsBidirectional(): Promise<SyncResult> {
  const pushed = await syncPlantsToCloud();
  const pulled = await pullPlantsFromCloud();
  return { pushed, pulled };
}
