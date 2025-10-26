import * as FileSystem from 'expo-file-system';

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

    const [filenameKey, integritySha256] = await Promise.all([
      computeFilenameKey(imageUri),
      computeIntegritySha256(imageUri),
    ]);

    const storedUri = `${assessmentDir}${filenameKey}.jpg`;
    await FileSystem.copyAsync({
      from: imageUri,
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

    const storedUri = `${assessmentDir}${filenameKey}_thumb.jpg`;
    await FileSystem.copyAsync({
      from: thumbnailUri,
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
