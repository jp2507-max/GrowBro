/**
 * Hook to persist and restore scroll position for strains list
 */

import { useEffect, useRef } from 'react';

import { storage } from '@/lib/storage';

interface ScrollPosition {
  offset: number;
  index?: number; // Store visible index for more accurate restoration
  timestamp: number;
}

const SCROLL_POSITION_KEY = 'strains_scroll_position';
const SCROLL_POSITION_TTL = 30 * 60 * 1000; // 30 minutes

function cleanupOldPositions() {
  const allKeys = storage.getAllKeys();
  const now = Date.now();

  for (const key of allKeys) {
    if (key.startsWith(SCROLL_POSITION_KEY)) {
      try {
        const value = storage.getString(key);
        if (value) {
          const position: ScrollPosition = JSON.parse(value);
          if (now - position.timestamp > SCROLL_POSITION_TTL) {
            storage.delete(key);
          }
        }
      } catch {
        storage.delete(key);
      }
    }
  }
}

export function useScrollPosition(queryKey: string) {
  const scrollOffsetRef = useRef(0);
  const hasRestoredRef = useRef(false);
  const storageKey = `${SCROLL_POSITION_KEY}_${queryKey}`;

  const saveScrollPosition = (offset: number, index?: number) => {
    scrollOffsetRef.current = offset;
    try {
      storage.set(
        storageKey,
        JSON.stringify({ offset, index, timestamp: Date.now() })
      );
    } catch (error) {
      console.warn('[useScrollPosition] Failed to save:', error);
    }
  };

  const getSavedScrollPosition = (): number | null => {
    try {
      const saved = storage.getString(storageKey);
      if (!saved) return null;
      const position: ScrollPosition = JSON.parse(saved);
      if (Date.now() - position.timestamp > SCROLL_POSITION_TTL) {
        storage.delete(storageKey);
        return null;
      }
      return position.offset;
    } catch (error) {
      console.warn('[useScrollPosition] Failed to get:', error);
      return null;
    }
  };

  const getSavedScrollIndex = (): number | null => {
    try {
      const saved = storage.getString(storageKey);
      if (!saved) return null;
      const position: ScrollPosition = JSON.parse(saved);
      if (Date.now() - position.timestamp > SCROLL_POSITION_TTL) {
        return null;
      }
      return position.index ?? null;
    } catch (error) {
      console.warn('[useScrollPosition] Failed to get index:', error);
      return null;
    }
  };

  const clearScrollPosition = () => {
    try {
      storage.delete(storageKey);
      scrollOffsetRef.current = 0;
      hasRestoredRef.current = false;
    } catch (error) {
      console.warn('[useScrollPosition] Failed to clear:', error);
    }
  };

  const getInitialScrollOffset = (): number => {
    if (hasRestoredRef.current) return scrollOffsetRef.current;
    const saved = getSavedScrollPosition();
    if (saved !== null) {
      hasRestoredRef.current = true;
      scrollOffsetRef.current = saved;
      return saved;
    }
    return 0;
  };

  useEffect(() => {
    cleanupOldPositions();
  }, []);

  return {
    saveScrollPosition,
    getSavedScrollPosition,
    getSavedScrollIndex,
    clearScrollPosition,
    getInitialScrollOffset,
    currentOffset: scrollOffsetRef.current,
  };
}
