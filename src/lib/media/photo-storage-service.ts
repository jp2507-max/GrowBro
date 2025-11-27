import { Env } from '@env';
// SDK 54 hybrid approach: Paths for directory URIs, legacy API for async operations
import * as FileSystem from 'expo-file-system/legacy';

import { getCacheDirectoryUri, getDocumentDirectoryUri } from '@/lib/fs/paths';
import type {
  PhotoFile,
  PhotoVariants,
  StorageInfo,
} from '@/types/photo-storage';

import { stripExifAndGeolocation } from './exif';
import {
  deleteFile,
  extractExtension,
  generateHashedFilename,
  hashFileContent,
} from './photo-hash';
import { generatePhotoVariants } from './photo-variants';

// getCacheDirectoryUri() and getDocumentDirectoryUri() moved to '@/lib/fs/paths'

/**
 * Photo storage service for harvest workflow
 *
 * Requirements:
 * - 8.1: Provide photo capture options
 * - 8.2: Store files in filesystem with metadata in database
 * - 13.1: Save files to device filesystem with only URIs in database
 * - 13.2: Generate original, resized, thumbnail variants
 */

const DOWNLOAD_TIMEOUT_MS = 10_000;
const STORAGE_OBJECT_PATH_PREFIX = '/storage/v1/object/';

type DownloadedRemoteImage = {
  localUri: string;
  cleanup: () => Promise<void>;
};

let supabaseStorageHostname: string | undefined;
let allowedRemoteImageHosts: Set<string>;

function ensureInitialized(): void {
  if (allowedRemoteImageHosts === undefined) {
    supabaseStorageHostname = resolveSupabaseHostname();
    allowedRemoteImageHosts = createAllowedRemoteImageHostSet();
  }
}

/**
 * Download a remote image to local storage
 * Used for prefill attachments that come from remote URLs
 */
export async function downloadRemoteImage(
  remoteUri: string
): Promise<DownloadedRemoteImage> {
  ensureInitialized();
  const parsedUrl = assertAllowedRemoteUri(remoteUri);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(parsedUrl.toString(), {
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(
        `Remote image download timed out after ${DOWNLOAD_TIMEOUT_MS}ms`
      );
    }
    throw new Error(
      `Failed to fetch remote image: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  clearTimeout(timeoutId);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch image: ${response.status} ${response.statusText}`
    );
  }

  const rawContentType =
    response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() ??
    null;

  if (rawContentType && !rawContentType.startsWith('image/')) {
    throw new Error(
      `Remote file is not an image (received Content-Type: ${rawContentType})`
    );
  }

  const blob = await response.blob();
  const base64 = await blobToBase64(blob);

  const dirUri = await getPhotoDirectoryUri();
  if (!dirUri) {
    throw new Error(
      'Photo storage unavailable: FileSystem not initialized. Please restart the app or contact support.'
    );
  }

  const extension = determineImageExtension(rawContentType, parsedUrl.pathname);
  const tempFilename = `remote_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2)}.${extension}`;

  const tempFileUri = dirUri + tempFilename;

  try {
    await FileSystem.writeAsStringAsync(tempFileUri, base64, {
      encoding: 'base64',
    });

    return createDownloadedRemoteImage(tempFileUri);
  } catch (error) {
    if (tempFileUri) {
      await cleanupTempFile(tempFileUri, 'partial remote image file');
    }
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(
      `Failed to persist downloaded remote image: ${String(error)}`
    );
  }
}

/**
 * Convert blob to base64 string
 */
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      } else {
        reject(new Error('Failed to convert blob to base64'));
      }
    };
    reader.onerror = () => reject(new Error('FileReader error'));
    reader.readAsDataURL(blob);
  });
}

function createDownloadedRemoteImage(uri: string): DownloadedRemoteImage {
  let cleaned = false;

  return {
    localUri: uri,
    cleanup: async () => {
      if (cleaned) {
        return;
      }
      cleaned = true;
      await cleanupTempFile(uri, 'downloaded remote image');
    },
  };
}

