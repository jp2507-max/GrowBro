/**
 * Hook to manage scroll position restoration
 */

import { useEffect, useRef } from 'react';

import { useScrollPosition } from './use-scroll-position';

interface UseScrollRestorationOptions {
  queryKey: string;
  strainsLength: number;
  defaultItemHeight: number;
}

/**
 * Manages scroll position restoration for strain lists
 * Restores scroll position based on saved index or offset
 */
export function useScrollRestoration({
  queryKey,
  strainsLength,
  defaultItemHeight,
}: UseScrollRestorationOptions) {
  const { getInitialScrollOffset, getSavedScrollIndex } =
    useScrollPosition(queryKey);
  const initialScrollIndexRef = useRef<number | null>(null);

  useEffect(() => {
    if (strainsLength > 0 && !initialScrollIndexRef.current) {
      const savedIndex = getSavedScrollIndex();
      if (savedIndex !== null && savedIndex >= 0) {
        initialScrollIndexRef.current = Math.min(savedIndex, strainsLength - 1);
      } else {
        const savedOffset = getInitialScrollOffset();
        if (savedOffset > 0) {
          initialScrollIndexRef.current = Math.min(
            Math.floor(savedOffset / defaultItemHeight),
            strainsLength - 1
          );
        }
      }
    }
  }, [
    strainsLength,
    getInitialScrollOffset,
    getSavedScrollIndex,
    defaultItemHeight,
  ]);

  return { initialScrollIndexRef };
}
