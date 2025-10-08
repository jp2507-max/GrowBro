/**
 * Photo storage helper utilities
 *
 * Helpers for extracting referenced URIs from WatermelonDB and initializing janitor
 */

import { database } from '@/lib/watermelon';

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
      const photos = (harvest as any).photos as string[];
      if (Array.isArray(photos)) {
        photoUris.push(...photos);
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
