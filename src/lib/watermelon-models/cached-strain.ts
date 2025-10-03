import { Model } from '@nozbe/watermelondb';
import { date, field } from '@nozbe/watermelondb/decorators';

import type { Strain } from '@/types';

/**
 * CachedStrain model for offline browsing support
 * Stores pages of strain data with expiration for cache invalidation
 */
export class CachedStrainModel extends Model {
  static table = 'cached_strains';

  @field('query_hash') queryHash!: string;
  @field('page_number') pageNumber!: number;
  @field('strains_data') strainsData!: string;
  @field('cached_at') cachedAt!: number;
  @field('expires_at') expiresAt!: number;
  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;

  /**
   * Parse the JSON strains data into typed array
   */
  get parsedStrains(): Strain[] {
    try {
      return JSON.parse(this.strainsData) as Strain[];
    } catch (error) {
      console.error('[CachedStrainModel] Failed to parse strains data', error);
      return [];
    }
  }

  /**
   * Check if this cache entry is expired
   */
  get isExpired(): boolean {
    return Date.now() > this.expiresAt;
  }

  /**
   * Get the age of this cache entry in seconds
   */
  get ageInSeconds(): number {
    return Math.floor((Date.now() - this.cachedAt) / 1000);
  }
}
