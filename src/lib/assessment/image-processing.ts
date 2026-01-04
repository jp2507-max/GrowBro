import { randomUUID } from 'expo-crypto';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';

import type { PhotoMetadata } from '@/types/assessment';

export type ProcessedImage = {
  uri: string;
  width: number;
  height: number;
  metadata: PhotoMetadata;
};

/**
 * Strip EXIF data from image and return processed image
 * Uses expo-image-manipulator to remove all metadata including GPS
 */
export async function stripExifData(imageUri: string): Promise<ProcessedImage> {
  try {
    // Manipulate image to strip EXIF data
    // Even with no operations, expo-image-manipulator strips EXIF by default
    const manipResult = await ImageManipulator.manipulateAsync(
      imageUri,
      [], // No transformations needed, just strip EXIF
      {
        compress: 0.9, // Slight compression to ensure quality
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );

    // Create minimal metadata (no GPS or sensitive data)
    const metadata: PhotoMetadata = {
      width: manipResult.width,
      height: manipResult.height,
      gps: null, // Always null after EXIF stripping
    };

    return {
      uri: manipResult.uri,
      width: manipResult.width,
      height: manipResult.height,
      metadata,
    };
  } catch (error) {
    console.error('Failed to strip EXIF data:', error);
    throw new Error('Failed to process image');
  }
}

/**
 * Generate thumbnail from image
 */
export async function generateThumbnail(
  imageUri: string,
  maxSize: number = 200
): Promise<string> {
  try {
    const manipResult = await ImageManipulator.manipulateAsync(
      imageUri,
      [{ resize: { width: maxSize } }],
      {
        compress: 0.7,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );

    return manipResult.uri;
  } catch (error) {
    console.error('Failed to generate thumbnail:', error);
    throw new Error('Failed to generate thumbnail');
  }
}

/**
 * Get image file size in bytes
 */
export async function getImageSize(uri: string): Promise<number> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists && 'size' in info ? info.size : 0;
  } catch (error) {
    console.error('Failed to get image size:', error);
    return 0;
  }
}

/**
 * Read image as base64 string
 */
export async function readImageAsBase64(uri: string): Promise<string> {
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: 'base64' as const,
    });
    return base64;
  } catch (error) {
    console.error('Failed to read image as base64:', error);
    throw new Error('Failed to read image');
  }
}

/**
 * Generate unique filename for image
 */
export function generateImageFilename(extension: string = 'jpg'): string {
  const id = randomUUID();
  return `${id}.${extension}`;
}
