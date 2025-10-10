/**
 * Filesystem Utilities
 * Helper functions for file and directory management
 */

import * as FileSystem from 'expo-file-system';

/**
 * Check if file exists at given URI
 *
 * @param uri - File URI to check
 * @returns True if file exists
 */
export async function fileExists(uri: string): Promise<boolean> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists;
  } catch {
    return false;
  }
}

/**
 * Get file size in bytes
 *
 * @param uri - File URI
 * @returns File size in bytes, or 0 if file doesn't exist
 */
export async function getFileSize(uri: string): Promise<number> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists && !info.isDirectory ? info.size : 0;
  } catch {
    return 0;
  }
}

/**
 * Delete file if it exists
 *
 * @param uri - File URI to delete
 */
export async function deleteFile(uri: string): Promise<void> {
  try {
    const exists = await fileExists(uri);
    if (exists) {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    }
  } catch (error) {
    console.warn('[Filesystem] Failed to delete file:', error);
  }
}

/**
 * Create directory if it doesn't exist
 *
 * @param dirUri - Directory URI
 */
export async function ensureDirectory(dirUri: string): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(dirUri);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(dirUri, { intermediates: true });
    }
  } catch (error) {
    console.error('[Filesystem] Failed to create directory:', error);
    throw error;
  }
}

/**
 * Get directory size recursively
 *
 * @param dirUri - Directory URI
 * @returns Total size in bytes
 */
export async function getDirectorySize(dirUri: string): Promise<number> {
  try {
    const info = await FileSystem.getInfoAsync(dirUri);
    if (!info.exists || !info.isDirectory) {
      return 0;
    }

    const items = await FileSystem.readDirectoryAsync(dirUri);
    let totalSize = 0;

    for (const item of items) {
      const itemUri = `${dirUri}/${item}`;
      const itemInfo = await FileSystem.getInfoAsync(itemUri);

      if (itemInfo.exists && itemInfo.isDirectory) {
        totalSize += await getDirectorySize(itemUri);
      } else if (itemInfo.exists && !itemInfo.isDirectory) {
        totalSize += itemInfo.size;
      }
    }

    return totalSize;
  } catch {
    return 0;
  }
}

/**
 * Clean up old files in directory based on age
 *
 * @param dirUri - Directory URI
 * @param maxAgeMs - Maximum age in milliseconds
 */
export async function cleanupOldFiles(
  dirUri: string,
  maxAgeMs: number
): Promise<number> {
  try {
    const info = await FileSystem.getInfoAsync(dirUri);
    if (!info.exists || !info.isDirectory) {
      return 0;
    }

    const items = await FileSystem.readDirectoryAsync(dirUri);
    const now = Date.now();
    let deletedCount = 0;

    for (const item of items) {
      const itemUri = `${dirUri}/${item}`;
      const itemInfo = await FileSystem.getInfoAsync(itemUri);

      if (itemInfo.exists && !itemInfo.isDirectory) {
        const age = now - itemInfo.modificationTime * 1000;
        if (age > maxAgeMs) {
          await deleteFile(itemUri);
          deletedCount++;
        }
      }
    }

    return deletedCount;
  } catch (error) {
    console.warn('[Filesystem] Failed to cleanup old files:', error);
    return 0;
  }
}
