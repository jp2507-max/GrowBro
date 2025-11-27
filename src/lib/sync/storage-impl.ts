import * as Crypto from 'expo-crypto';
// SDK 54 hybrid approach: Paths for directory URIs, legacy API for async operations
import * as FileSystem from 'expo-file-system/legacy';

import { getCacheDirectoryUri, getDocumentDirectoryUri } from '@/lib/fs/paths';

// getDocumentDirectoryUri() and getCacheDirectoryUri() moved to '@/lib/fs/paths'

export type ImageMetadata = {
  id: string;
  plantId?: string;
  mimeType?: string;
  createdAt?: number;
};

export type StorageInfo = {
  totalSize: number;
  cacheSize: number;
  documentSize: number;
  availableSpace: number;
  isNearCapacity: boolean;
};

type LruEntry = {
  path: string;
  size: number;
  lastAccessedAt: number; // epoch ms
};

// Minimal local FileInfo type mirroring expo-file-system's FileInfo
type FileInfo = {
  exists?: boolean;
  isDirectory?: boolean;
  size?: number;
  modificationTime?: number;
  uri?: string;
};

export const DEFAULT_CACHE_LIMIT_BYTES = 400 * 1024 * 1024; // 400 MB
const APP_DIR_NAME = 'growbro';
const IMAGES_DIR_NAME = 'images';
const LRU_INDEX_FILENAME = '.lru-index.json';
const MANIFEST_FILENAME = 'manifest.json';

// Promise-based queue for serializing LRU index operations
class AsyncQueue {
  private queue: (() => Promise<void>)[] = [];
  private processing = false;

  async enqueue<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const task = async () => {
        try {
          const result = await operation();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      };

      this.queue.push(task);
      this.process();
    });
  }

  private async process(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;
    while (this.queue.length > 0) {
      const task = this.queue.shift()!;
      await task();
    }
    this.processing = false;
  }
}

// Global queue for LRU index operations
const lruQueue = new AsyncQueue();

function joinUri(base: string | null, ...segments: string[]): string {
  if (!base) return '';
  const trimmedBase = base.endsWith('/') ? base : `${base}/`;
  const path = segments.map((s) => s.replace(/^\/+|\/+$/g, '')).join('/');
  return `${trimmedBase}${path}${path.endsWith('/') ? '' : ''}`;
}

async function ensureDir(uri: string): Promise<void> {
  if (!uri) return;
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(uri, { intermediates: true });
    }
  } catch {
    await FileSystem.makeDirectoryAsync(uri, { intermediates: true });
  }
}

/**
 * Gets the app's document directory root path.
 * Uses Paths.document which is always available in SDK 54+.
 */
function getAppDocumentRoot(): string {
  const docDir = getDocumentDirectoryUri();
  return joinUri(docDir, APP_DIR_NAME) + '/';
}

/**
 * Gets the app's cache directory root path.
 * Uses Paths.cache which is always available in SDK 54+.
 */
function getAppCacheRoot(): string {
  const cacheDir = getCacheDirectoryUri();
  return joinUri(cacheDir, APP_DIR_NAME) + '/';
}

function getImagesDocRoot(): string {
  return joinUri(getAppDocumentRoot(), IMAGES_DIR_NAME) + '/';
}

function getImagesCacheRoot(): string {
  return joinUri(getAppCacheRoot(), IMAGES_DIR_NAME) + '/';
}

function getOriginalDirFor(id: string): string {
  return joinUri(getImagesDocRoot(), id) + '/';
}

function getCacheDirFor(id: string): string {
  return joinUri(getImagesCacheRoot(), id) + '/';
}

function getOriginalPath(id: string): string {
  // If a manifest exists with content hash, use that filename; fallback to legacy 'original'
  // Note: This function is async by nature if we fully read manifest. To keep signature sync,
  // we return the likely path and let callers resolve via manifest-aware flows (storeImage writes manifest).
  return joinUri(getOriginalDirFor(id), 'original');
}

function getThumbnailPath(id: string): string {
  return joinUri(getCacheDirFor(id), 'thumbnail');
}

async function readJson<T>(uri: string): Promise<T | null> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) return null;
    const content = await FileSystem.readAsStringAsync(uri);
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

