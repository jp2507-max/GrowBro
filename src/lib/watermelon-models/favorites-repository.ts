/* eslint-disable max-lines-per-function */
import type { Database } from '@nozbe/watermelondb';
import { Q } from '@nozbe/watermelondb';

import type { FavoriteStrain, FavoriteStrainSnapshot, Strain } from '@/types';

import type { FavoriteModel } from './favorite';

type FavoritesRepository = {
  findByStrainId: (
    strainId: string,
    userId?: string
  ) => Promise<FavoriteModel | null>;
  getAllFavorites: (userId?: string) => Promise<FavoriteModel[]>;
  getFavoritesNeedingSync: (userId?: string) => Promise<FavoriteModel[]>;
  getAllFavoritesNeedingSync: (userId?: string) => Promise<FavoriteModel[]>;
  addFavorite: (strain: Strain, userId?: string) => Promise<FavoriteModel>;
  removeFavorite: (strainId: string, userId?: string) => Promise<void>;
  isFavorite: (strainId: string, userId?: string) => Promise<boolean>;
  batchAddFavorites: (
    strains: Strain[],
    userId?: string
  ) => Promise<FavoriteModel[]>;
  markAsSynced: (favoriteIds: string[]) => Promise<void>;
  toFavoriteStrain: (model: FavoriteModel) => FavoriteStrain;
  getAllAsFavoriteStrains: (userId?: string) => Promise<FavoriteStrain[]>;
};

/**
 * Repository for managing favorites with batch operations
 * Implements LWW conflict resolution and sync support
 */
export function createFavoritesRepository(
  database: Database
): FavoritesRepository {
  const collection = database.get<FavoriteModel>('favorites');

  /**
   * Create a snapshot from a strain
   */
  function createSnapshotFromStrain(strain: Strain): FavoriteStrainSnapshot {
    return {
      id: strain.id,
      name: strain.name,
      slug: strain.slug,
      race: strain.race,
      thc_display: strain.thc_display,
      imageUrl: strain.imageUrl,
    };
  }

  /**
   * Find a favorite by strain ID for the current user
   */
  async function findByStrainId(
    strainId: string,
    userId?: string
  ): Promise<FavoriteModel | null> {
    const query = [Q.where('strain_id', strainId), Q.where('deleted_at', null)];

    if (userId) {
      query.push(Q.where('user_id', userId));
    }

    const favorites = await collection.query(...query).fetch();

    return favorites.length > 0 ? favorites[0] : null;
  }

  /**
   * Get all favorites for a user
   */
  async function getAllFavorites(userId?: string): Promise<FavoriteModel[]> {
    const query = [Q.where('deleted_at', null), Q.sortBy('added_at', 'desc')];

    if (userId) {
      query.push(Q.where('user_id', userId));
    }

    return collection.query(...query).fetch();
  }

  /**
   * Get all favorites that need syncing
   */
  async function getFavoritesNeedingSync(
    userId?: string
  ): Promise<FavoriteModel[]> {
    const query = [Q.where('deleted_at', null)];

    if (userId) {
      query.push(Q.where('user_id', userId));
    }

    const favorites = await collection.query(...query).fetch();

    return favorites.filter((f) => f.needsSync);
  }

  /**
   * Get all favorites that need syncing, including soft-deleted ones
   */
  async function getAllFavoritesNeedingSync(
    userId?: string
  ): Promise<FavoriteModel[]> {
    const query = [];

    if (userId) {
      query.push(Q.where('user_id', userId));
    }

    const favorites = await collection.query(...query).fetch();

    return favorites.filter((f) => f.needsSync);
  }

  /**
   * Add a favorite (or update if exists)
   */
  async function addFavorite(
    strain: Strain,
    userId?: string
  ): Promise<FavoriteModel> {
    return database.write(async () => {
      const existing = await findByStrainId(strain.id, userId);

      if (existing) {
        // Update existing favorite
        return existing.update((record) => {
          record.addedAt = Date.now();
          record.syncedAt = undefined; // Mark as needing sync
        });
      }

      // Create new favorite
      const snapshot = createSnapshotFromStrain(strain);

      return collection.create((record) => {
        record.strainId = strain.id;
        record.userId = userId;
        record.addedAt = Date.now();
        record.snapshot = JSON.stringify(snapshot);
      });
    });
  }

  /**
   * Remove a favorite (soft delete)
   */
  async function removeFavorite(
    strainId: string,
    userId?: string
  ): Promise<void> {
    const favorite = await findByStrainId(strainId, userId);

    if (!favorite) {
      return;
    }

    await database.write(async () => {
      await favorite.update((record) => {
        record.deletedAt = new Date();
        record.syncedAt = undefined; // Mark as needing sync
      });
    });
  }

  /**
   * Check if a strain is favorited
   */
  async function isFavorite(
    strainId: string,
    userId?: string
  ): Promise<boolean> {
    const favorite = await findByStrainId(strainId, userId);
    return favorite !== null;
  }

  /**
   * Batch add multiple favorites
   */
  async function batchAddFavorites(
    strains: Strain[],
    userId?: string
  ): Promise<FavoriteModel[]> {
    return database.write(async () => {
      const strainIds = strains.map((s) => s.id);
      const query = [
        Q.where('strain_id', Q.oneOf(strainIds)),
        Q.where('deleted_at', null),
      ];

      if (userId) {
        query.push(Q.where('user_id', userId));
      }

      const existingFavorites = await collection.query(...query).fetch();
      const existingMap = new Map<string, FavoriteModel>();

      for (const favorite of existingFavorites) {
        existingMap.set(favorite.strainId, favorite);
      }

      const results: FavoriteModel[] = [];

      for (const strain of strains) {
        const existing = existingMap.get(strain.id);

        if (existing) {
          const updated = await existing.update((record) => {
            record.addedAt = Date.now();
            record.syncedAt = undefined;
          });
          results.push(updated);
        } else {
          const snapshot = createSnapshotFromStrain(strain);

          const created = await collection.create((record) => {
            record.strainId = strain.id;
            record.userId = userId;
            record.addedAt = Date.now();
            record.snapshot = JSON.stringify(snapshot);
          });
          results.push(created);
        }
      }

      return results;
    });
  }

  /**
   * Mark favorites as synced
   */
  async function markAsSynced(favoriteIds: string[]): Promise<void> {
    await database.write(async () => {
      const favorites = await collection
        .query(Q.where('id', Q.oneOf(favoriteIds)))
        .fetch();

      for (const favorite of favorites) {
        await favorite.update((record) => {
          record.syncedAt = Date.now();
        });
      }
    });
  }

  /**
   * Convert model to FavoriteStrain type for app use
   */
  function toFavoriteStrain(model: FavoriteModel): FavoriteStrain {
    return {
      id: model.strainId,
      addedAt: model.addedAt,
      snapshot: model.parsedSnapshot,
    };
  }

  /**
   * Get all favorites as FavoriteStrain array
   */
  async function getAllAsFavoriteStrains(
    userId?: string
  ): Promise<FavoriteStrain[]> {
    const models = await getAllFavorites(userId);
    return models.map((m) => toFavoriteStrain(m));
  }

  return {
    findByStrainId,
    getAllFavorites,
    getFavoritesNeedingSync,
    getAllFavoritesNeedingSync,
    addFavorite,
    removeFavorite,
    isFavorite,
    batchAddFavorites,
    markAsSynced,
    toFavoriteStrain,
    getAllAsFavoriteStrains,
  };
}
