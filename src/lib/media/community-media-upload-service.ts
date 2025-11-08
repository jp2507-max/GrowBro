/**
 * Community media upload service
 *
 * Requirements:
 * - 5.4: Upload photo variants to Supabase Storage with retry logic
 * - Guard against large originals and implement retryable upload logic
 */

import * as FileSystem from 'expo-file-system';

import { supabase } from '@/lib/supabase';
import type { PhotoVariants } from '@/types/photo-storage';

const COMMUNITY_MEDIA_BUCKET = 'community-posts';
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

export interface UploadResult {
  originalPath: string;
  resizedPath: string;
  thumbnailPath: string;
  metadata: {
    width: number;
    height: number;
    aspectRatio: number;
    bytes: number;
    blurhash?: string;
    thumbhash?: string;
  };
}

interface UploadVariantOptions {
  uri: string;
  path: string;
  contentType: string;
  uploadedPaths: string[];
}

/**
 * Upload photo variants to Supabase Storage
 *
 * @param userId - User ID for storage path
 * @param variants - Photo variants from captureAndStore
 * @param contentHash - Content hash for deduplication
 * @returns Upload result with storage paths
 */
export async function uploadCommunityMediaVariants(
  userId: string,
  variants: PhotoVariants,
  contentHash: string
): Promise<UploadResult> {
  const basePath = buildBasePath(userId, contentHash);
  const uploadedPaths: string[] = [];

  try {
    // Upload original variant
    const originalPath = await uploadVariantWithRetry({
      uri: variants.original,
      path: `${basePath}/original.jpg`,
      contentType: 'image/jpeg',
      uploadedPaths,
    });

    // Upload resized variant
    const resizedPath = await uploadVariantWithRetry({
      uri: variants.resized,
      path: `${basePath}/resized.jpg`,
      contentType: 'image/jpeg',
      uploadedPaths,
    });

    // Upload thumbnail variant
    const thumbnailPath = await uploadVariantWithRetry({
      uri: variants.thumbnail,
      path: `${basePath}/thumbnail.jpg`,
      contentType: 'image/jpeg',
      uploadedPaths,
    });

    // Calculate aspect ratio
    const width = variants.metadata.width ?? 0;
    const height = variants.metadata.height ?? 0;
    const aspectRatio = height > 0 ? width / height : 1;

    return {
      originalPath: `${COMMUNITY_MEDIA_BUCKET}/${originalPath}`,
      resizedPath: `${COMMUNITY_MEDIA_BUCKET}/${resizedPath}`,
      thumbnailPath: `${COMMUNITY_MEDIA_BUCKET}/${thumbnailPath}`,
      metadata: {
        width,
        height,
        aspectRatio,
        bytes: variants.metadata.fileSize ?? 0,
        // BlurHash/ThumbHash would be generated here in future
        // For now, server-side processing handles this
      },
    };
  } catch (error) {
    // Cleanup any uploaded files on failure
    if (uploadedPaths.length > 0) {
      await cleanupUploadedFiles(uploadedPaths);
    }
    throw error;
  }
}

/**
 * Upload a single variant with retry logic
 */
async function uploadVariantWithRetry(
  options: UploadVariantOptions
): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const path = await uploadVariant(options);
      return path;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(
        `Upload attempt ${attempt + 1}/${MAX_RETRIES} failed:`,
        lastError.message
      );

      // Don't retry on final attempt
      if (attempt < MAX_RETRIES - 1) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        await sleep(delay);
      }
    }
  }

  throw new Error(
    `Failed to upload variant after ${MAX_RETRIES} attempts: ${lastError?.message}`
  );
}

/**
 * Upload a single variant to Supabase Storage
 */
async function uploadVariant(options: UploadVariantOptions): Promise<string> {
  const { uri, path, contentType, uploadedPaths } = options;

  // Read file as base64
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: 'base64',
  });

  // Convert base64 to ArrayBuffer
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Upload to Supabase Storage
  const { data, error } = await supabase.storage
    .from(COMMUNITY_MEDIA_BUCKET)
    .upload(path, bytes, {
      contentType,
      upsert: false,
    });

  // Handle duplicate uploads (409 conflict) as success
  if (error && error.message !== 'The resource already exists') {
    throw new Error(`Failed to upload variant: ${error.message}`);
  }

  // Track uploaded path for cleanup on failure
  if (!error && data?.path) {
    uploadedPaths.push(data.path);
  }

  return path;
}

/**
 * Cleanup uploaded files on error
 */
async function cleanupUploadedFiles(paths: string[]): Promise<void> {
  try {
    const { error } = await supabase.storage
      .from(COMMUNITY_MEDIA_BUCKET)
      .remove(paths);

    if (error) {
      console.warn('Failed to cleanup uploaded files:', error);
    }
  } catch (error) {
    console.warn('Failed to cleanup uploaded files:', error);
  }
}

/**
 * Build storage path for user and content hash
 */
function buildBasePath(userId: string, hash: string): string {
  const safeUserId = sanitizePathSegment(userId) || 'user';
  const safeHash = sanitizePathSegment(hash) || 'media';
  return `${safeUserId}/${safeHash}`;
}

/**
 * Sanitize path segment to prevent directory traversal
 */
function sanitizePathSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '');
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
