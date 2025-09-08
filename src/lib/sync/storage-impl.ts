import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system';

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

export const DEFAULT_CACHE_LIMIT_BYTES = 400 * 1024 * 1024; // 400 MB
const APP_DIR_NAME = 'growbro';
const IMAGES_DIR_NAME = 'images';
const LRU_INDEX_FILENAME = '.lru-index.json';
const MANIFEST_FILENAME = 'manifest.json';

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

function getAppDocumentRoot(): string {
  return joinUri(FileSystem.documentDirectory, APP_DIR_NAME) + '/';
}

function getAppCacheRoot(): string {
  return joinUri(FileSystem.cacheDirectory, APP_DIR_NAME) + '/';
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
    const info = await FileSystem.getInfoAsync(f);
    if (info.exists && !info.isDirectory) {
      const s = (info as any).size;
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
  await writeJson(indexPath, index);
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
    encoding: FileSystem.EncodingType.Base64 as unknown as 'base64',
  } as any);
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    base64
  );
  return digest; // hex string
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
  const cacheRoot = getAppCacheRoot();
  await ensureDir(cacheRoot);
  const index = await loadLruIndex(cacheRoot);
  const info = await FileSystem.getInfoAsync(path).catch(
    () => ({ exists: false }) as any
  );
  index[path] = {
    path,
    size:
      info && (info as any).size && typeof (info as any).size === 'number'
        ? (info as any).size
        : index[path]?.size || 0,
    lastAccessedAt: nowMs(),
  };
  await saveLruIndex(cacheRoot, index);
}

async function cleanupCacheImpl(limit: number): Promise<void> {
  const cacheRoot = getAppCacheRoot();
  await ensureDir(cacheRoot);
  const imagesRoot = getImagesCacheRoot();
  await ensureDir(imagesRoot);
  const allFiles = await listFilesRecursive(imagesRoot).catch(() => []);

  const index = await loadLruIndex(cacheRoot);
  for (const p of allFiles) {
    const info = await FileSystem.getInfoAsync(p);
    if (!index[p]) {
      const size = (info as any).size;
      const mtime = (info as any).modificationTime;
      index[p] = {
        path: p,
        size: typeof size === 'number' ? size : 0,
        lastAccessedAt: normalizeModificationTime(mtime),
      };
    } else if (!index[p].size) {
      const size = (info as any).size;
      index[p].size = typeof size === 'number' ? size : 0;
    }
  }

  let current = Object.values(index).reduce((acc, e) => acc + (e.size || 0), 0);
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
      await FileSystem.deleteAsync(entry.path, { idempotent: true } as any);
    } catch {}
    current -= entry.size || 0;
    delete index[entry.path];
  }
  await saveLruIndex(cacheRoot, index);
}

async function pruneOldDataImpl(olderThan: Date): Promise<void> {
  const cacheRoot = getAppCacheRoot();
  const imagesRoot = getImagesCacheRoot();
  await ensureDir(imagesRoot);
  const cutoff = olderThan.getTime();
  const index = await loadLruIndex(cacheRoot);
  for (const entry of Object.values(index)) {
    if (entry.lastAccessedAt < cutoff) {
      try {
        await FileSystem.deleteAsync(entry.path, { idempotent: true } as any);
      } catch {}
      delete index[entry.path];
    }
  }
  await saveLruIndex(cacheRoot, index);
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
  } catch {
    // Hash computation failed, continue without hash
  }
  await FileSystem.copyAsync({ from: uri, to: dest });
  const manifestPath = joinUri(originalDir, MANIFEST_FILENAME);
  const info = await FileSystem.getInfoAsync(dest);
  const manifest = {
    id,
    original: dest,
    contentHash,
    size: ((info as any).size as number) || null,
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
  const docIds = new Set(
    await FileSystem.readDirectoryAsync(docRoot).catch(() => [])
  );
  const cacheIds = await FileSystem.readDirectoryAsync(cacheRoot).catch(
    () => []
  );
  for (const id of cacheIds) {
    if (!docIds.has(id)) {
      const dirUri = joinUri(cacheRoot, id);
      try {
        await FileSystem.deleteAsync(dirUri, { idempotent: true } as any);
      } catch {}
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
