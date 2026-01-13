/**
 * Image optimization utilities for strains feature
 * Handles prefetching, progressive loading, and cache management
 */

import { Image } from 'expo-image';
import { Platform } from 'react-native';

/**
 * BlurHash placeholder for strain images
 * Generic cannabis leaf pattern
 */
export const STRAIN_IMAGE_BLURHASH = 'L6PZfSi_.AyE_3t7t7R**0o#DgR4';

/**
 * Default placeholder image for strain images
 * Uses blurhash for lightweight placeholder rendering
 * Note: expo-image handles blurhash natively
 */
export const DEFAULT_STRAIN_PLACEHOLDER = STRAIN_IMAGE_BLURHASH;

/**
 * Type for image source - can be either a URI string or undefined (uses placeholder)
 */
export type ImageSource = { uri: string } | undefined;

/**
 * Image size configurations
 */
export const IMAGE_SIZES = {
  thumbnail: { width: 400, height: 400 }, // For list view
  detail: { width: 800, height: 800 }, // For detail view
  fullscreen: { width: 1200, height: 1200 }, // For fullscreen view
} as const;

/**
 * Generate image source for expo-image
 * Returns URI object for remote images or undefined to use placeholder
 */
export function getImageSource(
  originalUri: string | undefined | null
): ImageSource {
  if (
    originalUri &&
    typeof originalUri === 'string' &&
    originalUri.length > 0
  ) {
    return { uri: originalUri };
  }
  return undefined;
}

/**
 * Generate optimized image URI with size parameters
 * @deprecated Use getImageSource() instead for proper type handling
 * NOTE: This function is kept for backward compatibility but size param is ignored.
 * Returns the original URI unchanged or empty string (not the placeholder).
 */
export function getOptimizedImageUri(
  originalUri: string,
  _size: keyof typeof IMAGE_SIZES
): string {
  return originalUri || '';
}

/**
 * Prefetch images for visible-next items
 * Call this when items are about to become visible
 *
 * Optimized for fast scrolling:
 * - Larger batch size (6) for parallel prefetching
 * - No awaiting between batches for faster throughput
 */
export async function prefetchStrainImages(
  imageUris: string[],
  size: keyof typeof IMAGE_SIZES = 'thumbnail'
): Promise<void> {
  try {
    const optimizedUris = imageUris
      .filter((uri) => uri && uri.length > 0)
      .map((uri) => getOptimizedImageUri(uri, size));

    // Prefetch in parallel with larger batches for faster pre-loading
    // Using Promise.allSettled to not fail if individual images fail
    const BATCH_SIZE = 6;
    const batches: Promise<PromiseSettledResult<boolean>[]>[] = [];

    for (let i = 0; i < optimizedUris.length; i += BATCH_SIZE) {
      const batch = optimizedUris.slice(i, i + BATCH_SIZE);
      // Fire batches concurrently, don't await each batch sequentially
      batches.push(Promise.allSettled(batch.map((uri) => Image.prefetch(uri))));
    }

    // Wait for all batches to complete
    await Promise.all(batches);
  } catch (error) {
    console.debug('[prefetchStrainImages] Prefetch failed:', error);
  }
}

/**
 * Clear image cache for memory management
 * Call this when memory pressure is detected
 */
export async function clearImageCache(): Promise<void> {
  try {
    await Image.clearMemoryCache();
    console.debug('[clearImageCache] Memory cache cleared');
  } catch (error) {
    console.debug('[clearImageCache] Failed to clear cache:', error);
  }
}

/**
 * Clear disk cache (more aggressive)
 * Use sparingly, typically only on user request or critical memory issues
 */
export async function clearDiskCache(): Promise<void> {
  try {
    await Image.clearDiskCache();
    console.debug('[clearDiskCache] Disk cache cleared');
  } catch (error) {
    console.debug('[clearDiskCache] Failed to clear disk cache:', error);
  }
}

/**
 * Get cache size limits based on device capabilities
 */
export function getCacheLimits(): {
  memoryLimitMB: number;
  diskLimitMB: number;
} {
  const isLowMemoryDevice = Platform.OS === 'android' && Platform.Version < 29;

  return {
    memoryLimitMB: isLowMemoryDevice ? 50 : 100,
    diskLimitMB: isLowMemoryDevice ? 200 : 500,
  };
}

/**
 * Image loading configuration for expo-image
 */
export const IMAGE_CONFIG = {
  cachePolicy: 'memory-disk' as const,
  placeholder: STRAIN_IMAGE_BLURHASH,
  transition: {
    duration: 200,
    timing: 'ease-in-out' as const,
  },
  recyclingKey: (id: string) => `strain-${id}`,
  priority: 'normal' as const,
} as const;

/**
 * Get image props for StrainCard (list view)
 */
export function getListImageProps(strainId: string, imageUrl: string) {
  return {
    source: getImageSource(imageUrl),
    placeholder: IMAGE_CONFIG.placeholder,
    cachePolicy: IMAGE_CONFIG.cachePolicy,
    recyclingKey: IMAGE_CONFIG.recyclingKey(strainId),
    transition: 0,
    priority: IMAGE_CONFIG.priority,
  };
}

/**
 * Get image props for StrainDetail (detail view)
 */
export function getDetailImageProps(strainId: string, imageUrl: string) {
  return {
    source: getImageSource(imageUrl),
    placeholder: IMAGE_CONFIG.placeholder,
    cachePolicy: IMAGE_CONFIG.cachePolicy,
    recyclingKey: IMAGE_CONFIG.recyclingKey(strainId),
    transition: IMAGE_CONFIG.transition,
    priority: 'high' as const,
  };
}
