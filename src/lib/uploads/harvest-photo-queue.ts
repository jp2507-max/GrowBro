/**
 * Queue management for harvest photo uploads
 *
 * This module handles queueing of harvest photo variants for background upload.
 * Separated from harvest-photo-upload.ts to avoid circular dependencies.
 */

import type { PhotoVariants } from '@/types/photo-storage';

import { enqueueHarvestPhotoVariant } from './queue';

/**
 * Enqueue all harvest photo variants for background upload
 *
 * @param variants - Photo variants from local storage
 * @param userId - User ID (from auth.uid())
 * @param harvestId - Harvest ID
 * @returns Array of queue item IDs
 */
export async function enqueueHarvestPhotos(
  variants: PhotoVariants,
  userId: string,
  harvestId: string
): Promise<string[]> {
  const queueIds: string[] = [];

  // Extract hash from local URI filename (format: hash.ext)
  const extractHash = (uri: string): string => {
    const parts = uri.split('/');
    const filename = parts[parts.length - 1] ?? '';
    return filename.split('.')[0] ?? '';
  };

  // Enqueue original
  const originalHash = extractHash(variants.original);
  const originalExt = variants.original.split('.').pop() ?? 'jpg';
  const originalId = await enqueueHarvestPhotoVariant({
    localUri: variants.original,
    userId,
    harvestId,
    variant: 'original',
    hash: originalHash,
    extension: originalExt,
    mimeType: variants.metadata.mimeType ?? 'image/jpeg',
  });
  queueIds.push(originalId);

  // Enqueue resized
  const resizedHash = extractHash(variants.resized);
  const resizedExt = variants.resized.split('.').pop() ?? 'jpg';
  const resizedId = await enqueueHarvestPhotoVariant({
    localUri: variants.resized,
    userId,
    harvestId,
    variant: 'resized',
    hash: resizedHash,
    extension: resizedExt,
    mimeType: variants.metadata.mimeType ?? 'image/jpeg',
  });
  queueIds.push(resizedId);

  // Enqueue thumbnail
  const thumbnailHash = extractHash(variants.thumbnail);
  const thumbnailExt = variants.thumbnail.split('.').pop() ?? 'jpg';
  const thumbnailId = await enqueueHarvestPhotoVariant({
    localUri: variants.thumbnail,
    userId,
    harvestId,
    variant: 'thumbnail',
    hash: thumbnailHash,
    extension: thumbnailExt,
    mimeType: variants.metadata.mimeType ?? 'image/jpeg',
  });
  queueIds.push(thumbnailId);

  return queueIds;
}
