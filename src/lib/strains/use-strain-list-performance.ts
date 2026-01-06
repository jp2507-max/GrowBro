/**
 * Performance monitoring hook for strain list
 * Tracks scroll performance, blank areas, and provides monitoring lifecycle
 */

import { useCallback, useEffect } from 'react';

import { useFlashListPerformance } from './use-flashlist-performance';

interface UseStrainListPerformanceOptions {
  listSize: number;
  enabled?: boolean;
}

interface UseStrainListPerformanceReturn {
  handleScroll: () => void;
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
  };
}
