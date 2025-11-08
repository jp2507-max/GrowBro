/**
 * Worklet Performance Monitoring
 *
 * Utilities for tracking and monitoring Reanimated worklet performance.
 * Tracks input-to-render latency, frame drops, and gesture response times.
 *
 * Requirements: 2.3, 2.5
 */

import { useCallback, useRef } from 'react';
import type { SharedValue } from 'react-native-reanimated';
import { runOnJS, useSharedValue } from 'react-native-reanimated';

import type { WorkletPerformanceMetrics } from './types';

export interface GestureLatencyMetrics {
  startTime: number;
  endTime: number;
  latency: number;
  droppedFrames: number;
}

/**
 * Helper to calculate performance metrics from latency data
 */
function calculatePerformanceMetrics(
  latencies: number[],
  frameCount: number,
  droppedFrames: number
): WorkletPerformanceMetrics {
  const avgLatency =
    latencies.length > 0
      ? latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length
      : 0;

  return {
    inputToRenderLatency: avgLatency,
    workletExecutionTime: avgLatency,
    droppedFrames,
    gestureResponseTimes: latencies,
  };
}

/**
 * Hook for tracking gesture performance metrics
 *
 * Monitors input-to-render latency and frame drops during continuous gestures.
 * Target: P95 latency ≤50ms, dropped frames <1%
 */
export function useGesturePerformanceTracker() {
  const startTimeShared = useSharedValue<number>(0);
  const latenciesRef = useRef<number[]>([]);
  const frameCountShared = useSharedValue<number>(0);
  const droppedFramesShared = useSharedValue<number>(0);

  const trackGestureStart = useCallback(() => {
    'worklet';
    const now = performance.now();
    startTimeShared.value = now;
    frameCountShared.value = 0;
    droppedFramesShared.value = 0;
  }, [startTimeShared, frameCountShared, droppedFramesShared]);

  const trackGestureUpdate = useCallback(() => {
    'worklet';
    if (startTimeShared.value === 0) return;

    const now = performance.now();
    const latency = now - startTimeShared.value;

    frameCountShared.value += 1;

    // Frame budget is 16.7ms (60 FPS)
    if (latency > 16.7) {
      droppedFramesShared.value += 1;
    }

    runOnJS((lat: number) => {
      latenciesRef.current.push(lat);
      // Keep only last 100 samples to avoid memory growth
      if (latenciesRef.current.length > 100) {
        latenciesRef.current.shift();
      }
    })(latency);

    startTimeShared.value = now;
  }, [startTimeShared, frameCountShared, droppedFramesShared]);

  const trackGestureEnd = useCallback(() => {
    'worklet';
    startTimeShared.value = 0;
  }, [startTimeShared]);

  const getLatencyMetrics = useCallback((): GestureLatencyMetrics | null => {
    if (latenciesRef.current.length === 0) {
      return null;
    }

    const latencies = [...latenciesRef.current];
    const avgLatency =
      latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;

    return {
      startTime: 0,
      endTime: 0,
      latency: avgLatency,
      droppedFrames: droppedFramesShared.value,
    };
  }, [droppedFramesShared]);

  const getMetrics = useCallback((): WorkletPerformanceMetrics => {
    return calculatePerformanceMetrics(
      [...latenciesRef.current],
      frameCountShared.value,
      droppedFramesShared.value
    );
  }, [frameCountShared, droppedFramesShared]);

  const reset = useCallback(() => {
    latenciesRef.current = [];
    frameCountShared.value = 0;
    droppedFramesShared.value = 0;
    startTimeShared.value = 0;
  }, [startTimeShared, frameCountShared, droppedFramesShared]);

  return {
    trackGestureStart,
    trackGestureUpdate,
    trackGestureEnd,
    getLatencyMetrics,
    getMetrics,
    reset,
  };
}

/**
 * Hook for monitoring worklet execution time
 *
 * Tracks how long worklet functions take to execute.
 * Useful for identifying performance bottlenecks.
 */
export function useWorkletExecutionMonitor() {
  const executionTimes = useSharedValue<number[]>([]);
  const startTime = useSharedValue<number>(0);

  const startMeasurement = useCallback(() => {
    'worklet';
    startTime.value = performance.now();
  }, [startTime]);

  const endMeasurement = useCallback(() => {
    'worklet';
    if (startTime.value === 0) return;

    const duration = performance.now() - startTime.value;
    const times = executionTimes.value;
    times.push(duration);

    // Keep only last 50 samples
    if (times.length > 50) {
      times.shift();
    }

    executionTimes.value = times;
    startTime.value = 0;
  }, [executionTimes, startTime]);

  const getExecutionMetrics = useCallback(() => {
    const times = executionTimes.value;
    if (times.length === 0) {
      return {
        average: 0,
        max: 0,
        min: 0,
        count: 0,
      };
    }

    const sorted = [...times].sort((a, b) => a - b);
    return {
      average: times.reduce((sum, t) => sum + t, 0) / times.length,
      max: sorted[sorted.length - 1] ?? 0,
      min: sorted[0] ?? 0,
      count: times.length,
    };
  }, [executionTimes]);

  return {
    startMeasurement,
    endMeasurement,
    getExecutionMetrics,
  };
}

/**
 * Utility to measure worklet performance in development
 *
 * Usage:
 * ```ts
 * const animatedStyle = useAnimatedStyle(() => {
 *   'worklet';
 *   const start = measureWorkletStart();
 *   // ... worklet logic ...
 *   measureWorkletEnd(start, 'myWorklet');
 *   return { ... };
 * });
 * ```
 */
export function measureWorkletStart(): number {
  'worklet';
  return performance.now();
}

export function measureWorkletEnd(
  startTime: number,
  label: string = 'worklet'
): void {
  'worklet';
  if (__DEV__) {
    const duration = performance.now() - startTime;
    if (duration > 16.7) {
      // Only log if exceeds frame budget
      runOnJS(logWorkletPerformance)(duration, label);
    }
  }
}

/**
 * Log worklet performance warning (runs on JS thread)
 */
function logWorkletPerformance(duration: number, label: string): void {
  console.warn(
    `[Worklet Performance] ${label} took ${duration.toFixed(2)}ms (>16.7ms frame budget)`
  );
}

/**
 * Shared value for tracking frame drops
 */
export function useFrameDropTracker(): {
  frameDropCount: SharedValue<number>;
  totalFrames: SharedValue<number>;
  trackFrame: () => void;
  getDropPercentage: () => number;
  reset: () => void;
} {
  const frameDropCount = useSharedValue(0);
  const totalFrames = useSharedValue(0);
  const lastFrameTime = useSharedValue(0);

  const trackFrame = useCallback(() => {
    'worklet';
    const now = performance.now();

    if (lastFrameTime.value > 0) {
      const frameDuration = now - lastFrameTime.value;
      totalFrames.value += 1;

      // Frame budget is 16.7ms (60 FPS)
      if (frameDuration > 16.7) {
        frameDropCount.value += 1;
      }
    }

    lastFrameTime.value = now;
  }, [frameDropCount, totalFrames, lastFrameTime]);

  const getDropPercentage = useCallback((): number => {
    if (totalFrames.value === 0) return 0;
    return (frameDropCount.value / totalFrames.value) * 100;
  }, [frameDropCount, totalFrames]);

  const reset = useCallback(() => {
    frameDropCount.value = 0;
    totalFrames.value = 0;
    lastFrameTime.value = 0;
  }, [frameDropCount, totalFrames, lastFrameTime]);

  return {
    frameDropCount,
    totalFrames,
    trackFrame,
    getDropPercentage,
    reset,
  };
}
