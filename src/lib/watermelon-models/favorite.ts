import { Model } from '@nozbe/watermelondb';
import { date, field } from '@nozbe/watermelondb/decorators';

import type { FavoriteStrainSnapshot } from '@/types';

/**
 * Favorite model for persisting user's favorite strains
 * Uses LWW (Last-Write-Wins) semantics with synced_at for conflict resolution
 */
export class FavoriteModel extends Model {
  static table = 'favorites';

  @field('strain_id') strainId!: string;
  @field('user_id') userId?: string;
  @field('added_at') addedAt!: number;
  @field('snapshot') snapshot!: string;
  @field('synced_at') syncedAt?: number;
  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
  @date('deleted_at') deletedAt?: Date;

  /**
   * Parse the JSON snapshot into typed object
   */
  get parsedSnapshot(): FavoriteStrainSnapshot {
    try {
      return JSON.parse(this.snapshot) as FavoriteStrainSnapshot;
    } catch (error) {
      console.error('[FavoriteModel] Failed to parse snapshot', error);
      // Return a safe default to prevent crashes
      return {
        id: this.strainId,
        name: 'Unknown Strain',
        race: 'hybrid',
        thc_display: 'Not reported',
        imageUrl: '',
      };
    }
  }

  /**
   * Check if this favorite needs to be synced
   */
  get needsSync(): boolean {
    return !this.syncedAt || this.updatedAt.getTime() > this.syncedAt;
  }
}