function determineImageExtension(
  contentType: string | null,
  pathname: string
): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/heic': 'heic',
    'image/heif': 'heif',
    'image/avif': 'avif',
  };

  if (contentType) {
    if (map[contentType]) {
      return map[contentType];
    }

    if (contentType.startsWith('image/')) {
      const candidate = sanitizeExtension(contentType.slice(6));
      if (candidate) {
        return candidate;
      }
    }
  }

  const fallback = sanitizeExtension(extractExtension(pathname));
  return fallback ?? 'jpg';
}

function sanitizeExtension(ext: string | null | undefined): string | null {
  if (!ext) {
    return null;
  }

  const normalized = ext.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  if (normalized.length === 0 || normalized.length > 5) {
    return null;
  }

  return normalized;
}

function assertAllowedRemoteUri(remoteUri: string): URL {
  ensureInitialized();
  if (!remoteUri) {
    throw new Error('Remote image URL is required');
  }

  let parsed: URL;
  try {
    parsed = new URL(remoteUri);
  } catch {
    throw new Error('Remote image URL must be an absolute HTTPS URL');
  }

  if (parsed.protocol !== 'https:') {
    throw new Error('Remote image URL must use HTTPS');
  }

  if (parsed.username || parsed.password) {
    throw new Error('Remote image URL must not include credentials');
  }

  const host = parsed.hostname.toLowerCase();

  if (isLocalHost(host) || isIpAddress(host)) {
    throw new Error(`Remote image host "${host}" is not permitted`);
  }

  if (!allowedRemoteImageHosts.has(host)) {
    throw new Error(`Remote image host "${host}" is not allowlisted`);
  }

  if (
    supabaseStorageHostname &&
    host === supabaseStorageHostname &&
    !parsed.pathname.startsWith(STORAGE_OBJECT_PATH_PREFIX)
  ) {
    throw new Error('Remote image path is not allowlisted');
  }

  return parsed;
}

function isLocalHost(host: string): boolean {
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local')
  );
}

function isIpAddress(host: string): boolean {
  if (host.includes(':')) {
    // Treat IPv6 hosts as disallowed (covers private ranges like fd00::/8)
    return true;
  }

  const parts = host.split('.');
  if (parts.length !== 4) {
    return false;
  }

  const octets = parts.map((part) => {
    if (!/^\d{1,3}$/.test(part)) {
      return NaN;
    }
    return Number(part);
  });

  if (octets.some((value) => Number.isNaN(value) || value < 0 || value > 255)) {
    return true;
  }

  const [a, b] = octets;

  if (a === 10 || a === 127) {
    return true;
  }

  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }

  if (a === 192 && b === 168) {
    return true;
  }

  if (a === 169 && b === 254) {
    return true;
  }

  if (a === 100 && b >= 64 && b <= 127) {
    return true;
  }

  if (a === 0 || a === 255) {
    return true;
  }

  return false;
}

function createAllowedRemoteImageHostSet(): Set<string> {
  const hosts = new Set<string>();

  if (supabaseStorageHostname) {
    hosts.add(supabaseStorageHostname);
  }

  const extraHosts = getExtraAllowedHostsFromEnv();
  for (const host of extraHosts) {
    hosts.add(host);
  }

  return hosts;
}

function resolveSupabaseHostname(): string | undefined {
  const supabaseUrl = resolveSupabaseUrl();

  if (!supabaseUrl) {
    return undefined;
  }

  try {
    const parsed = new URL(supabaseUrl);
    if (parsed.protocol === 'https:' && parsed.hostname) {
      return parsed.hostname.toLowerCase();
    }
  } catch {
    // Ignore malformed env configuration
  }

  return undefined;
}

function resolveSupabaseUrl(): string | undefined {
  return Env.SUPABASE_URL;
}

