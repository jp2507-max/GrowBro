import type { Database } from '@nozbe/watermelondb';
import { Q } from '@nozbe/watermelondb';

import type { Strain } from '@/types';

import type { CachedStrainModel } from './cached-strain';

/**
 * Cache TTL in milliseconds (5 minutes as per design requirements)
 */
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Repository for managing cached strain pages for offline browsing
 */
export class CachedStrainsRepository {
  private database: Database;
  private collection;

  constructor(database: Database) {
    this.database = database;
    this.collection = this.database.get<CachedStrainModel>('cached_strains');
  }

  /**
   * Generate a consistent hash from query parameters
   */
  private generateQueryHash(params: {
    searchQuery?: string;
    filters?: Record<string, unknown>;
    sortBy?: string;
    sortDirection?: string;
  }): string {
    const normalized = JSON.stringify({
      q: params.searchQuery || '',
      f: params.filters || {},
      s: params.sortBy || 'name',
      d: params.sortDirection || 'asc',
    });

    // Simple hash function for query parameters
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return hash.toString(36);
  }

  /**
   * Find a cached page
   */
  async findCachedPage(
    queryHash: string,
    pageNumber: number
  ): Promise<CachedStrainModel | null> {
    const results = await this.collection
      .query(
        Q.where('query_hash', queryHash),
        Q.where('page_number', pageNumber)
      )
      .fetch();

    if (results.length === 0) {
      return null;
    }

    const cached = results[0];

    // Check if expired
    if (cached.isExpired) {
      // Delete expired entry
      await this.database.write(async () => {
        await cached.destroyPermanently();
      });
      return null;
    }

    return cached;
  }

  /**
   * Cache a page of strains
   */
  async cachePage(
    params: {
      searchQuery?: string;
      filters?: Record<string, unknown>;
      sortBy?: string;
      sortDirection?: string;
    },
    pageNumber: number,
    strains: Strain[]
  ): Promise<CachedStrainModel> {
    const queryHash = this.generateQueryHash(params);
    const now = Date.now();

    // Check if already cached
    const existing = await this.findCachedPage(queryHash, pageNumber);

    if (existing) {
      // Update existing cache
      return this.database.write(async () => {
        return existing.update((record) => {
          record.strainsData = JSON.stringify(strains);
          record.cachedAt = now;
          record.expiresAt = now + CACHE_TTL_MS;
        });
      });
    }

    // Create new cache entry
    return this.database.write(async () => {
      return this.collection.create((record) => {
        record.queryHash = queryHash;
        record.pageNumber = pageNumber;
        record.strainsData = JSON.stringify(strains);
        record.cachedAt = now;
        record.expiresAt = now + CACHE_TTL_MS;
      });
    });
  }

  /**
   * Get cached strains for a page
   */
  async getCachedStrains(
    params: {
      searchQuery?: string;
      filters?: Record<string, unknown>;
      sortBy?: string;
      sortDirection?: string;
    },
    pageNumber: number
  ): Promise<Strain[] | null> {
    const queryHash = this.generateQueryHash(params);
    const cached = await this.findCachedPage(queryHash, pageNumber);

    if (!cached) {
      return null;
    }

    return cached.parsedStrains;
  }

  /**
   * Clear all cached pages for a specific query
   */
  async clearCacheForQuery(params: {
    searchQuery?: string;
    filters?: Record<string, unknown>;
    sortBy?: string;
    sortDirection?: string;
  }): Promise<void> {
    const queryHash = this.generateQueryHash(params);

    await this.database.write(async () => {
      const cached = await this.collection
        .query(Q.where('query_hash', queryHash))
        .fetch();

      for (const entry of cached) {
        await entry.destroyPermanently();
      }
    });
  }

  /**
   * Clear all expired cache entries
   */
  async clearExpiredCache(): Promise<number> {
    const now = Date.now();

    const expired = await this.collection
      .query(Q.where('expires_at', Q.lt(now)))
      .fetch();

    await this.database.write(async () => {
      for (const entry of expired) {
        await entry.destroyPermanently();
      }
    });

    return expired.length;
  }

  /**
   * Clear all cached strains
   */
  async clearAllCache(): Promise<number> {
    const all = await this.collection.query().fetch();

    await this.database.write(async () => {
      for (const entry of all) {
        await entry.destroyPermanently();
      }
    });

    return all.length;
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    totalEntries: number;
    totalSize: number;
    expiredEntries: number;
    oldestEntry: Date | null;
    newestEntry: Date | null;
  }> {
    const all = await this.collection.query().fetch();

    let totalSize = 0;
    let expiredCount = 0;
    let oldestTimestamp: number | null = null;
    let newestTimestamp: number | null = null;

    for (const entry of all) {
      totalSize += entry.strainsData.length;

      if (entry.isExpired) {
        expiredCount++;
      }

      if (oldestTimestamp === null || entry.cachedAt < oldestTimestamp) {
        oldestTimestamp = entry.cachedAt;
      }

      if (newestTimestamp === null || entry.cachedAt > newestTimestamp) {
        newestTimestamp = entry.cachedAt;
      }
    }

    return {
      totalEntries: all.length,
      totalSize,
      expiredEntries: expiredCount,
      oldestEntry: oldestTimestamp ? new Date(oldestTimestamp) : null,
      newestEntry: newestTimestamp ? new Date(newestTimestamp) : null,
    };
  }

  /**
   * Find a single strain by id or slug across cached pages.
   * Skips expired entries to avoid stale data.
   */
  async findStrainByIdOrSlug(idOrSlug: string): Promise<Strain | null> {
    const all = await this.collection.query().fetch();
    const now = Date.now();

    const expiredEntries: CachedStrainModel[] = [];
    let foundMatch: Strain | null = null;

    for (const entry of all) {
      if (entry.expiresAt < now) {
        expiredEntries.push(entry);
        continue;
      }

      if (!foundMatch) {
        const match = entry.parsedStrains.find(
          (strain) => strain.id === idOrSlug || strain.slug === idOrSlug
        );
        if (match) {
          foundMatch = match;
        }
      }
    }

    // Clean up expired entries in a single transaction
    if (expiredEntries.length > 0) {
      try {
        await this.database.write(async () => {
          await Promise.all(
            expiredEntries.map((entry) => entry.destroyPermanently())
          );
        });
      } catch (error) {
        console.error(
          `[CachedStrainsRepository] Failed to delete ${expiredEntries.length} expired entries:`,
          error
        );
      }
    }

    return foundMatch;
  }
}
