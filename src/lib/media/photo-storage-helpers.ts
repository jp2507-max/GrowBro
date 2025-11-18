/**
 * Photo storage helper utilities
 *
 * Helpers for extracting referenced URIs from WatermelonDB and initializing janitor
 */

import { database } from '@/lib/watermelon';
import type { HarvestModel } from '@/lib/watermelon-models/harvest';

/**
 * Extract all photo URIs referenced in harvest records
 *
 * @returns Array of photo URIs from all harvests
 */
export async function getReferencedPhotoUris(): Promise<string[]> {
  try {
    const harvests = await database.collections.get('harvests').query().fetch();

    const photoUris: string[] = [];

    for (const harvest of harvests) {
      const harvestModel = harvest as HarvestModel;
      const photos = harvestModel.photos;
      if (Array.isArray(photos)) {
        for (const photo of photos) {
          if (photo.localUri) {
            photoUris.push(photo.localUri);
          }
        }
      }
    }

    return photoUris;
  } catch (error) {
    console.error(
      '[PhotoStorageHelpers] Failed to get referenced URIs:',
      error
    );
    return [];
  }
}