function getExtraAllowedHostsFromEnv(): string[] {
  const raw = getEnvValue('EXPO_PUBLIC_ALLOWED_REMOTE_IMAGE_HOSTS');
  if (!raw) {
    return [];
  }

  return raw
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
}

function getEnvValue(key: string): string | undefined {
  const envRecord = Env as unknown as Record<string, string | undefined>;
  return envRecord?.[key];
}

// Photo storage directory in cache
const PHOTO_DIR_NAME = 'harvest-photos';

let photoDirectoryUri: string | null = null;
let fileSystemInitPromise: Promise<string | null> | null = null;

/**
 * Check if FileSystem is available and functional.
 * With SDK 54+ Paths API, directories are always available when the native module is linked.
 */
function isFileSystemAvailable(): boolean {
  // Call each path resolver separately and catch errors per-call so that a
  // thrown error from one does not prevent attempting the other.
  try {
    const cache = (() => {
      try {
        return getCacheDirectoryUri();
      } catch {
        return null;
      }
    })();

    if (cache) return true;
  } catch {
    // Fall through to document directory check
  }

  try {
    const doc = (() => {
      try {
        return getDocumentDirectoryUri();
      } catch {
        return null;
      }
    })();

    if (doc) return true;
  } catch {
    // If both calls threw, we'll reach the final return false below
  }

  return false;
}

/**
 * Wait for FileSystem to be ready before attempting any operations.
 * With SDK 54+ Paths API, directories are immediately available.
 *
 * Uses a shared promise to prevent multiple concurrent initialization attempts.
 *
 * @param _maxRetries - Unused, kept for API compatibility
 * @param _initialDelayMs - Unused, kept for API compatibility
 * @returns The base directory path once FileSystem is ready, or null if unavailable
 */
async function waitForFileSystem(
  _maxRetries = 5,
  _initialDelayMs = 1000
): Promise<string | null> {
  // If already successfully initialized, return immediately
  if (fileSystemInitPromise) {
    const result = await fileSystemInitPromise;
    if (result) return result;
    // Previous attempt failed, reset and try again
    fileSystemInitPromise = null;
  }

  // Create a shared promise for concurrent callers
  const initPromise = (async () => {
    // With SDK 54+ Paths API, directories are immediately available
    if (isFileSystemAvailable()) {
      try {
        // Prefer cache directory for photos (can be cleared by system if needed)
        const baseDir = getCacheDirectoryUri();
        if (baseDir) {
          return baseDir;
        }
      } catch {
        // Fall through to document directory
      }

      try {
        const baseDir = getDocumentDirectoryUri();
        if (baseDir) {
          return baseDir;
        }
      } catch {
        // FileSystem not available
      }
    }

    // FileSystem is completely unavailable
    console.error(
      '[FileSystem] UNAVAILABLE. Photo features will be disabled.',
      {
        hint: 'For dev builds: ensure expo-file-system is properly linked. Try: npx expo prebuild --clean',
      }
    );

    return null;
  })();

  fileSystemInitPromise = initPromise;
  return initPromise;
}

/**
 * Get or create photo storage directory URI
 * Returns null if FileSystem is unavailable (native module not linked)
 */
async function getPhotoDirectoryUri(): Promise<string | null> {
  if (!photoDirectoryUri) {
    const baseDir = await waitForFileSystem();

    // FileSystem unavailable - return null to disable photo features
    if (!baseDir) {
      return null;
    }

    photoDirectoryUri = `${baseDir}${PHOTO_DIR_NAME}/`;

    try {
      const dirInfo = await FileSystem.getInfoAsync(photoDirectoryUri);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(photoDirectoryUri, {
          intermediates: true,
        });
      }
    } catch (error) {
      console.error('Failed to create photo directory:', error);
      throw error;
    }
  }
  return photoDirectoryUri;
}

/**
 * Clean up temporary file with error handling
 */
