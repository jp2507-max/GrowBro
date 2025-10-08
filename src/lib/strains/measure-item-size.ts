/**
 * Utility to measure actual FlashList v2 item sizes for performance optimization
 * FlashList v2 (targeting New Architecture) no longer requires estimatedItemSize
 */

import { Platform } from 'react-native';

/**
 * Configuration interface for FlashList v2 performance optimization
 * Note: estimatedItemSize removed in v2 - FlashList auto-calculates
 */
interface FlashListConfig {
  drawDistance: number;
  removeClippedSubviews: boolean;
  maxToRenderPerBatch: number;
  windowSize: number;
  updateCellsBatchingPeriod: number;
}

/**
 * Get optimized FlashList v2 configuration
 * Note: Removed estimatedItemSize - FlashList v2 calculates automatically
 */
export function getOptimizedFlashListConfig(): FlashListConfig {
  const isLowMemoryDevice = Platform.OS === 'android' && Platform.Version < 29;

  return {
    drawDistance: isLowMemoryDevice ? 400 : 500,
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