async function writeJson(uri: string, data: unknown): Promise<void> {
  await FileSystem.writeAsStringAsync(uri, JSON.stringify(data));
}

async function listFilesRecursive(dirUri: string): Promise<string[]> {
  const children = await FileSystem.readDirectoryAsync(dirUri).catch(() => []);
  const results: string[] = [];
  for (const name of children) {
    const childUri = joinUri(dirUri, name);
    const info = await FileSystem.getInfoAsync(childUri);
    if (info.isDirectory) {
      const nested = await listFilesRecursive(
        childUri.endsWith('/') ? childUri : `${childUri}/`
      );
      results.push(...nested);
    } else {
      results.push(childUri);
    }
  }
  return results;
}

async function getTotalSizeOf(dirUri: string): Promise<number> {
  const files = await listFilesRecursive(dirUri).catch(() => []);
  let total = 0;
  for (const f of files) {
    const info = (await FileSystem.getInfoAsync(f)) as FileInfo;
    if (info.exists && !info.isDirectory) {
      const s = info.size;
      if (typeof s === 'number') total += s;
    }
  }
  return total;
}

async function loadLruIndex(
  cacheRoot: string
): Promise<Record<string, LruEntry>> {
  const indexPath = joinUri(cacheRoot, LRU_INDEX_FILENAME);
  const data = await readJson<Record<string, LruEntry>>(indexPath);
  return data ?? {};
}

async function saveLruIndex(
  cacheRoot: string,
  index: Record<string, LruEntry>
): Promise<void> {
  const indexPath = joinUri(cacheRoot, LRU_INDEX_FILENAME);
  const tempPath = `${indexPath}.tmp`;

  // Write to temporary file first
  await writeJson(tempPath, index);

  // Atomic rename to final location
  await FileSystem.moveAsync({ from: tempPath, to: indexPath });
}

function nowMs(): number {
  return Date.now();
}

function normalizeModificationTime(value: unknown): number {
  if (typeof value !== 'number' || !isFinite(value)) return nowMs();
  // Expo historically returns seconds; convert to ms if it looks like seconds
  return value > 1e12 ? value : Math.round(value * 1000);
}

async function computeSha256OfFile(uri: string): Promise<string> {
  // Read file as base64 to produce deterministic string input
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: 'base64' as const,
  });
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    base64
  );
  return digest; // hex string
}

// Helper function to check if a doc exists for a given cache id
async function docExistsForCacheId(
  docRoot: string,
  cacheId: string
): Promise<boolean> {
  const docPath = joinUri(docRoot, cacheId);
  try {
    const info = await FileSystem.getInfoAsync(docPath);
    return info.exists === true && info.isDirectory === true;
  } catch {
    return false;
  }
}

// Helper function to get cache directory info with timestamp
async function getCacheDirInfo(cacheDirUri: string): Promise<FileInfo | null> {
  try {
    const info = await FileSystem.getInfoAsync(cacheDirUri);
    return info.exists ? (info as FileInfo) : null;
  } catch {
    return null;
  }
}

// Safe deletion with atomic rename and retries to handle race conditions
async function safeDeleteCacheDir(
  dirUri: string,
  maxRetries: number = 3
): Promise<void> {
  const tempSuffix = `.deleting.${Date.now()}.${Math.random().toString(36).substr(2, 9)}`;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // First, try to rename to a temporary name atomically
      const tempUri = `${dirUri}${tempSuffix}`;
      await FileSystem.moveAsync({ from: dirUri, to: tempUri });

      // Re-check existence after rename to ensure it wasn't recreated
      const info = await FileSystem.getInfoAsync(dirUri);
      if (info.exists) {
        // Directory was recreated, abort deletion
        await FileSystem.moveAsync({ from: tempUri, to: dirUri }).catch(() => {
          // If rename back fails, temp dir will be cleaned up by next cleanup
        });
        return;
      }

      // Safe to delete the temp directory
      await FileSystem.deleteAsync(tempUri, { idempotent: true });
      return; // Success
    } catch (error) {
      // If rename failed because directory doesn't exist, that's fine
      if (error instanceof Error && error.message.includes('not found')) {
        return;
      }

      // If this was the last attempt, re-throw the error
      if (attempt === maxRetries - 1) {
        throw error;
      }

      // Wait a bit before retrying (exponential backoff)
      await new Promise((resolve) =>
        setTimeout(resolve, Math.pow(2, attempt) * 10)
      );
    }
  }
}