async function cleanupTempFile(uri: string, label: string): Promise<void> {
  try {
    await deleteFile(uri);
  } catch (error) {
    console.warn(`Failed to clean up ${label}:`, error);
  }
}

/**
 * Capture and store photo with variants
 *
 * @param sourceUri - Source photo URI from camera/gallery
 * @returns PhotoVariants with URIs to all stored variants
 */
export async function captureAndStore(
  sourceUri: string
): Promise<PhotoVariants> {
  try {
    const dirUri = await getPhotoDirectoryUri();
    if (!dirUri) {
      throw new Error(
        'Photo storage unavailable: FileSystem not initialized. Please restart the app or contact support.'
      );
    }

    // Strip EXIF from original to create sanitized version
    const { uri: sanitizedOriginal, didStrip } =
      await stripExifAndGeolocation(sourceUri);

    // Generate variants from sanitized original (resized + thumbnail)
    const variants = await generatePhotoVariants(sanitizedOriginal);

    // Hash and store sanitized original
    const originalUri = await hashAndStore(
      sanitizedOriginal,
      'original',
      dirUri
    );

    // Hash and store resized variant
    const resizedUri = await hashAndStore(variants.resized, 'resized', dirUri);

    // Clean up temporary resized file after successful hashAndStore (only if different from sanitized original)
    if (variants.resized !== sanitizedOriginal) {
      await cleanupTempFile(variants.resized, 'temporary resized file');
    }

    // Hash and store thumbnail
    const thumbnailUri = await hashAndStore(
      variants.thumbnail,
      'thumbnail',
      dirUri
    );

    // Clean up temporary thumbnail file after successful hashAndStore
    await cleanupTempFile(variants.thumbnail, 'temporary thumbnail file');

    // Clean up intermediate sanitized file if it was created and is different from sourceUri
    // (do this last since variants might reference it)
    if (didStrip && sanitizedOriginal !== sourceUri) {
      await cleanupTempFile(sanitizedOriginal, 'intermediate sanitized file');
    }

    return {
      original: originalUri,
      resized: resizedUri,
      thumbnail: thumbnailUri,
      metadata: variants.metadata,
    };
  } catch (error) {
    console.error('Failed to capture and store photo:', error);
    throw error;
  }
}

/**
 * Hash file content and store with content-addressable name
 *
 * @param uri - Source file URI
 * @param variant - Variant type for logging
 * @param directoryUri - Target directory URI
 * @returns Stored file URI
 */
export async function hashAndStore(
  uri: string,
  variant: string,
  directoryUri: string
): Promise<string> {
  try {
    // Generate content hash
    const hash = await hashFileContent(uri);
    const extension = extractExtension(uri);
    const filename = generateHashedFilename(hash, extension);

    const targetFileUri = directoryUri + filename;

    // Check if file already exists (deduplication)
    const targetFileInfo = await FileSystem.getInfoAsync(targetFileUri);
    if (targetFileInfo.exists) {
      console.log(`Photo variant ${variant} already exists:`, filename);
      return targetFileUri;
    }

    // Copy source to target with hashed name
    await FileSystem.copyAsync({ from: uri, to: targetFileUri });

    return targetFileUri;
  } catch (error) {
    console.error(`Failed to hash and store ${variant}:`, error);
    throw error;
  }
}

/**
 * Get storage information
 *
 * @returns StorageInfo with usage details
 */
