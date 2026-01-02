import { useEffect, useRef } from 'react';

import type { useAnalytics } from '@/lib';

export type StrainListState = {
  strains: { length: number };
  isOffline: boolean;
  isUsingCache: boolean;
  isLoading: boolean;
  isError: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
};

export type StrainSearchAnalyticsParams = {
  analytics: ReturnType<typeof useAnalytics>;
  debouncedQuery: string;
  listState: StrainListState | null;
  resolvedOffline: boolean;
  hasAnalyticsConsent: boolean;
};

/**
 * Tracks strain search analytics when search results settle.
 * Only fires when loading completes and payload differs from last tracked.
 */
export function useStrainSearchAnalytics(
  params: StrainSearchAnalyticsParams
): void {
  const {
    analytics,
    debouncedQuery,
    listState,
    resolvedOffline,
    hasAnalyticsConsent,
  } = params;

  const lastRef = useRef<{
    query: string;
    isOffline: boolean;
    hasAnalyticsConsent: boolean;
  } | null>(null);

  useEffect(() => {
    if (!listState || listState.isLoading || listState.isFetchingNextPage)
      return;

    const payload = {
      query: debouncedQuery,
      isOffline: resolvedOffline,
      hasAnalyticsConsent,
    };

    const last = lastRef.current;
    if (
      last &&
      last.query === payload.query &&
      last.isOffline === payload.isOffline &&
      last.hasAnalyticsConsent === payload.hasAnalyticsConsent
    )
      return;

    lastRef.current = payload;

    if (hasAnalyticsConsent) {
      void analytics.track('strain_search', {
        query: debouncedQuery,
        results_count: listState.strains.length,
        is_offline: resolvedOffline,
      });
    }
  }, [
    analytics,
    debouncedQuery,
    hasAnalyticsConsent,
    listState,
    resolvedOffline,
  ]);
}