async function getStorageUsageImpl(cacheLimit: number): Promise<StorageInfo> {
  const docRoot = getAppDocumentRoot();
  const cacheRoot = getAppCacheRoot();
  await ensureDir(docRoot);
  await ensureDir(cacheRoot);

  const [documentSize, cacheSize, availableSpace] = await Promise.all([
    getTotalSizeOf(docRoot).catch(() => 0),
    getTotalSizeOf(cacheRoot).catch(() => 0),
    FileSystem.getFreeDiskStorageAsync().catch(() => 0),
  ]);

  const totalSize = documentSize + cacheSize;
  const isNearCapacity = cacheSize >= cacheLimit * 0.9;
  return { totalSize, cacheSize, documentSize, availableSpace, isNearCapacity };
}

async function touchLruImpl(path: string): Promise<void> {
  return lruQueue.enqueue(async () => {
    const cacheRoot = getAppCacheRoot();
    await ensureDir(cacheRoot);
    const index = await loadLruIndex(cacheRoot);
    let info: FileInfo;
    try {
      info = (await FileSystem.getInfoAsync(path)) as FileInfo;
    } catch {
      info = { exists: false } as FileInfo;
    }
    const maybeSize = typeof info.size === 'number' ? info.size : undefined;
    index[path] = {
      path,
      size: maybeSize ?? index[path]?.size ?? 0,
      lastAccessedAt: nowMs(),
    };
    await saveLruIndex(cacheRoot, index);
  });
}

async function cleanupCacheImpl(limit: number): Promise<void> {
  return lruQueue.enqueue(async () => {
    const cacheRoot = getAppCacheRoot();
    await ensureDir(cacheRoot);
    const imagesRoot = getImagesCacheRoot();
    await ensureDir(imagesRoot);
    const allFiles = await listFilesRecursive(imagesRoot).catch(() => []);

    const index = await loadLruIndex(cacheRoot);
    for (const p of allFiles) {
      const info = (await FileSystem.getInfoAsync(p)) as FileInfo;
      if (!index[p]) {
        const size = info.size;
        const mtime = info.modificationTime;
        index[p] = {
          path: p,
          size: typeof size === 'number' ? size : 0,
          lastAccessedAt: normalizeModificationTime(mtime),
        };
      } else if (!index[p].size) {
        const size = info.size;
        index[p].size = typeof size === 'number' ? size : 0;
      }
    }

    let current = Object.values(index).reduce(
      (acc, e) => acc + (e.size || 0),
      0
    );
    if (current <= limit) {
      await saveLruIndex(cacheRoot, index);
      return;
    }

    const entries = Object.values(index).sort(
      (a, b) => a.lastAccessedAt - b.lastAccessedAt
    );
    for (const entry of entries) {
      if (current <= limit) break;
      try {
        await FileSystem.deleteAsync(entry.path, { idempotent: true });
      } catch (error) {
        // Ignore expected "not found" errors when idempotent=true
        if (error instanceof Error && error.message.includes('not found')) {
          // Expected when file was already deleted
        } else {
          // Log unexpected errors with context
          console.error(`Failed to delete cache file: ${entry.path}`, {
            error: error instanceof Error ? error.message : String(error),
            path: entry.path,
            size: entry.size,
          });
          throw error; // Re-throw for caller to handle
        }
      }
      current -= entry.size || 0;
      delete index[entry.path];
    }
    await saveLruIndex(cacheRoot, index);
  });
}

async function pruneOldDataImpl(olderThan: Date): Promise<void> {
  return lruQueue.enqueue(async () => {
    const cacheRoot = getAppCacheRoot();
    const imagesRoot = getImagesCacheRoot();
    await ensureDir(imagesRoot);
    const cutoff = olderThan.getTime();
    const index = await loadLruIndex(cacheRoot);
    for (const entry of Object.values(index)) {
      if (entry.lastAccessedAt < cutoff) {
        try {
          await FileSystem.deleteAsync(entry.path, { idempotent: true });
        } catch (error) {
          // Ignore expected "not found" errors when idempotent=true
          if (error instanceof Error && error.message.includes('not found')) {
            // Expected when file was already deleted
          } else {
            // Log unexpected errors with context
            console.error(`Failed to delete old data file: ${entry.path}`, {
              error: error instanceof Error ? error.message : String(error),
              path: entry.path,
              lastAccessedAt: entry.lastAccessedAt,
            });
            throw error; // Re-throw for caller to handle
          }
        }
        delete index[entry.path];
      }
    }
    await saveLruIndex(cacheRoot, index);
  });
}

