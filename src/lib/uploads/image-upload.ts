import { stripExifAndGeolocation } from '@/lib/media/exif';
import { supabase } from '@/lib/supabase';

export interface UploadProgressCallback {
  (progress: number): void;
}

export interface UploadResult {
  bucket: string;
  path: string;
}

export async function uploadImageWithProgress(params: {
  plantId: string;
  filename: string;
  localUri: string;
  mimeType: string;
  onProgress?: UploadProgressCallback;
}): Promise<UploadResult> {
  const { plantId, filename, localUri, mimeType, onProgress } = params;

  try {
    // Strip EXIF/GPS and read the file as blob
    const stripped = await stripExifAndGeolocation(localUri);
    const response = await fetch(stripped.uri);
    const blob = await response.blob();

    // If EXIF was stripped, the image was re-encoded to JPEG
    const didStrip = stripped.didStrip;
    const finalMimeType = didStrip ? 'image/jpeg' : mimeType;
    const finalFilename = didStrip
      ? filename.replace(/\.[^.]+$/, '.jpg')
      : filename;

    // Convert blob to ArrayBuffer for Supabase upload
    const arrayBuffer = await blob.arrayBuffer();

    // Create the file path in Supabase storage
    const bucket = 'plant-images';
    const path = `${plantId}/${finalFilename}`;

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
