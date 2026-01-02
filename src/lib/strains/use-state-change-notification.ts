/**
 * Hook to manage state change notifications
 */

import { useEffect, useMemo, useRef } from 'react';

import type { Strain } from '@/api';

interface StateSnapshot {
  length: number;
  isOffline: boolean;
  isUsingCache: boolean;
  isLoading: boolean;
  isError: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
}

interface UseStateChangeNotificationOptions {
  strains: Strain[];
  isOffline: boolean;
  isUsingCache: boolean;
  isLoading: boolean;
  isError: boolean;
  isFetchingNextPage: boolean;
  hasNextPage?: boolean;
  onStateChange?: (state: {
    strains: Strain[];
    isOffline: boolean;
    isUsingCache: boolean;
    isLoading: boolean;
    isError: boolean;
    isFetchingNextPage: boolean;
    hasNextPage: boolean;
  }) => void;
}

/**
 * Manages state change notifications to parent component
 * Only notifies when state actually changes to prevent unnecessary re-renders
 */
export function useStateChangeNotification({
  strains,
  isOffline,
  isUsingCache,
  isLoading,
  isError,
  isFetchingNextPage,
  hasNextPage,
  onStateChange,
}: UseStateChangeNotificationOptions): void {
  const stateSnapshot = useMemo(
    () => ({
      length: strains.length,
      isOffline,
      isUsingCache,
      isLoading,
      isError,
      isFetchingNextPage,
      hasNextPage: Boolean(hasNextPage),
    }),
    [
      strains.length,
      isOffline,
      isUsingCache,
      isLoading,
      isError,
      isFetchingNextPage,
      hasNextPage,
    ]
  );

  const lastStateRef = useRef<StateSnapshot | null>(null);

  useEffect(() => {
    if (!onStateChange) return;

    const last = lastStateRef.current;
    const changed =
      !last ||
      last.length !== stateSnapshot.length ||
      last.isOffline !== stateSnapshot.isOffline ||
      last.isUsingCache !== stateSnapshot.isUsingCache ||
      last.isLoading !== stateSnapshot.isLoading ||
      last.isError !== stateSnapshot.isError ||
      last.isFetchingNextPage !== stateSnapshot.isFetchingNextPage ||
      last.hasNextPage !== stateSnapshot.hasNextPage;

    if (changed) {
      lastStateRef.current = stateSnapshot;
      onStateChange({
        strains,
        isOffline: stateSnapshot.isOffline,
        isUsingCache: stateSnapshot.isUsingCache,
        isLoading: stateSnapshot.isLoading,
        isError: stateSnapshot.isError,
        isFetchingNextPage: stateSnapshot.isFetchingNextPage,
        hasNextPage: stateSnapshot.hasNextPage,
      });
    }
  }, [onStateChange, stateSnapshot, strains]);
}
