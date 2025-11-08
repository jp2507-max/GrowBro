/**
 * Memory monitoring utilities for performance testing
 * Tracks RSS, heap usage, and detects memory leaks during scroll tests
 */

import { NativeModules, Platform } from 'react-native';

import type { MemoryMetrics } from './types';

/**
 * Get current memory metrics snapshot
 * Uses platform-specific APIs to capture memory usage
 */
export function getMemoryMetrics(): MemoryMetrics {
  const timestamp = Date.now();

  // React Native Performance API (cross-platform)
  const performance = global.performance as Performance & {
    memory?: {
      usedJSHeapSize: number;
      totalJSHeapSize: number;
      jsHeapSizeLimit: number;
    };
  };

  let heapUsed = 0;
  let heapTotal = 0;
  let rssMemory = 0;

  if (performance?.memory) {
    heapUsed = performance.memory.usedJSHeapSize;
    heapTotal = performance.memory.totalJSHeapSize;
  }

  // Set rssMemory to actual live heap usage (usedJSHeapSize) when available
  // Falls back to platform-specific RSS native APIs if usedJSHeapSize is unavailable
  // Finally falls back to heapTotal (heap capacity) if native APIs are unavailable
  if (performance?.memory?.usedJSHeapSize) {
    rssMemory = performance.memory.usedJSHeapSize;
  } else {
    // Platform-specific memory APIs
    if (Platform.OS === 'android') {
      // Android: Attempt to use Debug.getNativeHeapAllocatedSize()
      // Requires native module integration (e.g., via NativeModules.Debug)
      try {
        rssMemory =
          NativeModules.Debug?.getNativeHeapAllocatedSize?.() ?? heapTotal;
      } catch {
        rssMemory = heapTotal;
      }
    } else if (Platform.OS === 'ios') {
      // iOS: Attempt to use mach/task_info hook via native module
      // Requires native module integration for task_info
      try {
        rssMemory = NativeModules.MemoryModule?.getTaskInfoRSS?.() ?? heapTotal;
      } catch {
        rssMemory = heapTotal;
      }
    } else {
      rssMemory = heapTotal;
    }
  }

  return {
    timestamp,
    heapUsed,
    heapTotal,
    rssMemory,
  };
}

/**
 * Force garbage collection if available
 * Requires --expose-gc flag in release builds
 */
export function forceGarbageCollection(): void {
  if (global.gc) {
    global.gc();
  } else {
    console.warn(
      '[MemoryMonitor] GC not exposed. Run with --expose-gc flag for accurate post-GC measurements.'
    );
  }
}

/**
 * Calculate memory delta in MB
 */
export function calculateMemoryDeltaMB(
  baseline: MemoryMetrics,
  current: MemoryMetrics
): number {
  const deltaBytes = current.rssMemory - baseline.rssMemory;
  return deltaBytes / (1024 * 1024);
}

/**
 * Format memory metrics for logging
 */
export function formatMemoryMetrics(metrics: MemoryMetrics): string {
  const heapUsedMB = (metrics.heapUsed / (1024 * 1024)).toFixed(2);
  const heapTotalMB = (metrics.heapTotal / (1024 * 1024)).toFixed(2);
  const rssMB = (metrics.rssMemory / (1024 * 1024)).toFixed(2);

  return `Heap: ${heapUsedMB}/${heapTotalMB} MB | RSS: ${rssMB} MB`;
}

/**
 * Wait for specified duration (for memory sampling intervals)
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Sample memory metrics at intervals during a test
 */
export async function sampleMemoryDuringTest(
  durationMs: number,
  intervalMs: number = 5000
): Promise<MemoryMetrics[]> {
  const samples: MemoryMetrics[] = [];
  const startTime = Date.now();

  while (Date.now() - startTime < durationMs) {
    samples.push(getMemoryMetrics());
    await wait(intervalMs);
  }

  return samples;
}

/**
 * Find peak memory usage from samples
 */
export function findPeakMemory(samples: MemoryMetrics[]): MemoryMetrics {
  return samples.reduce((peak, current) =>
    current.rssMemory > peak.rssMemory ? current : peak
  );
}

/**
 * Calculate average memory usage from samples
 */
export function calculateAverageMemory(samples: MemoryMetrics[]): number {
  if (samples.length === 0) return 0;

  const totalRSS = samples.reduce((sum, sample) => sum + sample.rssMemory, 0);
  return totalRSS / samples.length / (1024 * 1024); // MB
}
