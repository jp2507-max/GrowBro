/**
 * Harvest photo cleanup service
 *
 * Requirements:
 * - Task 6.1: Delete remote Storage objects when harvest is soft-deleted locally
 */

import { Q } from '@nozbe/watermelondb';

import { supabase } from '@/lib/supabase';
import { database } from '@/lib/watermelon';

export interface CleanupResult {
  /** Number of harvests processed */
  harvestsProcessed: number;
  /** Number of photos deleted */
  photosDeleted: number;
  /** Number of errors encountered */
  errors: number;
}

/**
 * Extract remote photo paths from harvest photos JSON field
 *
 * @param photos - Photos JSON array from harvest
 * @returns Array of remote paths
 */
function extractRemotePaths(photos: unknown): string[] {
  if (!Array.isArray(photos)) return [];

  return photos
    .filter(
      (photo): photo is { remotePath: string } =>
        typeof photo === 'object' &&
        photo !== null &&
        'remotePath' in photo &&
        typeof photo.remotePath === 'string'
    )
    .map((photo) => photo.remotePath);
}

/**
 * Delete remote Storage objects for a harvest
 *
 * @param harvestId - Harvest ID
 * @param remotePaths - Array of remote storage paths
 * @returns Number of photos deleted
 */
async function deleteRemotePhotos(
  harvestId: string,
  remotePaths: string[]
): Promise<number> {
  if (remotePaths.length === 0) return 0;

  try {
    // Strip bucket prefix from paths since .from('harvest-photos') already specifies the bucket
    const relativePaths = remotePaths.map((path) =>
      path.startsWith('harvest-photos/')
        ? path.slice('harvest-photos/'.length)
        : path
    );

    const { data, error } = await supabase.storage
      .from('harvest-photos')
      .remove(relativePaths);

    if (error) {
      console.error(`Failed to delete photos for harvest ${harvestId}:`, error);
      return 0;
    }

    return data?.length ?? 0;
  } catch (error) {
    console.error(
      `Exception while deleting photos for harvest ${harvestId}:`,
      error
    );
    return 0;
  }
}

/**
 * Clean up remote photos for soft-deleted harvests
 *
 * This function finds all harvests with deleted_at set and deletes
 * their remote Storage objects.
 *
 * @returns Cleanup result summary
 */
export async function cleanupDeletedHarvestPhotos(): Promise<CleanupResult> {
  const result: CleanupResult = {
    harvestsProcessed: 0,
    photosDeleted: 0,
    errors: 0,
  };

  try {
    const coll = database.collections.get('harvests' as any);

    // Find all soft-deleted harvests with photos
    const deletedHarvests = await (coll as any)
      .query(Q.where('deleted_at', Q.notEq(null)))
      .fetch();

    for (const harvest of deletedHarvests) {
      try {
        const photos = harvest._raw.photos;
        const remotePaths = extractRemotePaths(photos);

        if (remotePaths.length > 0) {
          const deleted = await deleteRemotePhotos(harvest.id, remotePaths);
          result.photosDeleted += deleted;
        }

        result.harvestsProcessed++;
      } catch (error) {
        console.error(`Error processing harvest ${harvest.id}:`, error);
        result.errors++;
      }
    }

    return result;
  } catch (error) {
    console.error('Failed to cleanup deleted harvest photos:', error);
    return result;
  }
}

/**
 * Clean up remote photos for a specific harvest
 *
 * @param harvestId - Harvest ID
 * @returns Number of photos deleted
 */
export async function cleanupHarvestPhotos(harvestId: string): Promise<number> {
  try {
    const coll = database.collections.get('harvests' as any);
    const harvest = await (coll as any).find(harvestId);

    const photos = harvest._raw.photos;
    const remotePaths = extractRemotePaths(photos);

    if (remotePaths.length === 0) return 0;

    return await deleteRemotePhotos(harvestId, remotePaths);
  } catch (error) {
    console.error(`Failed to cleanup photos for harvest ${harvestId}:`, error);
    return 0;
  }
}
