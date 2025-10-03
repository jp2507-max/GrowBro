/**
 * Performance monitoring utilities for strains feature
 */

import type { AnalyticsClient } from '@/lib/analytics';

/**
 * FlashList performance metrics tracker
 */
export class FlashListPerformanceTracker {
  private frameTimestamps: number[] = [];
  private startTime: number = 0;
  private isTracking: boolean = false;

  start(): void {
    this.frameTimestamps = [];
    this.startTime = Date.now();
    this.isTracking = true;
  }

  recordFrame(): void {
    if (!this.isTracking) return;
    this.frameTimestamps.push(Date.now());
  }

  stop(analytics: AnalyticsClient, listSize: number): void {
    if (!this.isTracking || this.frameTimestamps.length === 0) return;

    this.isTracking = false;

    const totalTime = Date.now() - this.startTime;
    const totalFrames = this.frameTimestamps.length;

    // Calculate frame times
    const frameTimes: number[] = [];
    for (let i = 1; i < this.frameTimestamps.length; i++) {
      frameTimes.push(this.frameTimestamps[i] - this.frameTimestamps[i - 1]);
    }

    // Calculate metrics
    const avgFrameTime =
      frameTimes.reduce((sum, time) => sum + time, 0) / frameTimes.length;
    const fps = totalFrames / (totalTime / 1000);
    const frameDrops = frameTimes.filter((time) => time > 32).length; // 32ms = ~30fps threshold

    analytics.track('strain_list_performance', {
      fps: Math.round(fps),
      frame_drops: frameDrops,
      total_frames: totalFrames,
      avg_frame_time_ms: Math.round(avgFrameTime),
      list_size: listSize,
    });
  }

  reset(): void {
    this.frameTimestamps = [];
    this.startTime = 0;
    this.isTracking = false;
  }
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
export class PerformanceTimer {
  private startTime: number = 0;

  start(): void {
    this.startTime = Date.now();
  }

  stop(): number {
    return Date.now() - this.startTime;
  }

  reset(): void {
    this.startTime = 0;
  }
}

/**
 * Aggregate performance metrics over time
 */
export class PerformanceAggregator {
  private metrics: Map<string, number[]> = new Map();

  record(key: string, value: number): void {
    const values = this.metrics.get(key) || [];
    values.push(value);

    // Keep only last 100 values to prevent memory issues
    if (values.length > 100) {
      values.shift();
    }

    this.metrics.set(key, values);
  }

  getAverage(key: string): number | null {
    const values = this.metrics.get(key);
    if (!values || values.length === 0) return null;

    const sum = values.reduce((acc, val) => acc + val, 0);
    return sum / values.length;
  }

  getP95(key: string): number | null {
    const values = this.metrics.get(key);
    if (!values || values.length === 0) return null;

    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.floor(sorted.length * 0.95);
    return sorted[index];
  }

  clear(key?: string): void {
    if (key) {
      this.metrics.delete(key);
    } else {
      this.metrics.clear();
    }
  }
}
