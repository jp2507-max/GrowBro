import * as ImageManipulator from 'expo-image-manipulator';

import { stripExifAndGeolocation } from '@/lib/media/exif';
import { supabase } from '@/lib/supabase';
import type { AvatarStatus } from '@/types/settings';

/**
 * Avatar upload service
 * Requirements: 9.4, 9.5, 9.9, 4.2, 4.3, 4.8
 *
 * Handles avatar image upload with EXIF removal, cropping, resizing, compression,
 * and upload to Supabase Storage with progress tracking and state management.
 */

export interface AvatarUploadProgress {
  status: AvatarStatus;
  progress: number; // 0-100
  error?: string;
}

export interface AvatarUploadResult {
  url: string;
  path: string;
}

export interface AvatarUploadOptions {
  userId: string;
  localUri: string;
  onProgress?: (progress: AvatarUploadProgress) => void;
}

const AVATAR_SIZE = 512;
const MAX_FILE_SIZE_KB = 200;
const AVATAR_BUCKET = 'avatars';

/**
 * Uploads an avatar image with processing pipeline:
 * 1. Strip EXIF metadata
 * 2. Crop to 1:1 aspect ratio (center crop)
 * 3. Resize to 512x512px
 * 4. Compress to <200KB
 * 5. Upload to Supabase Storage
 *
 * @param options - Upload options including userId, localUri, and progress callback
 * @returns Upload result with public URL and storage path
 * @throws Error if upload fails
 *
 * eslint-disable-next-line max-lines-per-function -- Complex multi-step image processing pipeline
 */
// eslint-disable-next-line max-lines-per-function
export async function uploadAvatar(
  options: AvatarUploadOptions
): Promise<AvatarUploadResult> {
  const { userId, localUri, onProgress } = options;

  try {
    // Step 1: Strip EXIF metadata
    onProgress?.({ status: 'uploading', progress: 10 });
    const stripped = await stripExifAndGeolocation(localUri);

    // Step 2: Get image dimensions for center cropping
    onProgress?.({ status: 'uploading', progress: 20 });
    const imageInfo = await ImageManipulator.manipulateAsync(stripped.uri, [], {
      format: ImageManipulator.SaveFormat.JPEG,
    });

    // Calculate center crop dimensions (1:1 aspect ratio)
    const { width, height } = imageInfo;
    const size = Math.min(width, height);
    const originX = (width - size) / 2;
    const originY = (height - size) / 2;

    // Step 3 & 4: Crop to 1:1, resize to 512x512, and compress
    onProgress?.({ status: 'uploading', progress: 40 });
    const processedImage = await ImageManipulator.manipulateAsync(
      stripped.uri,
      [
        {
          crop: {
            originX,
            originY,
            width: size,
            height: size,
          },
        },
        {
          resize: {
            width: AVATAR_SIZE,
            height: AVATAR_SIZE,
          },
        },
      ],
      {
        compress: 0.8, // 80% quality
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );

    // Check file size and compress further if needed
    onProgress?.({ status: 'uploading', progress: 50 });
    const response = await fetch(processedImage.uri);
    let blob = await response.blob();
    let quality = 0.8;

    // Iteratively compress until under 200KB
    while (blob.size > MAX_FILE_SIZE_KB * 1024 && quality > 0.3) {
      quality -= 0.1;
      const recompressed = await ImageManipulator.manipulateAsync(
        processedImage.uri,
        [],
        {
          compress: quality,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );
      const recompressedResponse = await fetch(recompressed.uri);
      blob = await recompressedResponse.blob();
    }

    // Step 5: Upload to Supabase Storage
    onProgress?.({ status: 'uploading', progress: 70 });
    const timestamp = Date.now();
    const filename = `${timestamp}.jpg`;
    const path = `${userId}/${filename}`;

    const arrayBuffer = await blob.arrayBuffer();

    const { data, error } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(path, arrayBuffer, {
        contentType: 'image/jpeg',
        upsert: false, // Don't overwrite existing files
      });

    if (error) {
      throw new Error(`Upload failed: ${error.message}`);
    }

    // Get public URL
    onProgress?.({ status: 'uploading', progress: 90 });
    const {
      data: { publicUrl },
    } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(data.path);

    onProgress?.({ status: 'pending', progress: 100 });

    return {
      url: publicUrl,
      path: data.path,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';
    onProgress?.({ status: 'failed', progress: 0, error: errorMessage });
    throw error;
  }
}

/**
 * Deletes an avatar from Supabase Storage
 * @param path - The storage path of the avatar to delete
 */
export async function deleteAvatar(path: string): Promise<void> {
  const { error } = await supabase.storage.from(AVATAR_BUCKET).remove([path]);

  if (error) {
    throw new Error(`Failed to delete avatar: ${error.message}`);
  }
}

/**
 * Gets a signed URL for an avatar with a short TTL
 * @param path - The storage path of the avatar
 * @param expiresIn - TTL in seconds (default: 3600 = 1 hour)
 * @returns Signed URL
 */
export async function getSignedAvatarUrl(
  path: string,
  expiresIn: number = 3600
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .createSignedUrl(path, expiresIn);

  if (error) {
    throw new Error(`Failed to create signed URL: ${error.message}`);
  }

  return data.signedUrl;
}
