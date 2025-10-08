/**
 * Harvest photo signed URL service for cross-device viewing
 *
 * Requirements:
 * - 18.6: Expiring signed URLs required for all reads
 * - Task 6.1: Generate signed URLs for viewing photos on other devices
 */

import { supabase } from '@/lib/supabase';

export interface SignedUrlResult {
  /** Remote storage path */
  path: string;
  /** Signed URL (expiring) */
  signedUrl: string;
  /** Expiration timestamp (Unix ms) */
  expiresAt: number;
}

/**
 * Generate signed URL for single harvest photo
 *
 * @param remotePath - Remote storage path (e.g., "user_id/harvest_id/hash_variant.jpg")
 * @param expiresIn - Expiration time in seconds (default: 3600 = 1 hour)
 * @returns Signed URL result
 * @throws Error if URL generation fails
 */
export async function getSignedUrl(
  remotePath: string,
  expiresIn = 3600
): Promise<SignedUrlResult> {
  try {
    const { data, error } = await supabase.storage
      .from('harvest-photos')
      .createSignedUrl(remotePath, expiresIn);

    if (error) {
      throw new Error(`Failed to generate signed URL: ${error.message}`);
    }

    if (!data?.signedUrl) {
      throw new Error('Signed URL is null');
    }

    return {
      path: remotePath,
      signedUrl: data.signedUrl,
      expiresAt: Date.now() + expiresIn * 1000,
    };
  } catch (error) {
    console.error('Signed URL generation failed:', error);
    throw error;
  }
}

/**
 * Generate signed URLs for multiple harvest photos (batch)
 *
 * @param remotePaths - Array of remote storage paths
 * @param expiresIn - Expiration time in seconds (default: 3600 = 1 hour)
 * @returns Array of signed URL results
 */
export async function getSignedUrls(
  remotePaths: string[],
  expiresIn = 3600
): Promise<SignedUrlResult[]> {
  // Supabase JS client doesn't have createSignedUrls (plural) method
  // We need to call createSignedUrl for each path individually
  const results = await Promise.all(
    remotePaths.map((path) => getSignedUrl(path, expiresIn))
  );

  return results;
}

/**
 * Generate signed URLs for harvest photo variants
 * Returns URLs for all 3 variants (original, resized, thumbnail)
 *
 * @param options - Photo variant URL options
 * @returns Object with signed URLs for each variant
 */
export async function getHarvestPhotoVariantUrls(options: {
  userId: string;
  harvestId: string;
  hash: string;
  extension: string;
  expiresIn?: number;
}): Promise<{
  original: string;
  resized: string;
  thumbnail: string;
}> {
  const { userId, harvestId, hash, extension, expiresIn = 3600 } = options;
  const basePath = `${userId}/${harvestId}/${hash}`;

  const [originalResult, resizedResult, thumbnailResult] = await getSignedUrls(
    [
      `${basePath}_original.${extension}`,
      `${basePath}_resized.${extension}`,
      `${basePath}_thumbnail.${extension}`,
    ],
    expiresIn
  );

  return {
    original: originalResult?.signedUrl ?? '',
    resized: resizedResult?.signedUrl ?? '',
    thumbnail: thumbnailResult?.signedUrl ?? '',
  };
}

/**
 * Check if signed URL is expired
 *
 * @param expiresAt - Expiration timestamp (Unix ms)
 * @returns True if expired
 */
export function isSignedUrlExpired(expiresAt: number): boolean {
  return Date.now() >= expiresAt;
}
