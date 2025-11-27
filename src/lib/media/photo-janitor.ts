// NOTE: This file imports the legacy expo-file-system entrypoint
// (expo-file-system/legacy) because we rely on the older deleteAsync
// behaviour. Tests provide a manual mock at __mocks__/expo-file-system/legacy.ts.
import * as Battery from 'expo-battery';
// Use legacy API for FileSystem.deleteAsync support
import * as FileSystem from 'expo-file-system/legacy';

import type {
  CleanupResult,
  PhotoFile,
  PhotoStorageConfig,
} from '@/types/photo-storage';
import { DEFAULT_PHOTO_STORAGE_CONFIG } from '@/types/photo-storage';

import {
  cleanupOrphans,
  detectOrphans,
  getPhotoFiles,
} from './photo-storage-service';

/**
 * LRU (Least Recently Used) janitor for photo storage cleanup
 *
 * Requirements:
 * - 13.3: Run background LRU janitor on app start
 * - 13.4: Offer "Free up space" action
 * - 8.4: Implement LRU cleanup while preserving recent harvest photos
 * - Respects battery saver and charging state
 */

async function shouldSkipCleanup(
  aggressive: boolean,
  respectBatterySaver: boolean
): Promise<boolean> {
  if (aggressive || !respectBatterySaver) {
    return false;
  }

  const batteryState = await Battery.getPowerStateAsync();
  const isLowBattery = (batteryState.batteryLevel ?? 1) < 0.2;
  const isCharging =
    batteryState.batteryState === Battery.BatteryState.CHARGING;

  if (isLowBattery && !isCharging) {
    console.log('Skipping cleanup: low battery and not charging');
    return true;
  }

  return false;
}

async function cleanupOrphanedFiles(
  referencedUris: string[]
): Promise<{ orphansRemoved: number; remainingFiles: PhotoFile[] }> {
  const allFiles = await getPhotoFiles();
  const orphans = await detectOrphans(referencedUris);
  const { deletedCount: orphansRemoved, deletedPaths } =
    await cleanupOrphans(orphans);
  const remainingFiles = allFiles.filter((f) => !deletedPaths.includes(f.path));

  return { orphansRemoved, remainingFiles };
}

function calculateProtectionCutoff(
  aggressive: boolean,
  protectionDays: number
): number {
  if (aggressive) {
    return Date.now();
  }
  return Date.now() - protectionDays * 24 * 60 * 60 * 1000;
}

async function deleteLRUFiles({
  files,
  currentSize,
  maxStorageBytes,
  protectionCutoff,
}: {
  files: PhotoFile[];
  currentSize: number;
  maxStorageBytes: number;
  protectionCutoff: number;
}): Promise<{ filesDeleted: number; bytesFreed: number }> {
  const sortedFiles = [...files].sort((a, b) => a.modifiedAt - b.modifiedAt);

  let bytesFreed = 0;
  let filesDeleted = 0;
  let size = currentSize;

  for (const file of sortedFiles) {
    if (size <= maxStorageBytes) {
      break;
    }

    if (file.modifiedAt > protectionCutoff) {
      continue;
    }

    try {
      await FileSystem.deleteAsync(file.path, { idempotent: true });
      bytesFreed += file.size;
      size -= file.size;
      filesDeleted++;
    } catch (error) {
      console.warn(`Failed to delete file ${file.path}:`, error);
    }
  }

  return { filesDeleted, bytesFreed };
}

/**
 * Run LRU cleanup janitor
 *
 * @param config - Storage configuration
 * @param referencedUris - Array of photo URIs referenced in database
 * @param aggressive - If true, ignore protection period and battery state
 * @returns CleanupResult with stats
 */
export async function cleanupLRU(
  config: PhotoStorageConfig = DEFAULT_PHOTO_STORAGE_CONFIG,
  referencedUris: string[],
  aggressive = false
): Promise<CleanupResult> {
  const startTime = Date.now();

  try {
    if (await shouldSkipCleanup(aggressive, config.respectBatterySaver)) {
      return {
        filesDeleted: 0,
        bytesFreed: 0,
        durationMs: Date.now() - startTime,
        orphansRemoved: 0,
      };
    }

    const { orphansRemoved, remainingFiles } =
      await cleanupOrphanedFiles(referencedUris);

    const totalSize = remainingFiles.reduce((sum, f) => sum + f.size, 0);

    if (totalSize < config.cleanupThresholdBytes) {
      return {
        filesDeleted: 0,
        bytesFreed: 0,
        durationMs: Date.now() - startTime,
        orphansRemoved,
      };
    }

    const protectionCutoff = calculateProtectionCutoff(
      aggressive,
      config.recentPhotoProtectionDays
    );

    const { filesDeleted, bytesFreed } = await deleteLRUFiles({
      files: remainingFiles,
      currentSize: totalSize,
      maxStorageBytes: config.maxStorageBytes,
      protectionCutoff,
    });

    return {
      filesDeleted,
      bytesFreed,
      durationMs: Date.now() - startTime,
      orphansRemoved,
    };
  } catch (error) {
    console.error('LRU cleanup failed:', error);
    return {
      filesDeleted: 0,
      bytesFreed: 0,
      durationMs: Date.now() - startTime,
      orphansRemoved: 0,
    };
  }
}

/**
 * Initialize janitor on app start (runs in background)
 *
 * @param config - Storage configuration
 * @param referencedUris - Array of photo URIs referenced in database
 */
export async function initializeJanitor(
  config: PhotoStorageConfig = DEFAULT_PHOTO_STORAGE_CONFIG,
  referencedUris: string[]
): Promise<void> {
  setTimeout(async () => {
    try {
      const result = await cleanupLRU(config, referencedUris, false);
      console.log('Janitor cleanup completed:', result);
    } catch (error) {
      console.error('Janitor initialization failed:', error);
    }
  }, 5000);
}
