import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';

import {
  getAssessmentDir,
  sanitizePathSegment,
} from '@/lib/assessment/assessment-paths';
import { imageCacheManager } from '@/lib/assessment/image-cache-manager';
import {
  computeFilenameKey,
  computeIntegritySha256,
} from '@/lib/assessment/image-hashing';

export async function storeImage(
  imageUri: string,
  assessmentId: string,
  createdAt: number = Date.now()
): Promise<{
  filenameKey: string;
  integritySha256: string;
  storedUri: string;
}> {
  try {
    const assessmentsRoot = getAssessmentDir();
    const assessmentDir = `${assessmentsRoot}${sanitizePathSegment(assessmentId)}/`;
    await FileSystem.makeDirectoryAsync(assessmentDir, { intermediates: true });

    // Compute filename key from original image
    const filenameKey = await computeFilenameKey(imageUri);

    // Re-encode image to JPEG and strip EXIF data using ImageManipulator
    const storedUri = `${assessmentDir}${filenameKey}.jpg`;
    const manipResult = await ImageManipulator.manipulateAsync(
      imageUri,
      [], // No transformations needed, just strip EXIF
      {
        compress: 0.9, // Slight compression to ensure quality
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );

    // Move the manipulated image to the final destination
    await FileSystem.moveAsync({
      from: manipResult.uri,
      to: storedUri,
    });

    // Compute integrity hash from the actual stored file contents (after manipulation)
    const integritySha256 = await computeIntegritySha256(storedUri);

    const info = await FileSystem.getInfoAsync(storedUri);
    const size = info.exists && 'size' in info ? info.size : 0;

    await imageCacheManager.add({
      uri: storedUri,
      size,
      assessmentId,
      createdAt,
    });

    return { filenameKey, integritySha256, storedUri };
  } catch (error) {
    console.error('Failed to store image:', error);
    throw new Error('Failed to store image');
  }
}

export async function storeThumbnail(params: {
  thumbnailUri: string;
  assessmentId: string;
  filenameKey: string;
  createdAt?: number;
}): Promise<string> {
  const {
    thumbnailUri,
    assessmentId,
    filenameKey,
    createdAt = Date.now(),
  } = params;

  try {
    const assessmentsRoot = getAssessmentDir();
    const assessmentDir = `${assessmentsRoot}${sanitizePathSegment(assessmentId)}/`;
    await FileSystem.makeDirectoryAsync(assessmentDir, { intermediates: true });

    // Re-encode thumbnail to JPEG and strip EXIF data using ImageManipulator
    const storedUri = `${assessmentDir}${filenameKey}_thumb.jpg`;
    const manipResult = await ImageManipulator.manipulateAsync(
      thumbnailUri,
      [], // No transformations needed, just strip EXIF
      {
        compress: 0.9, // Slight compression to ensure quality
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );

    // Move the manipulated image to the final destination
    await FileSystem.moveAsync({
      from: manipResult.uri,
      to: storedUri,
    });

    const info = await FileSystem.getInfoAsync(storedUri);
    const size = info.exists && 'size' in info ? info.size : 0;

    await imageCacheManager.add({
      uri: storedUri,
      size,
      assessmentId,
      createdAt,
    });

    return storedUri;
  } catch (error) {
    console.error('Failed to store thumbnail:', error);
    throw new Error('Failed to store thumbnail');
  }
}
