/**
 * Performance monitoring hook for strain list
 * Tracks scroll performance, blank areas, and provides monitoring lifecycle
 */

import { useCallback, useEffect, useRef } from 'react';

import { useFlashListPerformance } from './use-flashlist-performance';

interface UseStrainListPerformanceOptions {
  listSize: number;
  enabled?: boolean;
}

interface UseStrainListPerformanceReturn {
  handleScroll: () => void;
  onBlankArea: (event: {
    offsetStart: number;
    offsetEnd: number;
    blankArea: number;
  }) => void;
}

/**
 * Hook to manage performance tracking and monitoring for strain lists
 */
export function useStrainListPerformance({
  listSize,
  enabled = __DEV__ || process.env.NODE_ENV === 'production',
}: UseStrainListPerformanceOptions): UseStrainListPerformanceReturn {
  const {
    onScroll: onPerfScroll,
    startTracking,
    stopTracking,
  } = useFlashListPerformance({
    listSize,
    enabled,
  });

  // Track blank areas during scroll for performance debugging
  const blankAreaRef = useRef<{ cumulative: number; max: number }>({
    cumulative: 0,
    max: 0,
  });

  const onBlankArea = useCallback(
    (event: { offsetStart: number; offsetEnd: number; blankArea: number }) => {
      // Track cumulative and max blank area for analytics
      blankAreaRef.current.cumulative += event.blankArea;
      blankAreaRef.current.max = Math.max(
        blankAreaRef.current.max,
        event.blankArea
      );

      // Log significant blank areas in dev mode for debugging
      if (__DEV__ && event.blankArea > 100) {
        console.debug('[FlashList] Blank area detected:', {
          blankArea: event.blankArea,
          offsetStart: event.offsetStart,
          offsetEnd: event.offsetEnd,
        });
      }
    },
    []
  );

  // Start/stop performance tracking based on list visibility
  useEffect(() => {
    if (listSize > 0) {
      startTracking();
    }
    return () => {
      stopTracking();
    };
  }, [listSize, startTracking, stopTracking]);

  const handleScroll = useCallback(() => {
    onPerfScroll();
  }, [onPerfScroll]);

  return {
    handleScroll,
    onBlankArea,
  };
}
