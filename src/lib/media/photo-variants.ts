import * as ImageManipulator from 'expo-image-manipulator';

import type { ExifMetadata, PhotoVariants } from '@/types/photo-storage';

import { stripExifAndGeolocation } from './exif';

/**
 * Photo variant generation service
 *
 * Requirements:
 * - 13.2: Generate original, resized (~1280px), and thumbnail variants
 * - Strip GPS and sensitive EXIF by default
 * - Preserve orientation safely
 */

const RESIZED_LONG_EDGE = 1280;
const THUMBNAIL_LONG_EDGE = 200;
const RESIZED_QUALITY = 0.85;
const THUMBNAIL_QUALITY = 0.7;

/**
 * Generate all photo variants (original, resized, thumbnail)
 *
 * @param uri - Source photo URI
 * @returns PhotoVariants with all three sizes and metadata
 */
export async function generatePhotoVariants(
  uri: string
): Promise<Omit<PhotoVariants, 'original'>> {
  // Strip EXIF from original
  const { uri: strippedOriginal, didStrip } =
    await stripExifAndGeolocation(uri);

  // Get image info for metadata
  const metadata = await extractMetadata(strippedOriginal, didStrip);

  // Generate resized variant (~1280px)
  const resized = await generateResizedVariant(
    strippedOriginal,
    metadata.width ?? 0,
    metadata.height ?? 0
  );

  // Generate thumbnail variant (200px)
  const thumbnail = await generateThumbnailVariant(
    strippedOriginal,
    metadata.width ?? 0,
    metadata.height ?? 0
  );

  return {
    resized,
    thumbnail,
    metadata,
  };
}

/**
 * Generate resized variant (~1280px long edge)
 */
async function generateResizedVariant(
  uri: string,
  width: number,
  height: number
): Promise<string> {
  const longEdge = Math.max(width, height);

  // Skip resize if already smaller than target
  if (longEdge <= RESIZED_LONG_EDGE) {
    return uri;
  }

  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [
        {
          resize:
            width > height
              ? { width: RESIZED_LONG_EDGE }
              : { height: RESIZED_LONG_EDGE },
        },
      ],
      {
        compress: RESIZED_QUALITY,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );
    return result.uri;
  } catch (error) {
    console.warn('Failed to generate resized variant:', error);
    return uri; // Fallback to original
  }
}

/**
 * Generate thumbnail variant (200px long edge)
 */
async function generateThumbnailVariant(
  uri: string,
  width: number,
  height: number
): Promise<string> {
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [
        {
          resize:
            width > height
              ? { width: THUMBNAIL_LONG_EDGE }
              : { height: THUMBNAIL_LONG_EDGE },
        },
      ],
      {
        compress: THUMBNAIL_QUALITY,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );
    return result.uri;
  } catch (error) {
    console.warn('Failed to generate thumbnail variant:', error);
    return uri; // Fallback to original
  }
}

/**
 * Extract basic metadata from photo
 */
async function extractMetadata(
  uri: string,
  gpsStripped: boolean
): Promise<ExifMetadata> {
  try {
    // Use ImageManipulator to get dimensions
    const result = await ImageManipulator.manipulateAsync(uri, []);

    return {
      width: result.width,
      height: result.height,
      mimeType: 'image/jpeg',
      gpsStripped,
    };
  } catch (error) {
    console.warn('Failed to extract metadata:', error);
    return {
      gpsStripped,
      mimeType: 'image/jpeg',
    };
  }
}
