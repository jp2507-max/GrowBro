/**
 * Hook for monitoring FlashList performance in strains feature
 */

import { useCallback, useEffect, useRef } from 'react';

import { useAnalytics } from '@/lib/use-analytics';

import { createFlashListPerformanceTracker } from './strains-performance';

/**
 * Monitor FlashList performance with FPS and frame drop tracking
 */
export function useFlashListPerformance(params: {
  listSize: number;
  enabled?: boolean;
  sampleInterval?: number; // ms between samples
}): {
  onScroll: () => void;
  startTracking: () => void;
  stopTracking: () => void;
} {
  const analytics = useAnalytics();
  const tracker = useRef<ReturnType<
    typeof createFlashListPerformanceTracker
  > | null>(null);
  const lastSampleTime = useRef(0);
  const sampleInterval = params.sampleInterval || 100; // Default 100ms

  useEffect(() => {
    if (params.enabled === false) return;

    tracker.current = createFlashListPerformanceTracker();

    return () => {
      if (tracker.current) {
        tracker.current.reset();
        tracker.current = null;
      }
    };
  }, [params.enabled]);

  const onScroll = useCallback(() => {
    if (!tracker.current || params.enabled === false) return;

    const now = Date.now();
    if (now - lastSampleTime.current >= sampleInterval) {
      tracker.current.recordFrame();
      lastSampleTime.current = now;
    }
  }, [params.enabled, sampleInterval]);

  const startTracking = useCallback(() => {
    if (!tracker.current || params.enabled === false) return;
    tracker.current.start();
  }, [params.enabled]);

  const stopTracking = useCallback(() => {
    if (!tracker.current || params.enabled === false) return;
    tracker.current.stop(analytics, params.listSize);
  }, [analytics, params.listSize, params.enabled]);

  return {
    onScroll,
    startTracking,
    stopTracking,
  };
}

/**
 * Track image loading performance
 */
export function useImagePerformanceTracking(): {
  trackImageLoad: (params: {
    loadTimeMs: number;
    cacheHit: boolean;
    imageSizeKb?: number;
    failed: boolean;
  }) => void;
} {
  const analytics = useAnalytics();

  const trackImageLoad = useCallback(
    async (params: {
      loadTimeMs: number;
      cacheHit: boolean;
      imageSizeKb?: number;
      failed: boolean;
    }) => {
      try {
        const { trackImagePerformance } = await import('./strains-performance');
        trackImagePerformance(analytics, params);
      } catch (error) {
        console.debug('[useImagePerformanceTracking] Tracking failed:', error);
      }
    },
    [analytics]
  );

  return { trackImageLoad };
}

/**
 * Track cache performance metrics
 */
export function useCachePerformanceTracking(): {
  trackCacheOperation: (params: {
    operation: 'read' | 'write' | 'evict';
    cacheType: 'memory' | 'disk' | 'etag';
    hitRate?: number;
    sizeKb?: number;
  }) => void;
} {
  const analytics = useAnalytics();

  const trackCacheOperation = useCallback(
    async (params: {
      operation: 'read' | 'write' | 'evict';
      cacheType: 'memory' | 'disk' | 'etag';
      hitRate?: number;
      sizeKb?: number;
    }) => {
      try {
        const { trackCachePerformance } = await import('./strains-performance');
        trackCachePerformance(analytics, params);
      } catch (error) {
        console.debug('[useCachePerformanceTracking] Tracking failed:', error);
      }
    },
    [analytics]
  );

  return { trackCacheOperation };
}
