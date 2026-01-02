import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';

import { supabase } from '@/lib/supabase';

export interface UploadProgressCallback {
  (progress: number): void;
}

export interface UploadResult {
  bucket: string;
  path: string;
}

/**
 * Upload a plant image to Supabase Storage with RLS-safe path.
 *
 * The path follows the RLS policy: plant-images/${userId}/${plantId}/${filename}
 */
export async function uploadImageWithProgress(params: {
  userId: string;
  plantId: string;
  filename: string;
  localUri: string;
  mimeType: string;
  onProgress?: UploadProgressCallback;
}): Promise<UploadResult> {
  const { userId, plantId, filename, localUri, mimeType, onProgress } = params;

  try {
    // NOTE: EXIF/GPS is already stripped at storage time (storePlantPhotoLocally)
    // so we upload the file as-is to avoid double-processing and hash mismatches

    // Use the provided mime type and filename directly
    // (they were determined at store time when EXIF was stripped)
    const finalMimeType = mimeType;
    const finalFilename = filename;

    // Read file as base64 and decode to ArrayBuffer for Supabase upload
    // (blob.arrayBuffer() is not available in React Native)
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const arrayBuffer = decode(base64);

    // Create the RLS-safe file path: userId/plantId/filename
    const bucket = 'plant-images';
    const path = makeObjectPath({ userId, plantId, filename: finalFilename });

    // Upload to Supabase storage
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, arrayBuffer, {
        contentType: finalMimeType,
        upsert: false, // Don't overwrite existing files
      });

    if (error) {
      throw new Error(`Upload failed: ${error.message}`);
    }

    // Call progress callback with 100% completion
    onProgress?.(100);

    return {
      bucket,
      path: data.path,
    };
  } catch (error) {
    console.error('Image upload failed:', error);
    throw error;
  }
}

export function makeObjectPath(opts: {
  userId: string;
  plantId: string;
  filename: string;
}): string {
  const sanitize = (s: string) => s.replace(/^\/+|\/+$/g, '');
  return [opts.userId, opts.plantId, opts.filename].map(sanitize).join('/');
}
