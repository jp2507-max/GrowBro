/**
 * Performance monitoring utilities for strains feature
 */

import type { AnalyticsClient } from '@/lib/analytics';

/**
 * FlashList performance metrics tracker
 */
export function createFlashListPerformanceTracker() {
  let frameTimestamps: number[] = [];
  let startTime: number = 0;
  let isTracking: boolean = false;

  return {
    start(): void {
      frameTimestamps = [];
      startTime = Date.now();
      isTracking = true;
    },

    recordFrame(): void {
      if (!isTracking) return;
      frameTimestamps.push(Date.now());
    },

    stop(analytics: AnalyticsClient, listSize: number): void {
      if (!isTracking || frameTimestamps.length === 0) return;

      isTracking = false;

      const totalTime = Date.now() - startTime;
      const totalFrames = frameTimestamps.length;

      // Guard against zero-duration or single-sample cases
      if (frameTimestamps.length < 2 || totalTime <= 0) {
        // Emit safe defaults
        analytics.track('strain_list_performance', {
          fps: 0,
          frame_drops: 0,
          total_frames: totalFrames,
          avg_frame_time_ms: 0,
          list_size: listSize,
        });
        return;
      }

      // Calculate frame times
      const frameTimes: number[] = [];
      for (let i = 1; i < frameTimestamps.length; i++) {
        frameTimes.push(frameTimestamps[i] - frameTimestamps[i - 1]);
      }

      // Calculate metrics with safe computations
      const avgFrameTime =
        frameTimes.length > 0
          ? frameTimes.reduce((sum, time) => sum + time, 0) / frameTimes.length
          : 0;
      const fps = totalTime > 0 ? totalFrames / (totalTime / 1000) : 0;
      const frameDrops = frameTimes.filter((time) => time > 32).length; // 32ms = ~30fps threshold

      analytics.track('strain_list_performance', {
        fps: Math.round(fps),
        frame_drops: frameDrops,
        total_frames: totalFrames,
        avg_frame_time_ms: Math.round(avgFrameTime),
        list_size: listSize,
      });
    },

    reset(): void {
      frameTimestamps = [];
      startTime = 0;
      isTracking = false;
    },
  };
}

/**
 * Track API performance
 */
export function trackApiPerformance(
  analytics: AnalyticsClient,
  params: {
    endpoint: 'list' | 'detail';
    responseTimeMs: number;
    statusCode: number;
    cacheHit: boolean;
    errorType?: string;
  }
): void {
  analytics.track('strain_api_performance', {
    endpoint: params.endpoint,
    response_time_ms: params.responseTimeMs,
    status_code: params.statusCode,
    cache_hit: params.cacheHit,
    error_type: params.errorType,
  });
}

/**
 * Track image loading performance
 */
export function trackImagePerformance(
  analytics: AnalyticsClient,
  params: {
    loadTimeMs: number;
    cacheHit: boolean;
    imageSizeKb?: number;
    failed: boolean;
  }
): void {
  analytics.track('strain_image_performance', {
    load_time_ms: params.loadTimeMs,
    cache_hit: params.cacheHit,
    image_size_kb: params.imageSizeKb,
    failed: params.failed,
  });
}

/**
 * Track cache performance
 */
export function trackCachePerformance(
  analytics: AnalyticsClient,
  params: {
    operation: 'read' | 'write' | 'evict';
    cacheType: 'memory' | 'disk' | 'etag';
    hitRate?: number;
    sizeKb?: number;
  }
): void {
  analytics.track('strain_cache_performance', {
    operation: params.operation,
    cache_type: params.cacheType,
    hit_rate: params.hitRate,
    size_kb: params.sizeKb,
  });
}

/**
 * Simple performance timer utility
 */
export function createPerformanceTimer() {
  let startTime: number = 0;

  return {
    start(): void {
      startTime = Date.now();
    },

    stop(): number {
      return Date.now() - startTime;
    },

    reset(): void {
      startTime = 0;
    },
  };
}

/**
 * Aggregate performance metrics over time
 */
export function createPerformanceAggregator() {
  const metrics: Map<string, number[]> = new Map();

  return {
    record(key: string, value: number): void {
      const values = metrics.get(key) || [];
      values.push(value);

      // Keep only last 100 values to prevent memory issues
      if (values.length > 100) {
        values.shift();
      }

      metrics.set(key, values);
    },

    getAverage(key: string): number | null {
      const values = metrics.get(key);
      if (!values || values.length === 0) return null;

      const sum = values.reduce((acc, val) => acc + val, 0);
      return sum / values.length;
    },

    getP95(key: string): number | null {
      const values = metrics.get(key);
      if (!values || values.length === 0) return null;

      const sorted = [...values].sort((a, b) => a - b);
      const index = Math.floor(sorted.length * 0.95);
      return sorted[index];
    },

    clear(key?: string): void {
      if (key) {
        metrics.delete(key);
      } else {
        metrics.clear();
      }
    },
  };
}
