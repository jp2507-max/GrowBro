import type { ImageMetadata, StorageInfo } from './storage-impl';
import {
  cleanupCacheImpl,
  cleanupOrphanedImagesImpl,
  DEFAULT_CACHE_LIMIT_BYTES,
  getImagePathImpl,
  getStorageUsageImpl,
  pruneOldDataImpl,
  storeImageImpl,
} from './storage-impl';

export type StorageManager = {
  getStorageUsage: () => Promise<StorageInfo>;
  cleanupCache: (maxBytes?: number) => Promise<void>;
  pruneOldData: (olderThan: Date) => Promise<void>;
  storeImage: (uri: string, metadata: ImageMetadata) => Promise<string>; // returns original path
  getImagePath: (id: string, size: 'original' | 'thumbnail') => string;
  cleanupOrphanedImages: () => Promise<void>;
};

/**
 * Creates a storage manager instance with configurable cache limits.
 * @param config - Configuration options for the storage manager
 * @returns A StorageManager instance
 */
export function createStorageManager(config?: {
  cacheLimitBytes?: number;
}): StorageManager {
  const cacheLimit = config?.cacheLimitBytes ?? DEFAULT_CACHE_LIMIT_BYTES;
  return {
    getStorageUsage: () => getStorageUsageImpl(cacheLimit),
    cleanupCache: (maxBytes?: number) =>
      cleanupCacheImpl(typeof maxBytes === 'number' ? maxBytes : cacheLimit),
    pruneOldData: (olderThan: Date) => pruneOldDataImpl(olderThan),
    storeImage: (uri: string, metadata: ImageMetadata) =>
      storeImageImpl(uri, metadata),
    getImagePath: (id: string, size: 'original' | 'thumbnail') =>
      getImagePathImpl(id, size),
    cleanupOrphanedImages: () => cleanupOrphanedImagesImpl(),
  };
}

export const storageManager = createStorageManager();
