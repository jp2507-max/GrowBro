import { queryClient } from '@/api/common/api-provider';
import { getOptionalAuthenticatedUserId } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { DeletedPlantRecord } from '@/lib/watermelon-models/plants-repository';
import {
  applyRemotePlantDeletions,
  claimLocalPlantsForUser,
  getDeletedPlantsForPurge,
  getDeletedPlantsForUser,
  getPlantsNeedingSync,
  markPlantsAsSynced,
  purgeDeletedPlantsByIds,
  upsertRemotePlants,
} from '@/lib/watermelon-models/plants-repository';

import {
  getPlantDeletionRetentionCutoffIso,
  getPlantDeletionRetentionCutoffMs,
} from './plant-retention-config';

type RemotePlant = Parameters<typeof upsertRemotePlants>[0][number];

type SyncResult = { pushed: number; pulled: number };

let plantsSyncPromise: Promise<SyncResult> | null = null;
let plantsSyncQueued = false;

let plantsPushPromise: Promise<number> | null = null;
let plantsPushQueued = false;

let pushDebounceTimer: ReturnType<typeof setTimeout> | null = null;

export function requestPlantsPush(delayMs: number = 300): void {
  // Debounce frequent triggers (e.g., create plant, then immediately update remote_image_path)
  if (pushDebounceTimer) return;
  pushDebounceTimer = setTimeout(() => {
    pushDebounceTimer = null;
    void syncPlantsToCloud().catch((error) => {
      console.warn('[PlantsSync] debounced push failed', error);
    });
  }, delayMs);
}

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return value.toISOString();
}

function getDeletionTimestampIso(
  record: DeletedPlantRecord,
  referenceMs: number
): string {
  const deletedAtMs = record.deletedAt?.getTime?.();
  const effectiveMs =
    typeof deletedAtMs === 'number' && !Number.isNaN(deletedAtMs)
      ? Math.min(deletedAtMs, referenceMs)
      : referenceMs;
  return new Date(effectiveMs).toISOString();
}

