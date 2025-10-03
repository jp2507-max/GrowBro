/**
 * Analytics tracking utilities for strains feature
 * Provides type-safe wrappers for tracking user interactions
 */

import type { StrainFilters } from '@/api/strains/types';
import type { AnalyticsClient } from '@/lib/analytics';

/**
 * Track strain search with filters and results
 */
export function trackStrainSearch(
  analytics: AnalyticsClient,
  params: {
    query?: string;
    resultsCount: number;
    filters?: StrainFilters;
    sortBy?: string;
    isOffline: boolean;
    responseTimeMs?: number;
  }
): void {
  const filtersApplied: string[] = [];

  if (params.filters) {
    if (params.filters.race) filtersApplied.push('race');
    if (params.filters.effects?.length) filtersApplied.push('effects');
    if (params.filters.flavors?.length) filtersApplied.push('flavors');
    if (params.filters.difficulty) filtersApplied.push('difficulty');
    if (
      params.filters.thcMin !== undefined ||
      params.filters.thcMax !== undefined
    ) {
      filtersApplied.push('thc');
    }
    if (
      params.filters.cbdMin !== undefined ||
      params.filters.cbdMax !== undefined
    ) {
      filtersApplied.push('cbd');
    }
  }

  analytics.track('strain_search', {
    query: params.query,
    results_count: params.resultsCount,
    filters_applied: filtersApplied.length > 0 ? filtersApplied : undefined,
    sort_by: params.sortBy,
    is_offline: params.isOffline,
    response_time_ms: params.responseTimeMs,
  });
}

/**
 * Track filter application
 */
export function trackStrainFilterApplied(
  analytics: AnalyticsClient,
  params: {
    filterType: 'race' | 'effects' | 'flavors' | 'difficulty' | 'thc' | 'cbd';
    filterValue: string;
    resultsCount: number;
  }
): void {
  analytics.track('strain_filter_applied', {
    filter_type: params.filterType,
    filter_value: params.filterValue,
    results_count: params.resultsCount,
  });
}

/**
 * Track sort change
 */
export function trackStrainSortChanged(
  analytics: AnalyticsClient,
  params: {
    sortBy: 'thc' | 'cbd' | 'popularity' | 'name';
    sortDirection: 'asc' | 'desc';
  }
): void {
  analytics.track('strain_sort_changed', {
    sort_by: params.sortBy,
    sort_direction: params.sortDirection,
  });
}

/**
 * Track strain detail page view
 */
export function trackStrainDetailViewed(
  analytics: AnalyticsClient,
  params: {
    strainId: string;
    strainName?: string;
    race?: string;
    source: 'list' | 'search' | 'favorites' | 'deep_link';
    isOffline: boolean;
  }
): void {
  analytics.track('strain_detail_viewed', {
    strain_id: params.strainId,
    strain_name: params.strainName,
    race: params.race,
    source: params.source,
    is_offline: params.isOffline,
  });
}

/**
 * Track favorite added
 */
export function trackStrainFavoriteAdded(
  analytics: AnalyticsClient,
  params: {
    strainId: string;
    source: 'detail' | 'list';
    totalFavorites: number;
  }
): void {
  analytics.track('strain_favorite_added', {
    strain_id: params.strainId,
    source: params.source,
    total_favorites: params.totalFavorites,
  });
}

/**
 * Track favorite removed
 */
export function trackStrainFavoriteRemoved(
  analytics: AnalyticsClient,
  params: {
    strainId: string;
    source: 'detail' | 'list' | 'favorites_screen';
    totalFavorites: number;
  }
): void {
  analytics.track('strain_favorite_removed', {
    strain_id: params.strainId,
    source: params.source,
    total_favorites: params.totalFavorites,
  });
}

/**
 * Track list scrolling/pagination
 */
export function trackStrainListScrolled(
  analytics: AnalyticsClient,
  params: {
    pageNumber: number;
    totalItemsLoaded: number;
    isOffline: boolean;
  }
): void {
  analytics.track('strain_list_scrolled', {
    page_number: params.pageNumber,
    total_items_loaded: params.totalItemsLoaded,
    is_offline: params.isOffline,
  });
}

/**
 * Track offline usage patterns
 */
export function trackStrainOfflineUsage(
  analytics: AnalyticsClient,
  params: {
    action: 'browse' | 'search' | 'view_detail' | 'manage_favorites';
    cachedPagesAvailable: number;
  }
): void {
  analytics.track('strain_offline_usage', {
    action: params.action,
    cached_pages_available: params.cachedPagesAvailable,
  });
}
