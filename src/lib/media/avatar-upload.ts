import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';
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
 *
 * Avatar Upload Pipeline (9 steps):
 * ================================
 *
 * Step 1: EXIF Stripping (Privacy Protection)
 * - Removes all EXIF metadata (GPS location, camera model, timestamps)
 * - Prevents accidental geolocation disclosure
 * - Uses expo-image-manipulator's built-in stripping
 * Progress: 10%
 *
 * Step 2: Dimension Detection (Preparation for Cropping)
 * - Reads original image dimensions
 * - Determines smaller dimension for square crop
 * - Calculates center crop origin coordinates
 * Progress: 20%
 *
 * Step 3: Center Cropping (1:1 Aspect Ratio)
 * - Crops to largest possible square from center
 * - Formula: size = min(width, height)
 * - Origin: originX = (width - size) / 2, originY = (height - size) / 2
 * - Preserves subject composition while standardizing aspect ratio
 * Progress: 40%
 *
 * Step 4: Resizing (512x512px)
 * - Scales cropped image to 512x512px
 * - Balance between quality and file size
 * - Suitable for profile displays and thumbnails
 *
 * Step 5: Initial Compression (80% quality)
 * - Compresses JPEG to 80% quality
 * - First attempt to stay under 200KB target
 *
 * Step 6: Iterative Compression (Quality Loop)
 * - Checks file size after initial compression
 * - If > 200KB: reduces quality by 10% increments
 * - Minimum quality: 30% (prevents overly pixelated images)
 * - Stops when: size < 200KB OR quality < 30%
 * Progress: 50%
 *
 * Step 7: Supabase Storage Upload
 * - Converts blob to ArrayBuffer for upload
 * - Uploads to avatars/{userId}/{timestamp}.jpg
 * - Uses upsert: false to prevent overwrites (timestamped filenames)
 * - Content-Type: image/jpeg
 * Progress: 70%
 *
 * Step 8: Public URL Generation
 * - Retrieves public URL from Supabase Storage
 * - URL is cacheable and CDN-backed
 * Progress: 90%
 *
 * Step 9: Status Update (pending → success/failed)
 * - Sets status to 'pending' until profile record updates
 * - Returns URL and path for profile table update
 * Progress: 100%
 *
 * Error Handling:
 * - Any step failure triggers 'failed' status with error message
 * - onProgress callback updated throughout for UI feedback
 * - Throws error to caller for retry logic
 *
 * Security Considerations:
 * - EXIF stripped to prevent metadata leaks
 * - Timestamped filenames prevent collisions
 * - User ID path isolation prevents cross-user access
 * - RLS policies enforce owner-only access
 * - Public URLs are CDN-backed but storage bucket is private
 *
 * Performance Notes:
 * - Iterative compression may take 1-3 seconds for large images
 * - Network upload time depends on connection quality
 * - Progress callbacks enable smooth UI feedback
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

    // Step 5 & 6: Check file size and compress further if needed
    // Iterative compression loop: reduce quality by 10% until < 200KB or quality < 30%
    onProgress?.({ status: 'uploading', progress: 50 });
    let currentUri = processedImage.uri;
    let fileInfo = await FileSystem.getInfoAsync(currentUri);
    let quality = 0.8;

    // Iteratively compress until under 200KB
    while (
      fileInfo.exists &&
      'size' in fileInfo &&
      fileInfo.size > MAX_FILE_SIZE_KB * 1024 &&
      quality > 0.3
    ) {
      quality -= 0.1;
      const recompressed = await ImageManipulator.manipulateAsync(
        processedImage.uri,
        [],
        {
          compress: quality,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );
      currentUri = recompressed.uri;
      fileInfo = await FileSystem.getInfoAsync(currentUri);
    }

    // Warn if still oversized after compression
    if (
      fileInfo.exists &&
      'size' in fileInfo &&
      fileInfo.size > MAX_FILE_SIZE_KB * 1024
    ) {
      console.warn(
        `Avatar still ${Math.round(fileInfo.size / 1024)}KB after compression to ${Math.round(quality * 100)}% quality`
      );
    }

    // Step 7: Upload to Supabase Storage
    onProgress?.({ status: 'uploading', progress: 70 });
    const timestamp = Date.now();
    const filename = `${timestamp}.jpg`;
    const path = `${userId}/${filename}`;

    // Read file as base64 and decode to ArrayBuffer for Supabase upload
    // (blob.arrayBuffer() is not available in React Native)
    const base64 = await FileSystem.readAsStringAsync(currentUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const arrayBuffer = decode(base64);

    const { data, error } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(path, arrayBuffer, {
        contentType: 'image/jpeg',
        upsert: false, // Don't overwrite existing files
      });

    if (error) {
      throw new Error(`Upload failed: ${error.message}`);
    }

    // Step 8: Get public URL
    onProgress?.({ status: 'uploading', progress: 90 });
    const {
      data: { publicUrl },
    } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(data.path);

    // Step 9: Update status to pending (awaiting profile record update)
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