async function invalidatePlantQueries(): Promise<void> {
  await Promise.all([
    queryClient
      .invalidateQueries({ queryKey: ['plants-infinite'] })
      .catch(() => {}),
    queryClient.invalidateQueries({ queryKey: ['plant'] }).catch(() => {}),
  ]);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

type PlantData = Awaited<ReturnType<typeof getPlantsNeedingSync>>[number];

/** Build the upsert payload for a plant */
function buildPlantPayload(plant: PlantData, userId: string): RemotePlant {
  const metadata =
    plant.metadata && typeof plant.metadata === 'object' ? plant.metadata : {};

  // Prefer the dedicated remoteImagePath column if available
  let remoteImagePath: string | null = null;
  if (
    'remoteImagePath' in plant &&
    typeof plant.remoteImagePath === 'string' &&
    plant.remoteImagePath.length > 0
  ) {
    remoteImagePath = plant.remoteImagePath;
  } else if (
    'remoteImagePath' in metadata &&
    typeof metadata.remoteImagePath === 'string' &&
    metadata.remoteImagePath.length > 0
  ) {
    remoteImagePath = metadata.remoteImagePath;
  } else if (plant.imageUrl && !plant.imageUrl.startsWith('file://')) {
    remoteImagePath = plant.imageUrl;
  }

  const cloudImageUrl = remoteImagePath;

  return {
    id: plant.id,
    user_id: userId,
    name: plant.name,
    stage: plant.stage ?? null,
    strain: plant.strain ?? null,
    planted_at: plant.plantedAt ?? null,
    stage_entered_at: plant.stageEnteredAt ?? null,
    expected_harvest_at: plant.expectedHarvestAt ?? null,
    last_watered_at: plant.lastWateredAt ?? null,
    last_fed_at: plant.lastFedAt ?? null,
    health: plant.health ?? null,
    environment: plant.environment ?? null,
    photoperiod_type: plant.photoperiodType ?? null,
    genetic_lean: plant.geneticLean ?? null,
    image_url: cloudImageUrl,
    notes: plant.notes ?? null,
    metadata: plant.metadata ?? null,
    remote_image_path: remoteImagePath,
    created_at: toIso(plant.createdAt) ?? new Date().toISOString(),
    updated_at: toIso(plant.updatedAt) ?? new Date().toISOString(),
  };
}

async function syncDeletedPlantsToCloud(): Promise<number> {
  const userId = await getOptionalAuthenticatedUserId();
  if (!userId) {
    if (__DEV__)
      console.info('[PlantsSync] skipped delete push: no user session');
    return 0;
  }

  const deletedPlants = await getDeletedPlantsForUser(userId);
  if (deletedPlants.length === 0) {
    if (__DEV__) console.info('[PlantsSync] no deleted plants to push');
    return 0;
  }

  // Use UPDATE instead of UPSERT to avoid NOT NULL constraint violations
  // Only mark existing cloud records as deleted (plants never synced are skipped)
  const now = new Date();
  const updatedAtIso = now.toISOString();
  const referenceMs = now.getTime();
  const updates = deletedPlants
    .filter((plant) => plant.userId === userId)
    .map((plant) => ({
      id: plant.id,
      user_id: userId,
      deleted_at: getDeletionTimestampIso(plant, referenceMs),
      updated_at: updatedAtIso,
    }));

  if (updates.length === 0) {
    if (__DEV__)
      console.info(
        '[PlantsSync] deleted plants belong to another user; skipping cloud push'
      );
    return 0;
  }

  const { error } = await supabase.rpc('batch_mark_plants_deleted', {
    updates,
  });

  if (error) {
    console.error('[PlantsSync] failed to batch-mark plants deleted', {
      rows: updates.length,
      message: error.message,
      code: error.code,
      details: error.details,
    });
    throw error;
  }

  if (__DEV__) {
    console.info(
      `[PlantsSync] pushed ${updates.length} deleted plant(s) to cloud`
    );
  }

  return updates.length;
}

async function hardDeleteExpiredPlantsFromCloud(
  userId: string
): Promise<string[]> {
  const cutoffIso = getPlantDeletionRetentionCutoffIso();
  const { data, error } = await supabase
    .from('plants')
    .delete()
    .eq('user_id', userId)
    .lte('deleted_at', cutoffIso)
    .select('id');

  if (error) {
    console.error('[PlantsSync] failed to hard delete expired plants', {
      message: error.message,
      code: error.code,
      details: error.details,
    });
    throw error;
  }

  return data?.map((row) => row.id) ?? [];
}

async function purgeExpiredDeletedPlantsLocally(
  cloudDeletedIds: Set<string>
): Promise<number> {
  const candidates = await getDeletedPlantsForPurge(
    getPlantDeletionRetentionCutoffMs()
  );
  if (candidates.length === 0) return 0;

  // Only purge plants that have been hard-deleted from the cloud OR lack server timestamps while still assigned to a user.
  // Unassigned plants (userId: null) are retained until cloud confirms deletion to prevent
  // accidental data loss during offline periods or before user authentication.
  const ids = candidates
    .filter(
      (candidate) =>
        cloudDeletedIds.has(candidate.id) ||
        (candidate.userId && !candidate.serverUpdatedAtMs)
    )
    .map((candidate) => candidate.id);

  if (ids.length === 0) return 0;
  return purgeDeletedPlantsByIds(ids);
}

async function syncPlantsToCloudOnce(): Promise<number> {
  const userId = await getOptionalAuthenticatedUserId();
  if (!userId) {
    if (__DEV__) console.info('[PlantsSync] skipped push: no user session');
    return 0;
  }

  const claimed = await claimLocalPlantsForUser(userId);
  if (claimed > 0 && __DEV__) {
    console.info(`[PlantsSync] claimed ${claimed} local plant(s) for user`);
  }

  const pending = await getPlantsNeedingSync(userId);
  if (pending.length === 0) {
    if (__DEV__) console.info('[PlantsSync] no pending plants to push');
    return 0;
  }

  const syncable = pending.filter((plant) => isUuid(plant.id));
  const skipped = pending.length - syncable.length;
  if (skipped > 0 && __DEV__) {
    console.warn('[PlantsSync] skipped plants with non-UUID ids', { skipped });
  }
  if (syncable.length === 0) return 0;

  const startedAt = Date.now();
  const payload = syncable.map((p) => buildPlantPayload(p, userId));

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
      acc[row.id] = row.updated_at
        ? new Date(row.updated_at).getTime()
        : Date.now();
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

export async function syncPlantsToCloud(): Promise<number> {
  // Coalesce concurrent callers and re-run once if requested while in-flight.
  if (plantsPushPromise) {
    plantsPushQueued = true;
    return await plantsPushPromise;
  }

  plantsPushQueued = false;
  const run = (async () => {
    let result = 0;
    do {
      plantsPushQueued = false;
      result = await syncPlantsToCloudOnce();
    } while (plantsPushQueued);
    return result;
  })();

  plantsPushPromise = run;
  try {
    return await run;
  } finally {
    if (plantsPushPromise === run) {
      if (plantsPushQueued) {
        // Preserve queued requests that arrived during teardown.
        plantsPushPromise = null;
        plantsPushPromise = syncPlantsToCloud().catch((err) => {
          console.warn('[PlantsSync] queued continuation failed', err);
          return 0;
        });
      } else {
        plantsPushPromise = null;
      }
    }
  }
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

  const deleted = rows.filter((row) => row.deleted_at);
  const active = rows.filter((row) => !row.deleted_at);
  const { applied: activeApplied } = await upsertRemotePlants(active);
  const deletedApplied = await applyRemotePlantDeletions(deleted);
  return activeApplied + deletedApplied;
}

export async function syncPlantsBidirectional(): Promise<SyncResult> {
  if (plantsSyncPromise) {
    plantsSyncQueued = true;
    return await plantsSyncPromise;
  }

  plantsSyncQueued = false;
  const run = (async () => {
    let result: SyncResult;
    do {
      plantsSyncQueued = false;
      const deletedPushed = await syncDeletedPlantsToCloud();
      const pushed = await syncPlantsToCloud();
      const pulled = await pullPlantsFromCloud();
      const userId = await getOptionalAuthenticatedUserId();
      const cloudDeletedIds = userId
        ? await hardDeleteExpiredPlantsFromCloud(userId)
        : [];
      const purgedLocal = await purgeExpiredDeletedPlantsLocally(
        new Set(cloudDeletedIds)
      );
      await invalidatePlantQueries();
      if (__DEV__) {
        if (cloudDeletedIds.length > 0) {
          console.info(
            `[PlantsSync] hard deleted ${cloudDeletedIds.length} plant(s) from cloud`
          );
        }
        if (purgedLocal > 0) {
          console.info(
            `[PlantsSync] purged ${purgedLocal} local deleted plant(s)`
          );
        }
      }
      result = { pushed: pushed + deletedPushed, pulled };
    } while (plantsSyncQueued);
    return result;
  })();

  plantsSyncPromise = run;
  try {
    return await run;
  } finally {
    if (plantsSyncPromise === run) {
      if (plantsSyncQueued) {
        // Re-arm a new run to preserve queued requests
        plantsSyncPromise = null;
        plantsSyncPromise = syncPlantsBidirectional();
      } else {
        plantsSyncPromise = null;
      }
    }
  }
}
