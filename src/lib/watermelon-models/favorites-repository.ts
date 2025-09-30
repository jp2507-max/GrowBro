import type { Database } from '@nozbe/watermelondb';
import { Q } from '@nozbe/watermelondb';

import type { FavoriteStrain, FavoriteStrainSnapshot, Strain } from '@/types';

import type { FavoriteModel } from './favorite';

/**
 * Repository for managing favorites with batch operations
 * Implements LWW conflict resolution and sync support
 */
export class FavoritesRepository {
  private database: Database;
  private collection;

  constructor(database: Database) {
    this.database = database;
    this.collection = this.database.get<FavoriteModel>('favorites');
  }

  /**
   * Find a favorite by strain ID for the current user
   */
  async findByStrainId(
    strainId: string,
    userId?: string
  ): Promise<FavoriteModel | null> {
    const query = [Q.where('strain_id', strainId), Q.where('deleted_at', null)];

    if (userId) {
      query.push(Q.where('user_id', userId));
    }

    const favorites = await this.collection.query(...query).fetch();

    return favorites.length > 0 ? favorites[0] : null;
  }

  /**
   * Get all favorites for a user
   */
  async getAllFavorites(userId?: string): Promise<FavoriteModel[]> {
    const query = [Q.where('deleted_at', null), Q.sortBy('added_at', Q.desc)];

    if (userId) {
      query.push(Q.where('user_id', userId));
    }

    return this.collection.query(...query).fetch();
  }

  /**
   * Get all favorites that need syncing
   */
  async getFavoritesNeedingSync(userId?: string): Promise<FavoriteModel[]> {
    const query = [Q.where('deleted_at', null)];

    if (userId) {
      query.push(Q.where('user_id', userId));
    }

    const favorites = await this.collection.query(...query).fetch();

    return favorites.filter((f) => f.needsSync);
  }

  /**
   * Add a favorite (or update if exists)
   */
  async addFavorite(strain: Strain, userId?: string): Promise<FavoriteModel> {
    const existing = await this.findByStrainId(strain.id, userId);

    if (existing) {
      // Update existing favorite
      return this.database.write(async () => {
        return existing.update((record) => {
          record.addedAt = Date.now();
          record.syncedAt = undefined; // Mark as needing sync
        });
      });
    }

    // Create new favorite
    const snapshot: FavoriteStrainSnapshot = {
      id: strain.id,
      name: strain.name,
      race: strain.race,
      thc_display: strain.thc_display,
      imageUrl: strain.imageUrl,
    };

    return this.database.write(async () => {
      return this.collection.create((record) => {
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
  async removeFavorite(strainId: string, userId?: string): Promise<void> {
    const favorite = await this.findByStrainId(strainId, userId);

    if (!favorite) {
      return;
    }

    await this.database.write(async () => {
      await favorite.update((record) => {
        record.deletedAt = new Date();
        record.syncedAt = undefined; // Mark as needing sync
      });
    });
  }

  /**
   * Check if a strain is favorited
   */
  async isFavorite(strainId: string, userId?: string): Promise<boolean> {
    const favorite = await this.findByStrainId(strainId, userId);
    return favorite !== null;
  }

  /**
   * Batch add multiple favorites
   */
  async batchAddFavorites(
    strains: Strain[],
    userId?: string
  ): Promise<FavoriteModel[]> {
    return this.database.write(async () => {
      const results: FavoriteModel[] = [];

      for (const strain of strains) {
        const existing = await this.findByStrainId(strain.id, userId);

        if (existing) {
          const updated = await existing.update((record) => {
            record.addedAt = Date.now();
            record.syncedAt = undefined;
          });
          results.push(updated);
        } else {
          const snapshot: FavoriteStrainSnapshot = {
            id: strain.id,
            name: strain.name,
            race: strain.race,
            thc_display: strain.thc_display,
            imageUrl: strain.imageUrl,
          };

          const created = await this.collection.create((record) => {
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
  async markAsSynced(favoriteIds: string[]): Promise<void> {
    await this.database.write(async () => {
      const favorites = await this.collection
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
  toFavoriteStrain(model: FavoriteModel): FavoriteStrain {
    return {
      id: model.strainId,
      addedAt: model.addedAt,
      snapshot: model.parsedSnapshot,
    };
  }

  /**
   * Get all favorites as FavoriteStrain array
   */
  async getAllAsFavoriteStrains(userId?: string): Promise<FavoriteStrain[]> {
    const models = await this.getAllFavorites(userId);
    return models.map((m) => this.toFavoriteStrain(m));
  }
}
