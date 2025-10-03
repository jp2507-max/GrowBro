/**
 * Utility to measure actual FlashList item sizes for performance optimization
 */

import { Platform } from 'react-native';

/**
 * Measured dimensions for StrainCard component
 * Based on actual layout measurements:
 * - Image height: 192px (h-48 = 12 * 16 = 192)
 * - Content padding: 16px (p-4 = 4 * 4 = 16)
 * - Badges row: ~28px
 * - Title: ~28px (text-lg with line height)
 * - Description: ~40px (2 lines of text-sm)
 * - Card padding: 8px top + 8px bottom (py-2)
 * - Card margin: 8px bottom (mb-2)
 */
export const STRAIN_CARD_DIMENSIONS = {
  imageHeight: 192,
  contentPadding: 16,
  badgesHeight: 28,
  titleHeight: 28,
  descriptionHeight: 40,
  cardVerticalPadding: 16, // py-2 = 8px top + 8px bottom
  cardMarginBottom: 8,
  borderWidth: 1,
} as const;

/**
 * Calculate estimated item size based on content
 */
export function calculateEstimatedItemSize(hasDescription: boolean): number {
  const {
    imageHeight,
    contentPadding,
    badgesHeight,
    titleHeight,
    descriptionHeight,
    cardVerticalPadding,
    cardMarginBottom,
    borderWidth,
  } = STRAIN_CARD_DIMENSIONS;

  const baseHeight =
    imageHeight +
    contentPadding * 2 + // top and bottom padding
    badgesHeight +
    titleHeight +
    cardVerticalPadding +
    cardMarginBottom +
    borderWidth * 2;

  return hasDescription ? baseHeight + descriptionHeight : baseHeight;
}

/**
 * Get optimized FlashList configuration for low-memory devices
 */
export function getOptimizedFlashListConfig() {
  const isLowMemoryDevice = Platform.OS === 'android' && Platform.Version < 29;

  return {
    drawDistance: isLowMemoryDevice ? 400 : 500,
    recycleBufferedViews: true,
    estimatedItemSize: 288, // Average size with description
    removeClippedSubviews: true,
    maxToRenderPerBatch: isLowMemoryDevice ? 5 : 10,
    windowSize: isLowMemoryDevice ? 5 : 10,
    updateCellsBatchingPeriod: 50,
  };
}

/**
 * Performance monitoring thresholds
 */
export const PERFORMANCE_THRESHOLDS = {
  targetFPS: 55,
  maxFrameDropMs: 32, // ~30fps threshold
  scrollSampleInterval: 100, // ms between performance samples
} as const;
