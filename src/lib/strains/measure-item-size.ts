/**
 * Utility to measure actual FlashList v2 item sizes for performance optimization
 * FlashList v2 (targeting New Architecture) no longer requires estimatedItemSize
 */

// Re-export shared FlashList config for backward compatibility
export {
  type FlashListConfig,
  getOptimizedFlashListConfig,
  PERFORMANCE_THRESHOLDS,
} from '@/lib/flashlist-config';
