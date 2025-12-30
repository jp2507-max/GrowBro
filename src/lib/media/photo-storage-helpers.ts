/**
 * Photo storage helper utilities
 *
 * Helpers for extracting referenced URIs from WatermelonDB and initializing janitor
 */

import { database } from '@/lib/watermelon';
import type { HarvestModel } from '@/lib/watermelon-models/harvest';
import type { PlantModel } from '@/lib/watermelon-models/plant';

/**
 * Extract all photo URIs referenced in harvest records
 *
 * @returns Array of photo URIs from all harvests
 */
async function getHarvestPhotoUris(): Promise<string[]> {
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
      '[PhotoStorageHelpers] Failed to get harvest photo URIs:',
      error
    );
    return [];
  }
}

/**
 * Extract all photo URIs referenced in plant records
 *
 * @returns Array of photo URIs from all plants
 */
async function getPlantPhotoUris(): Promise<string[]> {
  try {
    const plants = await database.collections.get('plants').query().fetch();

    const photoUris: string[] = [];

    for (const plant of plants) {
      const plantModel = plant as PlantModel;
      const imageUrl = plantModel.imageUrl;
      // Only include local file:// URIs
      if (imageUrl && imageUrl.startsWith('file://')) {
        photoUris.push(imageUrl);
      }
    }

    return photoUris;
  } catch (error) {
    console.error(
      '[PhotoStorageHelpers] Failed to get plant photo URIs:',
      error
    );
    return [];
  }
}

/**
 * Extract all photo URIs referenced in database records.
 * Includes both harvest photos and plant profile photos.
 *
 * @returns Array of photo URIs from all harvests and plants
 */
export async function getReferencedPhotoUris(): Promise<string[]> {
  const [harvestUris, plantUris] = await Promise.all([
    getHarvestPhotoUris(),
    getPlantPhotoUris(),
  ]);

  return [...harvestUris, ...plantUris];
}
