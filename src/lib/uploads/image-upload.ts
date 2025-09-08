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
    // Read the file as blob
    const response = await fetch(localUri);
    const blob = await response.blob();

    // Convert blob to ArrayBuffer for Supabase upload
    const arrayBuffer = await blob.arrayBuffer();

    // Create the file path in Supabase storage
    const bucket = 'plant-images';
    const path = `${plantId}/${filename}`;

    // Upload to Supabase storage
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, arrayBuffer, {
        contentType: mimeType,
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
