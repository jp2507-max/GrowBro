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
    const response = await fetch(localUri);
    const blob = await response.blob();

    // Use the provided mime type and filename directly
    // (they were determined at store time when EXIF was stripped)
    const finalMimeType = mimeType;
    const finalFilename = filename;

    // Convert blob to ArrayBuffer for Supabase upload
    const arrayBuffer = await blob.arrayBuffer();

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
