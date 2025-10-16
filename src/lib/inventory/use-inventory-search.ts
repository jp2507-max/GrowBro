/**
 * Inventory Search Hook
 *
 * React hook for searching and filtering inventory items with offline support.
 * Implements 150ms debouncing, facet counting, and cached search index.
 *
 * Requirements:
 * - 8.2: Filtering and grouping by category, brand, form, hazard flags
 * - 8.5: Index item name, SKU, category, tags, brand with 150ms debounce
 * - 8.6: Instant offline results from cached index
 *
 * Usage:
 * ```tsx
 * const {
 *   searchResults,
 *   isSearching,
 *   setSearchText,
 *   setFilters,
 *   setSortOptions,
 *   clearSearch
 * } = useInventorySearch();
 * ```
 */

import { useDatabase } from '@nozbe/watermelondb/react';
import React from 'react';

import { getSearchService } from '@/lib/inventory/search-service';
import { useInventoryItems } from '@/lib/inventory/use-inventory-items';
import type {
  AdvancedInventoryFilters,
  InventorySearchQuery,
  InventorySearchResult,
  InventorySortOptions,
} from '@/types/inventory';

interface UseInventorySearchOptions {
  /** Debounce delay in milliseconds (default: 150ms) */
  debounceMs?: number;

  /** Whether to enable offline search (default: true) */
  enableOfflineSearch?: boolean;

  /** Maximum number of results (default: unlimited) */
  limit?: number;
}

interface UseInventorySearchResult {
  /** Current search results */
  searchResults: InventorySearchResult | null;

  /** Whether search is in progress */
  isSearching: boolean;

  /** Current search text */
  searchText: string;

  /** Current filters */
  filters: AdvancedInventoryFilters | undefined;

  /** Current sort options */
  sortOptions: InventorySortOptions | undefined;

  /** Set search text (debounced) */
  setSearchText: (text: string) => void;

  /** Set filters */
  setFilters: (filters: AdvancedInventoryFilters | undefined) => void;

  /** Set sort options */
  setSortOptions: (sort: InventorySortOptions | undefined) => void;

  /** Clear all search state */
  clearSearch: () => void;

  /** Rebuild offline search index */
  rebuildSearchIndex: () => Promise<void>;

  /** Get cache statistics */
  getCacheStats: () => {
    itemCount: number;
    tokenCount: number;
    lastUpdated: Date | null;
  } | null;
}

/**
 * Hook for inventory search with offline support
 */
// eslint-disable-next-line max-lines-per-function -- Complex hook with multiple state and effects
export function useInventorySearch(
  options: UseInventorySearchOptions = {}
): UseInventorySearchResult {
  const { debounceMs = 150, enableOfflineSearch = true, limit } = options;

  const database = useDatabase();
  const searchService = React.useMemo(
    () => getSearchService(database),
    [database]
  );

  // Get all inventory items for searching
  const { items: allItems, isLoading: isLoadingItems } = useInventoryItems();

  // Search state
  const [searchText, setSearchTextState] = React.useState('');
  const [debouncedSearchText, setDebouncedSearchText] = React.useState('');
  const [filters, setFilters] = React.useState<
    AdvancedInventoryFilters | undefined
  >();
  const [sortOptions, setSortOptions] = React.useState<
    InventorySortOptions | undefined
  >();
  const [searchResults, setSearchResults] =
    React.useState<InventorySearchResult | null>(null);
  const [isSearching, setIsSearching] = React.useState(false);

  // Debounce search text
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearchText(searchText);
    }, debounceMs);

    return () => clearTimeout(timeoutId);
  }, [searchText, debounceMs]);

  // Build search index when items load
  React.useEffect(() => {
    if (!isLoadingItems && allItems.length > 0 && enableOfflineSearch) {
      searchService.buildSearchIndex(allItems);
    }
  }, [allItems, isLoadingItems, enableOfflineSearch, searchService]);

  // Perform search when query changes
  React.useEffect(() => {
    const performSearch = async () => {
      // If no search text and no filters, show all items sorted
      if (!debouncedSearchText && !filters) {
        const query: InventorySearchQuery = {
          searchText: '',
          filters,
          sort: sortOptions,
          limit,
        };

        const result = await searchService.search(allItems, query, false);
        setSearchResults(result);
        return;
      }

      setIsSearching(true);

      try {
        const query: InventorySearchQuery = {
          searchText: debouncedSearchText,
          filters,
          sort: sortOptions,
          limit,
        };

        // Try offline search first if enabled
        let result: InventorySearchResult | null = null;

        if (enableOfflineSearch) {
          result = await searchService.searchOffline(query);
        }

        // Fall back to online search
        if (!result) {
          result = await searchService.search(allItems, query, false);
        }

        setSearchResults(result);
      } catch (error) {
        console.error('[InventorySearch] Search failed:', error);
        setSearchResults(null);
      } finally {
        setIsSearching(false);
      }
    };

    performSearch();
  }, [
    debouncedSearchText,
    filters,
    sortOptions,
    limit,
    allItems,
    enableOfflineSearch,
    searchService,
  ]);

  // Set search text with debouncing indicator
  const setSearchText = React.useCallback((text: string) => {
    setSearchTextState(text);
    setIsSearching(true);
  }, []);

  // Clear search state
  const clearSearch = React.useCallback(() => {
    setSearchTextState('');
    setDebouncedSearchText('');
    setFilters(undefined);
    setSortOptions(undefined);
    setSearchResults(null);
  }, []);

  // Rebuild search index
  const rebuildSearchIndex = React.useCallback(async () => {
    if (allItems.length > 0) {
      await searchService.buildSearchIndex(allItems);
    }
  }, [allItems, searchService]);

  // Get cache stats
  const getCacheStats = React.useCallback(() => {
    return searchService.getCacheStats();
  }, [searchService]);

  return {
    searchResults,
    isSearching,
    searchText,
    filters,
    sortOptions,
    setSearchText,
    setFilters,
    setSortOptions,
    clearSearch,
    rebuildSearchIndex,
    getCacheStats,
  };
}
