/**
 * Hook for tracking strain-related analytics
 */

import { useEffect, useRef } from 'react';

import { useAnalytics } from '@/lib/use-analytics';

import {
  trackStrainDetailViewed,
  trackStrainListScrolled,
  trackStrainOfflineUsage,
} from './strains-analytics';

/**
 * Track strain detail page view
 */
export function useTrackStrainDetailView(params: {
  strainId: string;
  strainName?: string;
  race?: string;
  source: 'list' | 'search' | 'favorites' | 'deep_link';
  isOffline: boolean;
  enabled?: boolean;
}): void {
  const analytics = useAnalytics();
  const tracked = useRef<string | null>(null);

  useEffect(() => {
    if (params.enabled === false || tracked.current === params.strainId) {
      return;
    }

    tracked.current = params.strainId;

    trackStrainDetailViewed(analytics, {
      strainId: params.strainId,
      strainName: params.strainName,
      race: params.race,
      source: params.source,
      isOffline: params.isOffline,
    });
  }, [
    analytics,
    params.strainId,
    params.strainName,
    params.race,
    params.source,
    params.isOffline,
    params.enabled,
  ]);
}

/**
 * Track strain list scrolling/pagination
 */
export function useTrackStrainListScroll(): {
  trackScroll: (
    pageNumber: number,
    totalItemsLoaded: number,
    isOffline: boolean
  ) => void;
} {
  const analytics = useAnalytics();
  const lastTrackedPage = useRef(-1);

  const trackScroll = (
    pageNumber: number,
    totalItemsLoaded: number,
    isOffline: boolean
  ): void => {
    // Only track each page once
    if (pageNumber === lastTrackedPage.current) {
      return;
    }

    lastTrackedPage.current = pageNumber;

    trackStrainListScrolled(analytics, {
      pageNumber,
      totalItemsLoaded,
      isOffline,
    });
  };

  return { trackScroll };
}

/**
 * Track offline usage patterns
 */
export function useTrackStrainOfflineUsage(): {
  trackOfflineUsage: (
    action: 'browse' | 'search' | 'view_detail' | 'manage_favorites',
    cachedPagesAvailable: number
  ) => void;
} {
  const analytics = useAnalytics();

  const trackOfflineUsage = (
    action: 'browse' | 'search' | 'view_detail' | 'manage_favorites',
    cachedPagesAvailable: number
  ): void => {
    trackStrainOfflineUsage(analytics, {
      action,
      cachedPagesAvailable,
    });
  };

  return { trackOfflineUsage };
}
