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
 * Default placeholder image URL
 */
export const DEFAULT_STRAIN_IMAGE =
  'https://placehold.co/400x400/e5e7eb/6b7280?text=No+Image';

/**
 * Image size configurations
 */
export const IMAGE_SIZES = {
  thumbnail: { width: 400, height: 400 }, // For list view
  detail: { width: 800, height: 800 }, // For detail view
  fullscreen: { width: 1200, height: 1200 }, // For fullscreen view
} as const;

/**
 * Generate optimized image URI with size parameters
 * This allows CDN/proxy to serve appropriately sized images
 */
export function getOptimizedImageUri(
  originalUri: string,
  size: keyof typeof IMAGE_SIZES
): string {
  if (!originalUri || originalUri === DEFAULT_STRAIN_IMAGE) {
    return originalUri;
  }

  const { width, height } = IMAGE_SIZES[size];

  // If the URI already has query params, append with &
  const separator = originalUri.includes('?') ? '&' : '?';

  return `${originalUri}${separator}w=${width}&h=${height}&fit=cover&q=85`;
}

/**
 * Prefetch images for visible-next items
 * Call this when items are about to become visible
 */
export async function prefetchStrainImages(
  imageUris: string[],
  size: keyof typeof IMAGE_SIZES = 'thumbnail'
): Promise<void> {
  try {
    const optimizedUris = imageUris
      .filter((uri) => uri && uri !== DEFAULT_STRAIN_IMAGE)
      .map((uri) => getOptimizedImageUri(uri, size));

    // Prefetch in parallel with a limit
    const BATCH_SIZE = 3;
    for (let i = 0; i < optimizedUris.length; i += BATCH_SIZE) {
      const batch = optimizedUris.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map((uri) => Image.prefetch(uri)));
    }
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
    source: { uri: getOptimizedImageUri(imageUrl, 'thumbnail') },
    placeholder: IMAGE_CONFIG.placeholder,
    cachePolicy: IMAGE_CONFIG.cachePolicy,
    recyclingKey: IMAGE_CONFIG.recyclingKey(strainId),
    transition: IMAGE_CONFIG.transition,
    priority: IMAGE_CONFIG.priority,
  };
}

/**
 * Get image props for StrainDetail (detail view)
 */
export function getDetailImageProps(strainId: string, imageUrl: string) {
  return {
    source: { uri: getOptimizedImageUri(imageUrl, 'detail') },
    placeholder: IMAGE_CONFIG.placeholder,
    cachePolicy: IMAGE_CONFIG.cachePolicy,
    recyclingKey: IMAGE_CONFIG.recyclingKey(strainId),
    transition: IMAGE_CONFIG.transition,
    priority: 'high' as const,
  };
}