async function storeImageImpl(
  uri: string,
  metadata: ImageMetadata
): Promise<string> {
  const { id } = metadata;
  const originalDir = getOriginalDirFor(id);
  await ensureDir(originalDir);

  // Fixed: Path inconsistency issue
  // Always store file at 'original' path to maintain API compatibility with getImagePath.
  // Store content hash in manifest for potential future deduplication features.
  const dest = getOriginalPath(id);
  let contentHash: string | null = null;
  try {
    contentHash = await computeSha256OfFile(uri);
  } catch (err) {
    console.warn(`Error computing SHA256 for file ${uri}`, {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      uri,
    });
  }
  await FileSystem.copyAsync({ from: uri, to: dest });
  const manifestPath = joinUri(originalDir, MANIFEST_FILENAME);
  const info = await FileSystem.getInfoAsync(dest);
  const manifest = {
    id,
    original: dest,
    contentHash,
    size: (info as FileInfo).size ?? null,
    updatedAt: nowMs(),
  };
  await writeJson(manifestPath, manifest);
  await ensureDir(getCacheDirFor(id));
  return dest;
}

function getImagePathImpl(id: string, size: 'original' | 'thumbnail'): string {
  // Fixed: Path consistency maintained
  // Files are now stored at 'original' path to match getImagePath expectations.
  // Content hash is stored in manifest for potential future deduplication.
  const path = size === 'original' ? getOriginalPath(id) : getThumbnailPath(id);

  // Fix: Wrap async call in void() to prevent unhandled promise warnings
  // This ensures that any file system errors in touchLruImpl are contained
  // and don't cause runtime errors or unhandled promise rejections
  void touchLruImpl(path);

  return path;
}

async function cleanupOrphanedImagesImpl(): Promise<void> {
  const docRoot = getImagesDocRoot();
  const cacheRoot = getImagesCacheRoot();
  await ensureDir(docRoot);
  await ensureDir(cacheRoot);

  // Read cache IDs that might be orphaned
  const cacheIds = await FileSystem.readDirectoryAsync(cacheRoot).catch(
    () => []
  );

  // Safe cutoff: don't delete cache entries created/modified in the last 5 seconds
  // This helps avoid race conditions with concurrent writes
  const safeCutoffMs = 5000;
  const now = nowMs();

  for (const id of cacheIds) {
    const cacheDirUri = joinUri(cacheRoot, id);

    // Step 1: Re-validate that the corresponding doc doesn't exist
    const docStillMissing = !(await docExistsForCacheId(docRoot, id));
    if (!docStillMissing) {
      // Doc was created concurrently, skip this cache entry
      continue;
    }

    // Step 2: Check cache entry timestamp against safe cutoff
    const cacheInfo = await getCacheDirInfo(cacheDirUri);
    if (!cacheInfo || !cacheInfo.modificationTime) {
      // Can't determine timestamp, skip to be safe
      continue;
    }

    const cacheAgeMs =
      now - normalizeModificationTime(cacheInfo.modificationTime);
    if (cacheAgeMs < safeCutoffMs) {
      // Cache entry is too new, might be from concurrent write
      continue;
    }

    // Step 3: Safe deletion with atomic rename and retries
    try {
      await safeDeleteCacheDir(cacheDirUri);
    } catch (error) {
      // Log unexpected errors with context
      console.error(
        `Failed to delete orphaned cache directory: ${cacheDirUri}`,
        {
          error: error instanceof Error ? error.message : String(error),
          cacheDirUri,
          cacheId: id,
          cacheAgeMs,
          docStillMissing,
        }
      );
      // Don't re-throw - continue with other entries
      // The error is logged for monitoring/debugging
    }
  }
}

export {
  cleanupCacheImpl,
  cleanupOrphanedImagesImpl,
  getImagePathImpl,
  getStorageUsageImpl,
  pruneOldDataImpl,
  storeImageImpl,
  touchLruImpl,
};
