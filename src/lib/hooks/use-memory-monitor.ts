/**
 * React hook for monitoring memory usage during component lifecycle
 * Useful for development and debugging memory issues
 */

import { useEffect, useRef, useState } from 'react';

import { getMemoryMetrics } from '@/lib/performance/memory-monitor';
import type { MemoryMetrics } from '@/lib/performance/types';

interface UseMemoryMonitorOptions {
  enabled?: boolean;
  intervalMs?: number;
  logToConsole?: boolean;
}

interface UseMemoryMonitorResult {
  current: MemoryMetrics | null;
  baseline: MemoryMetrics | null;
  deltaMB: number;
  isMonitoring: boolean;
}

/**
 * Hook to monitor memory usage during component lifecycle
 * Captures baseline on mount and tracks delta over time
 *
 * @example
 * ```tsx
 * function MyScreen() {
 *   const memory = useMemoryMonitor({ enabled: __DEV__, intervalMs: 5000 });
 *
 *   if (__DEV__) {
 *     console.log(`Memory delta: ${memory.deltaMB.toFixed(2)} MB`);
 *   }
 *
 *   return <View>...</View>;
 * }
 * ```
 */
export function useMemoryMonitor(
  options: UseMemoryMonitorOptions = {}
): UseMemoryMonitorResult {
  const { enabled = false, intervalMs = 5000, logToConsole = false } = options;

  const [current, setCurrent] = useState<MemoryMetrics | null>(null);
  const baselineRef = useRef<MemoryMetrics | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    // Capture baseline on mount
    const baseline = getMemoryMetrics();
    baselineRef.current = baseline;
    setCurrent(baseline);

    if (logToConsole) {
      console.log('[MemoryMonitor] Baseline captured:', baseline);
    }

    // Start monitoring interval
    intervalRef.current = setInterval(() => {
      const metrics = getMemoryMetrics();
      setCurrent(metrics);

      if (logToConsole && baselineRef.current) {
        const deltaMB =
          (metrics.rssMemory - baselineRef.current.rssMemory) / (1024 * 1024);
        console.log(
          `[MemoryMonitor] Current: ${(metrics.rssMemory / (1024 * 1024)).toFixed(2)} MB | Delta: ${deltaMB.toFixed(2)} MB`
        );
      }
    }, intervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, intervalMs, logToConsole]);

  const deltaMB =
    current && baselineRef.current
      ? (current.rssMemory - baselineRef.current.rssMemory) / (1024 * 1024)
      : 0;

  return {
    current,
    baseline: baselineRef.current,
    deltaMB,
    isMonitoring: enabled && !!intervalRef.current,
  };
}