export async function getStorageInfo(): Promise<StorageInfo> {
  try {
    const dirUri = await getPhotoDirectoryUri();
    if (!dirUri) {
      throw new Error('Photo storage unavailable: FileSystem not initialized');
    }

    let totalSize = 0;
    let fileCount = 0;

    const dirInfo = await FileSystem.getInfoAsync(dirUri);
    if (dirInfo.exists && dirInfo.isDirectory) {
      const itemNames = await FileSystem.readDirectoryAsync(dirUri);
      for (const itemName of itemNames) {
        const itemUri = dirUri + itemName;
        const itemInfo = await FileSystem.getInfoAsync(itemUri);
        if (itemInfo.exists && !itemInfo.isDirectory) {
          totalSize += itemInfo.size || 0;
          fileCount++;
        }
      }
    }

    const [totalBytes, availableBytes] = await Promise.all([
      FileSystem.getTotalDiskCapacityAsync(),
      FileSystem.getFreeDiskStorageAsync(),
    ]);

    return {
      totalBytes,
      usedBytes: totalSize,
      availableBytes,
      photoDirectory: dirUri,
      fileCount,
    };
  } catch (error) {
    console.error('Failed to get storage info:', error);
    throw error;
  }
}

/**
 * Detect orphaned photo files (files without DB records)
 *
 * @param referencedUris - Array of URIs that are referenced in the database
 * @returns Array of orphaned file paths
 */
export async function detectOrphans(
  referencedUris: string[]
): Promise<string[]> {
  try {
    const dirUri = await getPhotoDirectoryUri();
    if (!dirUri) {
      console.warn(
        '[PhotoStorage] FileSystem unavailable, skipping orphan detection'
      );
      return [];
    }
    const orphans: string[] = [];

    const dirInfo = await FileSystem.getInfoAsync(dirUri);
    if (!dirInfo.exists || !dirInfo.isDirectory) {
      return orphans;
    }

    const referencedSet = new Set(referencedUris);
    const itemNames = await FileSystem.readDirectoryAsync(dirUri);

    for (const itemName of itemNames) {
      const itemUri = dirUri + itemName;
      const itemInfo = await FileSystem.getInfoAsync(itemUri);
      if (
        itemInfo.exists &&
        !itemInfo.isDirectory &&
        !referencedSet.has(itemUri)
      ) {
        orphans.push(itemUri);
      }
    }

    return orphans;
  } catch (error) {
    console.error('Failed to detect orphans:', error);
    return [];
  }
}

/**
 * Clean up orphaned files
 *
 * @param orphanPaths - Array of file paths to delete
 * @returns Object with count of deleted files and array of successfully deleted paths
 */
export async function cleanupOrphans(orphanPaths: string[]): Promise<{
  deletedCount: number;
  deletedPaths: string[];
}> {
  let deletedCount = 0;
  const deletedPaths: string[] = [];

  for (const path of orphanPaths) {
    try {
      const success = await deleteFile(path);
      if (success) {
        deletedCount++;
        deletedPaths.push(path);
      }
    } catch (error) {
      console.warn(`Failed to delete orphan ${path}:`, error);
    }
  }

  return { deletedCount, deletedPaths };
}

/**
 * Get all photo files with metadata
 *
 * @returns Array of PhotoFile objects
 */
export async function getPhotoFiles(): Promise<PhotoFile[]> {
  try {
    const dirUri = await getPhotoDirectoryUri();
    if (!dirUri) {
      console.warn(
        '[PhotoStorage] FileSystem unavailable, returning empty file list'
      );
      return [];
    }
    const files: PhotoFile[] = [];

    const dirInfo = await FileSystem.getInfoAsync(dirUri);
    if (!dirInfo.exists || !dirInfo.isDirectory) {
      return files;
    }

    const itemNames = await FileSystem.readDirectoryAsync(dirUri);

    for (const itemName of itemNames) {
      const itemUri = dirUri + itemName;
      const itemInfo = await FileSystem.getInfoAsync(itemUri);
      if (itemInfo.exists && !itemInfo.isDirectory) {
        const hash = itemName.split('.')[0] ?? '';
        files.push({
          path: itemUri,
          size: itemInfo.size || 0,
          modifiedAt: itemInfo.modificationTime
            ? itemInfo.modificationTime * 1000
            : Date.now(),
          hash,
        });
      }
    }

    return files;
  } catch (error) {
    console.error('Failed to get photo files:', error);
    return [];
  }
}
