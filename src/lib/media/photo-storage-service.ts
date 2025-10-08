import { Directory, File, Paths } from 'expo-file-system';

import type {
  PhotoFile,
  PhotoVariants,
  StorageInfo,
} from '@/types/photo-storage';

import {
  deleteFile,
  extractExtension,
  generateHashedFilename,
  hashFileContent,
} from './photo-hash';
import { generatePhotoVariants } from './photo-variants';

/**
 * Photo storage service for harvest workflow
 *
 * Requirements:
 * - 8.1: Provide photo capture options
 * - 8.2: Store files in filesystem with metadata in database
 * - 13.1: Save files to device filesystem with only URIs in database
 * - 13.2: Generate original, resized, thumbnail variants
 */

// Photo storage directory in cache
const PHOTO_DIR_NAME = 'harvest-photos';

let photoDirectory: Directory | null = null;

/**
 * Get or create photo storage directory
 */
function getPhotoDirectory(): Directory {
  if (!photoDirectory) {
    photoDirectory = new Directory(Paths.cache, PHOTO_DIR_NAME);
    try {
      if (!photoDirectory.exists) {
        photoDirectory.create();
      }
    } catch (error) {
      console.error('Failed to create photo directory:', error);
      throw error;
    }
  }
  return photoDirectory;
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
    const dir = getPhotoDirectory();

    // Generate variants (resized + thumbnail)
    const variants = await generatePhotoVariants(sourceUri);

    // Hash and store original (already EXIF-stripped)
    const originalUri = await hashAndStore(sourceUri, 'original', dir);

    // Hash and store resized variant
    const resizedUri = await hashAndStore(variants.resized, 'resized', dir);

    // Hash and store thumbnail
    const thumbnailUri = await hashAndStore(
      variants.thumbnail,
      'thumbnail',
      dir
    );

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
 * @param directory - Target directory
 * @returns Stored file URI
 */
export async function hashAndStore(
  uri: string,
  variant: string,
  directory: Directory
): Promise<string> {
  try {
    // Generate content hash
    const hash = await hashFileContent(uri);
    const extension = extractExtension(uri);
    const filename = generateHashedFilename(hash, extension);

    const targetFile = new File(directory, filename);

    // Check if file already exists (deduplication)
    if (targetFile.exists) {
      console.log(`Photo variant ${variant} already exists:`, filename);
      return targetFile.uri;
    }

    // Copy source to target with hashed name
    const sourceFile = new File(uri);
    sourceFile.copy(targetFile);

    return targetFile.uri;
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
    const dir = getPhotoDirectory();

    let totalSize = 0;
    let fileCount = 0;

    if (dir.exists) {
      const items = dir.list();
      for (const item of items) {
        if (item instanceof File) {
          totalSize += item.size;
          fileCount++;
        }
      }
    }

    return {
      totalBytes: Paths.totalDiskSpace,
      usedBytes: totalSize,
      availableBytes: Paths.availableDiskSpace,
      photoDirectory: dir.uri,
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
    const dir = getPhotoDirectory();
    const orphans: string[] = [];

    if (!dir.exists) {
      return orphans;
    }

    const referencedSet = new Set(referencedUris);
    const items = dir.list();

    for (const item of items) {
      if (item instanceof File && !referencedSet.has(item.uri)) {
        orphans.push(item.uri);
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
 * @returns Number of files deleted
 */
export async function cleanupOrphans(orphanPaths: string[]): Promise<number> {
  let deleted = 0;

  for (const path of orphanPaths) {
    try {
      const success = await deleteFile(path);
      if (success) {
        deleted++;
      }
    } catch (error) {
      console.warn(`Failed to delete orphan ${path}:`, error);
    }
  }

  return deleted;
}

/**
 * Get all photo files with metadata
 *
 * @returns Array of PhotoFile objects
 */
export async function getAllPhotoFiles(): Promise<PhotoFile[]> {
  try {
    const dir = getPhotoDirectory();
    const files: PhotoFile[] = [];

    if (!dir.exists) {
      return files;
    }

    const items = dir.list();

    for (const item of items) {
      if (item instanceof File) {
        const hash = item.name.split('.')[0] ?? '';
        files.push({
          path: item.uri,
          size: item.size,
          modifiedAt: Date.now(), // File API doesn't expose modification time
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
