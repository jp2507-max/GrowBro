/**
 * Sync queue manager for offline favorites
 * Handles queuing and syncing favorites when offline
 */

import { getOptionalAuthenticatedUserId } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { database } from '@/lib/watermelon';
import type { FavoriteModel } from '@/lib/watermelon-models/favorite';
import { createFavoritesRepository } from '@/lib/watermelon-models/favorites-repository';

interface SyncQueueStats {
  pendingCount: number;
  lastSyncAt: number | null;
  lastSyncError: string | null;
}

/**
 * Get count of favorites needing sync
 */
export async function getPendingSyncCount(): Promise<number> {
  const userId = await getOptionalAuthenticatedUserId();
  if (!userId) return 0;

  const repo = createFavoritesRepository(database);
  const pending = await repo.getFavoritesNeedingSync(userId);
  return pending.length;
}

/**
 * Sync favorites to cloud
 * Returns number of items synced
 */
export async function syncFavoritesToCloud(): Promise<number> {
  const userId = await getOptionalAuthenticatedUserId();
  if (!userId) {
    throw new Error('User not authenticated');
  }

  const repo = createFavoritesRepository(database);
  const favoritesNeedingSync = await repo.getAllFavoritesNeedingSync(userId);

  if (favoritesNeedingSync.length === 0) {
    return 0;
  }

  // Prepare upsert data
  const upsertData = favoritesNeedingSync.map((favorite) => ({
    user_id: userId,
    strain_id: favorite.strainId,
    added_at: favorite.addedAt,
    snapshot: favorite.snapshot,
    updated_at: favorite.updatedAt.toISOString(),
    deleted_at: favorite.deletedAt?.toISOString() || null,
  }));

  // Sync to Supabase
  const { error } = await supabase.from('favorites').upsert(upsertData, {
    onConflict: 'user_id,strain_id',
    ignoreDuplicates: false,
  });

  if (error) {
    throw new Error(`Supabase sync failed: ${error.message}`);
  }

  // Mark as synced
  const syncedIds = favoritesNeedingSync.map((f) => f.id);
  await repo.markAsSynced(syncedIds);

  return favoritesNeedingSync.length;
}

/**
 * Pull favorites from cloud and merge with local
 * Implements LWW conflict resolution
 */
export async function pullFavoritesFromCloud(): Promise<number> {
  const userId = await getOptionalAuthenticatedUserId();
  if (!userId) {
    throw new Error('User not authenticated');
  }

  // Fetch from Supabase
  const { data: remoteFavorites, error } = await supabase
    .from('favorites')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to pull favorites: ${error.message}`);
  }

  if (!remoteFavorites || remoteFavorites.length === 0) {
    return 0;
  }

  const repo = createFavoritesRepository(database);
  let mergedCount = 0;

  // Merge each remote favorite with local
  for (const remote of remoteFavorites) {
    const local = await repo.findByStrainId(remote.strain_id, userId);

    if (!local) {
      // Remote only: create local
      await database.write(async () => {
        await database.get('favorites').create((record: FavoriteModel) => {
          record.strainId = remote.strain_id;
          record.userId = userId;
          record.addedAt = remote.added_at;
          record.snapshot = remote.snapshot;
          record.syncedAt = Date.now();
          record.deletedAt = remote.deleted_at
            ? new Date(remote.deleted_at)
            : null;
        });
      });
      mergedCount++;
    } else {
      // Both exist: use LWW (Last-Write-Wins)
      const remoteUpdatedAt = new Date(remote.updated_at).getTime();
      const localUpdatedAt = local.updatedAt.getTime();

      if (remoteUpdatedAt > localUpdatedAt) {
        // Remote is newer: update local
        await database.write(async () => {
          await local.update((record) => {
            record.addedAt = remote.added_at;
            record.snapshot = remote.snapshot;
            record.syncedAt = Date.now();
            record.deletedAt = remote.deleted_at
              ? new Date(remote.deleted_at)
              : null;
          });
        });
        mergedCount++;
      }
    }
  }

  return mergedCount;
}

/**
 * Full bidirectional sync: pull then push
 */
export async function fullSync(): Promise<{
  pulled: number;
  pushed: number;
}> {
  const pulled = await pullFavoritesFromCloud();
  const pushed = await syncFavoritesToCloud();

  return { pulled, pushed };
}

/**
 * Get sync queue statistics
 */
export async function getSyncQueueStats(): Promise<SyncQueueStats> {
  const pendingCount = await getPendingSyncCount();

  // Get last sync time from storage
  const { storage } = await import('@/lib/storage');
  const lastSyncAt = storage.getNumber('favorites_last_sync_at') || null;
  const lastSyncError = storage.getString('favorites_last_sync_error') || null;

  return {
    pendingCount,
    lastSyncAt,
    lastSyncError,
  };
}

/**
 * Clear sync error
 */
export async function clearSyncError(): Promise<void> {
  const { storage } = await import('@/lib/storage');
  storage.delete('favorites_last_sync_error');
}
