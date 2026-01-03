/**
 * Shared FlashList v2 performance optimization configuration
 * Used across all list screens (strains, community, notifications, etc.)
 *
 * FlashList v2 (targeting New Architecture) no longer requires estimatedItemSize
 */

import { Platform } from 'react-native';

/**
 * Configuration interface for FlashList v2 performance optimization
 */
export type FlashListConfig = {
  drawDistance: number;
  removeClippedSubviews: boolean;
  scrollEventThrottle: number;
};

/**
 * Check if device is considered low-memory for adaptive configuration
 */
export function isLowMemoryDevice(): boolean {
  return Platform.OS === 'android' && Platform.Version < 29;
}

/**
 * Get optimized FlashList v2 configuration for large lists (100+ items)
 *
 * Performance tuning for fast scrolling:
 * - Higher drawDistance (800-1200px) pre-renders items before they enter viewport
 * - scrollEventThrottle at 32ms balances performance vs responsiveness
 *
 * Use case: Strains list, Community feed, Search results
 */
export function getOptimizedFlashListConfig(): FlashListConfig {
  const lowMem = isLowMemoryDevice();

  return {
    // Pre-render items 800-1200px before they become visible
    // Higher values reduce blank areas during fast scrolling
    drawDistance: lowMem ? 800 : 1200,
    removeClippedSubviews: true,
    // 32ms throttle for scroll events (vs 16ms default)
    // Reduces JS bridge traffic while maintaining smooth feel
    scrollEventThrottle: 32,
  };
}

/**
 * Get lighter FlashList configuration for medium-sized lists (20-100 items)
 *
 * Lower memory overhead than the full config, suitable for:
 * - Notifications list
 * - Playbook selection
 * - Settings lists
 */
export function getMediumFlashListConfig(): FlashListConfig {
  const lowMem = isLowMemoryDevice();

  return {
    drawDistance: lowMem ? 500 : 800,
    removeClippedSubviews: true,
    scrollEventThrottle: 32,
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
