import * as FileSystem from 'expo-file-system';

import { storage } from '@/lib/storage';

const CACHE_SIZE_KEY = 'assessment_cache_size';
const CACHE_METADATA_KEY = 'assessment_cache_metadata';
const DEFAULT_MAX_CACHE_SIZE = 500 * 1024 * 1024; // 500MB
const ACTIVE_ASSESSMENT_DAYS = 7; // Don't delete images from assessments < 7 days old

interface CacheEntry {
  uri: string;
  size: number;
  lastAccessed: number;
  assessmentId: string;
  createdAt: number;
}

interface CacheMetadata {
  entries: Record<string, CacheEntry>;
  totalSize: number;
}

/**
 * LRU Cache Manager for assessment images
 * Enforces storage limits and cleans up old/unused images
 */
export class ImageCacheManager {
  private maxCacheSize: number;

  constructor(maxCacheSize: number = DEFAULT_MAX_CACHE_SIZE) {
    this.maxCacheSize = maxCacheSize;
  }

  /**
   * Get current cache metadata
   */
  private async getMetadata(): Promise<CacheMetadata> {
    const stored = storage.getString(CACHE_METADATA_KEY);
    if (!stored) {
      return { entries: {}, totalSize: 0 };
    }

    try {
      return JSON.parse(stored) as CacheMetadata;
    } catch {
      return { entries: {}, totalSize: 0 };
    }
  }

  /**
   * Save cache metadata
   */
  private async saveMetadata(metadata: CacheMetadata): Promise<void> {
    storage.set(CACHE_METADATA_KEY, JSON.stringify(metadata));
    storage.set(CACHE_SIZE_KEY, metadata.totalSize);
  }

  /**
   * Add image to cache tracking
   */
  async add(params: {
    uri: string;
    size: number;
    assessmentId: string;
    createdAt?: number;
  }): Promise<void> {
    const { uri, size, assessmentId, createdAt = Date.now() } = params;
    const metadata = await this.getMetadata();
    const now = Date.now();

    if (metadata.entries[uri]) {
      metadata.totalSize -= metadata.entries[uri].size;
    }

    metadata.totalSize += size;
    metadata.entries[uri] = {
      uri,
      size,
      lastAccessed: now,
      assessmentId,
      createdAt,
    };
    metadata.totalSize = Math.max(0, metadata.totalSize);

    await this.saveMetadata(metadata);

    // Cleanup if over limit
    if (metadata.totalSize > this.maxCacheSize) {
      await this.cleanup();
    }
  }

  /**
   * Update last accessed timestamp for an image
   */
  async touch(uri: string): Promise<void> {
    const metadata = await this.getMetadata();
    if (metadata.entries[uri]) {
      metadata.entries[uri].lastAccessed = Date.now();
      await this.saveMetadata(metadata);
    }
  }

  /**
   * Get current cache size in bytes
   */
  async getSize(): Promise<number> {
    const metadata = await this.getMetadata();
    return metadata.totalSize;
  }

  /**
   * Cleanup old images to free space
   * Returns number of bytes freed
   */
  async cleanup(): Promise<number> {
    const metadata = await this.getMetadata();
    const now = Date.now();
    const activeThreshold = now - ACTIVE_ASSESSMENT_DAYS * 24 * 60 * 60 * 1000;

    // Sort entries by last accessed (LRU)
    const sortedEntries = Object.values(metadata.entries).sort(
      (a, b) => a.lastAccessed - b.lastAccessed
    );

    let freedBytes = 0;
    const toDelete: string[] = [];

    // Delete oldest entries until under limit
    for (const entry of sortedEntries) {
      // Don't delete from active assessments
      if (entry.createdAt > activeThreshold) {
        continue;
      }

      // Check if file still exists
      const info = await FileSystem.getInfoAsync(entry.uri);
      if (!info.exists) {
        // File already deleted, just remove from metadata
        const size = entry.size;
        metadata.totalSize -= size;
        metadata.totalSize = Math.max(0, metadata.totalSize);
        delete metadata.entries[entry.uri];
        freedBytes += size;
        continue;
      }

      // Delete file if we're still over limit
      if (metadata.totalSize - freedBytes > this.maxCacheSize) {
        try {
          await FileSystem.deleteAsync(entry.uri, { idempotent: true });
          toDelete.push(entry.uri);
          freedBytes += entry.size;
        } catch (error) {
          console.error('Failed to delete cached image:', error);
        }
      } else {
        break; // Under limit, stop deleting
      }
    }

    // Update metadata
    for (const uri of toDelete) {
      const entrySize = metadata.entries[uri]?.size ?? 0;
      metadata.totalSize -= entrySize;
      delete metadata.entries[uri];
    }

    await this.saveMetadata(metadata);
    return freedBytes;
  }

  /**
   * Clear entire cache
   */
  async clear(): Promise<void> {
    const metadata = await this.getMetadata();

    for (const entry of Object.values(metadata.entries)) {
      try {
        await FileSystem.deleteAsync(entry.uri, { idempotent: true });
      } catch (error) {
        console.error('Failed to delete cached image:', error);
      }
    }

    await this.saveMetadata({ entries: {}, totalSize: 0 });
  }

  /**
   * Remove specific assessment from cache
   */
  async removeAssessment(assessmentId: string): Promise<number> {
    const metadata = await this.getMetadata();
    let freedBytes = 0;

    const toDelete = Object.values(metadata.entries).filter(
      (entry) => entry.assessmentId === assessmentId
    );

    for (const entry of toDelete) {
      try {
        await FileSystem.deleteAsync(entry.uri, { idempotent: true });
        const size = metadata.entries[entry.uri]?.size ?? 0;
        metadata.totalSize -= size;
        metadata.totalSize = Math.max(0, metadata.totalSize);
        delete metadata.entries[entry.uri];
        freedBytes += size;
      } catch (error) {
        console.error('Failed to delete assessment image:', error);
      }
    }

    await this.saveMetadata(metadata);
    return freedBytes;
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    totalSize: number;
    entryCount: number;
    oldestEntry: number | null;
    newestEntry: number | null;
  }> {
    const metadata = await this.getMetadata();
    const entries = Object.values(metadata.entries);

    return {
      totalSize: metadata.totalSize,
      entryCount: entries.length,
      oldestEntry:
        entries.length > 0
          ? Math.min(...entries.map((e) => e.lastAccessed))
          : null,
      newestEntry:
        entries.length > 0
          ? Math.max(...entries.map((e) => e.lastAccessed))
          : null,
    };
  }
}

// Singleton instance
export const imageCacheManager = new ImageCacheManager();
