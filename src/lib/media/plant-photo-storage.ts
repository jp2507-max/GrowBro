/**
 * Plant photo storage service
 *
 * Handles persistent local storage for plant profile photos in a dedicated
 * directory (document/plant-photos/) that is separate from harvest photos.
 * This prevents the photo janitor from cleaning up plant images as orphans.
 *
 * Features:
 * - Stores plant photos in persistent document directory (survives app restarts)
 * - Content-addressed filenames for deduplication
 * - Downloads and caches photos from Supabase Storage for cross-device sync
 * - Enqueues uploads for background processing
 */

import * as FileSystem from 'expo-file-system/legacy';

import { getDocumentDirectoryUri } from '@/lib/fs/paths';

import { stripExifAndGeolocation } from './exif';
import {
  extractExtension,
  generateHashedFilename,
  hashFileContent,
} from './photo-hash';

/** Directory name for plant photos within document directory */
const PLANT_PHOTO_DIR_NAME = 'plant-photos';

let plantPhotoDirectoryUri: string | null = null;
let initPromise: Promise<string | null> | null = null;

/**
 * Get or create plant photo storage directory URI.
 * Uses document directory (persistent, survives cache clearing).
 * Uses an initialization promise to prevent race conditions.
 *
 * @returns Directory URI or null if FileSystem unavailable
 */
export async function getPlantPhotoDirectoryUri(): Promise<string | null> {
  if (plantPhotoDirectoryUri) return plantPhotoDirectoryUri;

  if (!initPromise) {
    initPromise = (async () => {
      try {
        const baseDir = getDocumentDirectoryUri();
        if (!baseDir) {
          console.error('[PlantPhotoStorage] Document directory unavailable');
          return null;
        }

        const dirUri = `${baseDir}${PLANT_PHOTO_DIR_NAME}/`;

        const dirInfo = await FileSystem.getInfoAsync(dirUri);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(dirUri, {
            intermediates: true,
          });
        }
        plantPhotoDirectoryUri = dirUri;
        return dirUri;
      } catch (error) {
        console.error(
          '[PlantPhotoStorage] Failed to initialize directory:',
          error
        );
        return null;
      }
    })();
  }
  return initPromise;
}

/**
 * Result of storing a plant photo locally
 */
export type PlantPhotoStoreResult = {
  /** Local file:// URI for display */
  localUri: string;
  /** Content hash (used for deduplication and as remote filename) */
  hash: string;
  /** File extension (e.g., 'jpg', 'png') */
  extension: string;
};

/**
 * Store a plant photo locally with content-addressed naming.
 * Strips EXIF/GPS data for privacy before storing.
 *
 * @param sourceUri - Source URI from camera/gallery picker
 * @returns Store result with local URI and hash
 */
export async function storePlantPhotoLocally(
  sourceUri: string
): Promise<PlantPhotoStoreResult> {
  const dirUri = await getPlantPhotoDirectoryUri();
  if (!dirUri) {
    throw new Error(
      'Plant photo storage unavailable: FileSystem not initialized'
    );
  }

  // Strip EXIF/GPS metadata for privacy
  const { uri: sanitizedUri, didStrip } =
    await stripExifAndGeolocation(sourceUri);

  // Generate content hash for deduplication
  const hash = await hashFileContent(sanitizedUri);

  // Determine extension (EXIF stripping may convert to JPEG)
  const extension = didStrip ? 'jpg' : (extractExtension(sourceUri) ?? 'jpg');
  const filename = generateHashedFilename(hash, extension);
  const targetUri = `${dirUri}${filename}`;

  // Check if file already exists (deduplication)
  const existingInfo = await FileSystem.getInfoAsync(targetUri);
  if (existingInfo.exists) {
    console.log('[PlantPhotoStorage] Photo already exists:', filename);
    // Clean up temp sanitized file if different from source
    if (didStrip && sanitizedUri !== sourceUri) {
      try {
        await FileSystem.deleteAsync(sanitizedUri, { idempotent: true });
      } catch {
        // Ignore cleanup errors
      }
    }
    return { localUri: targetUri, hash, extension };
  }

  // Copy to plant photos directory
  await FileSystem.copyAsync({ from: sanitizedUri, to: targetUri });

  // Clean up temp sanitized file if different from source
  if (didStrip && sanitizedUri !== sourceUri) {
    try {
      await FileSystem.deleteAsync(sanitizedUri, { idempotent: true });
    } catch {
      // Ignore cleanup errors
    }
  }

  console.log('[PlantPhotoStorage] Stored plant photo:', filename);
  return { localUri: targetUri, hash, extension };
}

/**
 * Download a plant photo from Supabase Storage and cache it locally.
 *
 * @param signedUrl - Signed URL from Supabase Storage
 * @param plantId - Plant ID for filename context
 * @returns Local file URI
 */
export async function downloadAndCachePlantPhoto(
  signedUrl: string,
  plantId: string
): Promise<string> {
  const dirUri = await getPlantPhotoDirectoryUri();
  if (!dirUri) {
    throw new Error(
      'Plant photo storage unavailable: FileSystem not initialized'
    );
  }

  // Download to a temporary file first
  const tempFilename = `temp_${plantId}_${Date.now()}.jpg`;
  const tempUri = `${dirUri}${tempFilename}`;

  const downloadResult = await FileSystem.downloadAsync(signedUrl, tempUri);

  if (downloadResult.status !== 200) {
    // Clean up failed download
    try {
      await FileSystem.deleteAsync(tempUri, { idempotent: true });
    } catch {
      // Ignore
    }
    throw new Error(
      `Failed to download plant photo: HTTP ${downloadResult.status}`
    );
  }

  // Hash the downloaded content for content-addressed storage
  const hash = await hashFileContent(tempUri);
  const extension = 'jpg'; // Remote photos are normalized to JPEG
  const filename = generateHashedFilename(hash, extension);
  const targetUri = `${dirUri}${filename}`;

  // Check if this content already exists
  const existingInfo = await FileSystem.getInfoAsync(targetUri);
  if (existingInfo.exists) {
    // Clean up temp file, use existing
    await FileSystem.deleteAsync(tempUri, { idempotent: true });
    return targetUri;
  }

  // Rename temp to final filename
  await FileSystem.moveAsync({ from: tempUri, to: targetUri });

  console.log(
    '[PlantPhotoStorage] Downloaded and cached plant photo:',
    filename
  );
  return targetUri;
}

/**
 * Check if a local plant photo file exists.
 *
 * @param localUri - Local file URI
 * @returns True if file exists
 */
export async function plantPhotoExists(localUri: string): Promise<boolean> {
  if (!localUri || !localUri.startsWith('file://')) {
    return false;
  }

  try {
    const info = await FileSystem.getInfoAsync(localUri);
    return info.exists && !info.isDirectory;
  } catch {
    return false;
  }
}

/**
 * Get all local plant photo URIs for janitor protection.
 *
 * @returns Array of file URIs in the plant photos directory
 */
export async function getAllPlantPhotoUris(): Promise<string[]> {
  const dirUri = await getPlantPhotoDirectoryUri();
  if (!dirUri) {
    return [];
  }

  try {
    const dirInfo = await FileSystem.getInfoAsync(dirUri);
    if (!dirInfo.exists || !dirInfo.isDirectory) {
      return [];
    }

    const files = await FileSystem.readDirectoryAsync(dirUri);
    return files.map((filename) => `${dirUri}${filename}`);
  } catch (error) {
    console.error('[PlantPhotoStorage] Failed to list photos:', error);
    return [];
  }
}
