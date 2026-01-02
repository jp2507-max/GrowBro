/**
 * Harvest photo upload service for Supabase Storage
 *
 * Requirements:
 * - 18.5: Private bucket with bucket-level access policies
 * - 18.6: Signed URLs required for all reads
 * - 18.7: Owner-scoped uploads via auth.uid()
 * - Task 6.1: Upload 3 variants to harvest-photos bucket
 */

import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';

import { stripExifAndGeolocation } from '@/lib/media/exif';
import { supabase } from '@/lib/supabase';

import type { PhotoVariant } from './harvest-photo-types';

export type { PhotoVariant };

export interface HarvestPhotoUploadParams {
  /** User ID (from auth.uid()) */
  userId: string;
  /** Harvest ID */
  harvestId: string;
  /** Local file URI */
  localUri: string;
  /** Photo variant type */
  variant: PhotoVariant;
  /** Content hash for deterministic filename */
  hash: string;
  /** File extension (jpg, png, etc) */
  extension: string;
  /** MIME type */
  mimeType: string;
}

export interface HarvestPhotoUploadResult {
  /** Bucket name */
  bucket: string;
  /** Remote path in storage */
  path: string;
  /** Full storage URL */
  fullPath: string;
}

/**
 * Generate deterministic remote path for harvest photo
 * Path structure: /user_id/harvest_id/hash_variant.ext
 *
 * @param options - Path generation options
 * @returns Remote storage path
 */
export function generateHarvestPhotoPath(options: {
  userId: string;
  harvestId: string;
  hash: string;
  variant: PhotoVariant;
  extension: string;
}): string {
  const { userId, harvestId, hash, variant, extension } = options;

  // Sanitize components
  const sanitize = (s: string) => s.replace(/^\/+|\/+$/g, '');
  const cleanUserId = sanitize(userId);
  const cleanHarvestId = sanitize(harvestId);
  const cleanHash = sanitize(hash);
  const cleanExt = sanitize(extension);

  return `${cleanUserId}/${cleanHarvestId}/${cleanHash}_${variant}.${cleanExt}`;
}

/**
 * Upload single harvest photo variant to Supabase Storage
 *
 * @param params - Upload parameters
 * @returns Upload result with remote path
 * @throws Error if upload fails
 */
export async function uploadHarvestPhoto(
  params: HarvestPhotoUploadParams
): Promise<HarvestPhotoUploadResult> {
  const { userId, harvestId, localUri, variant, hash, extension, mimeType } =
    params;

  try {
    // Strip EXIF/GPS and read the file
    const stripped = await stripExifAndGeolocation(localUri);

    // If EXIF was stripped, the image was re-encoded to JPEG
    const didStrip = stripped.didStrip;
    const finalMimeType = didStrip ? 'image/jpeg' : mimeType;
    const finalExtension = didStrip ? 'jpg' : extension;

    // Read file as base64 and decode to ArrayBuffer for Supabase upload
    // (blob.arrayBuffer() is not available in React Native)
    const base64 = await FileSystem.readAsStringAsync(stripped.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const arrayBuffer = decode(base64);

    // Generate remote path
    const path = generateHarvestPhotoPath({
      userId,
      harvestId,
      hash,
      variant,
      extension: finalExtension,
    });

    // Upload to Supabase storage
    const bucket = 'harvest-photos';
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, arrayBuffer, {
        contentType: finalMimeType,
        upsert: false, // Don't overwrite existing files
      });

    if (error) {
      throw new Error(`Upload failed: ${error.message}`);
    }

    return {
      bucket,
      path: data.path,
      fullPath: `${bucket}/${data.path}`,
    };
  } catch (error) {
    console.error('Harvest photo upload failed:', error);
    throw error;
  }
}
