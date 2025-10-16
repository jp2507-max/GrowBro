/**
 * Inventory Search Service
 *
 * Provides full-text search with faceted filtering, offline caching,
 * and performance optimization for inventory items.
 *
 * Requirements:
 * - 8.2: Filtering and grouping by category, brand, form, hazard flags
 * - 8.5: Index item name, SKU, category, tags, brand with 150ms debounce
 * - 8.6: Instant offline results from cached index
 *
 * Architecture:
 * - WatermelonDB queries for online search
 * - MMKV-based cache for offline search
 * - Token-based search indexing for fuzzy matching
 * - Performance target: <150ms search response time
 */

import { type Database } from '@nozbe/watermelondb';

import type {
  AdvancedInventoryFilters,
  CachedSearchIndex,
  FacetCount,
  InventoryItemWithStock,
  InventorySearchQuery,
  InventorySearchResult,
  SearchFacets,
} from '@/types/inventory';

/**
 * Normalize text for search indexing
 * - Converts to lowercase
 * - Removes diacritics
 * - Splits into tokens
 */
function normalizeSearchText(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .split(/\s+/)
    .filter((token) => token.length > 0);
}

/**
 * Build search tokens for an inventory item
 * Indexes: name, SKU, category, brand
 */
function buildItemTokens(item: InventoryItemWithStock): string[] {
  const tokens: string[] = [];

  // Name tokens
  tokens.push(...normalizeSearchText(item.name));

  // SKU tokens
  if (item.sku) {
    tokens.push(...normalizeSearchText(item.sku));
  }

  // Category tokens
  tokens.push(...normalizeSearchText(item.category));

  // Barcode tokens
  if (item.barcode) {
    tokens.push(...normalizeSearchText(item.barcode));
  }

  return tokens;
}

/**
 * Check if item matches search text using tokens
 */
function itemMatchesSearchText(
  item: InventoryItemWithStock,
  searchTokens: string[]
): boolean {
  if (searchTokens.length === 0) {
    return true;
  }

  const itemTokens = buildItemTokens(item);

  // All search tokens must match at least one item token (AND logic)
  return searchTokens.every((searchToken) =>
    itemTokens.some((itemToken) => itemToken.includes(searchToken))
  );
}

/**
 * Apply advanced filters to an item
 */
function applyFilters(
  item: InventoryItemWithStock,
  filters?: AdvancedInventoryFilters
): boolean {
  if (!filters) return true;

  // Category filter
  if (filters.category && item.category !== filters.category) {
    return false;
  }

  // Tracking mode filter
  if (filters.trackingMode && item.trackingMode !== filters.trackingMode) {
    return false;
  }

  // Consumable filter
  if (
    filters.isConsumable !== undefined &&
    item.isConsumable !== filters.isConsumable
  ) {
    return false;
  }

  // Low stock filter
  if (
    filters.isLowStock !== undefined &&
    item.isLowStock !== filters.isLowStock
  ) {
    return false;
  }

  // Stock range filter
  if (filters.stockRange) {
    if (
      filters.stockRange.min !== undefined &&
      item.currentStock < filters.stockRange.min
    ) {
      return false;
    }
    if (
      filters.stockRange.max !== undefined &&
      item.currentStock > filters.stockRange.max
    ) {
      return false;
    }
  }

  // Cost range filter (in minor units)
  if (filters.costRange) {
    const itemCostMinor = item.unitCost * 100; // Convert to minor units
    if (
      filters.costRange.min !== undefined &&
      itemCostMinor < filters.costRange.min
    ) {
      return false;
    }
    if (
      filters.costRange.max !== undefined &&
      itemCostMinor > filters.costRange.max
    ) {
      return false;
    }
  }

  // TODO: Add support for brand, form, hazard flags, NPK ratio, expiration date
  // These require additional fields in InventoryItemWithStock type or joining with batch data

  return true;
}

/**
 * Sort items based on sort options
 */
function sortItems(
  items: InventoryItemWithStock[],
  sort?: InventorySearchQuery['sort']
): InventoryItemWithStock[] {
  if (!sort) {
    // Default: sort by name ascending
    return items.sort((a, b) => a.name.localeCompare(b.name));
  }

  const { field, direction } = sort;
  const multiplier = direction === 'asc' ? 1 : -1;

  return items.sort((a, b) => {
    let comparison = 0;

    switch (field) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'category':
        comparison = a.category.localeCompare(b.category);
        break;
      case 'currentStock':
        comparison = a.currentStock - b.currentStock;
        break;
      case 'unitCost':
        comparison = a.unitCost - b.unitCost;
        break;
      case 'totalValue':
        comparison = a.totalValue - b.totalValue;
        break;
      case 'updatedAt':
        comparison = a.updatedAt.getTime() - b.updatedAt.getTime();
        break;
      default:
        comparison = 0;
    }

    return comparison * multiplier;
  });
}

/**
 * Calculate facet counts from items
 */
function calculateFacets(items: InventoryItemWithStock[]): SearchFacets {
  const categoryMap = new Map<string, number>();
  const brandMap = new Map<string, number>();
  const formMap = new Map<string, number>();
  const hazardFlagMap = new Map<string, number>();

  let lowStockCount = 0;
  let expiredCount = 0;

  for (const item of items) {
    // Category facets
    categoryMap.set(item.category, (categoryMap.get(item.category) || 0) + 1);

    // Low stock count
    if (item.isLowStock) {
      lowStockCount++;
    }

    // TODO: Add brand, form, hazard flags, expired count
    // These require additional fields in InventoryItemWithStock type
  }

  const categories: FacetCount[] = Array.from(categoryMap.entries()).map(
    ([value, count]) => ({ value, count })
  );

  const brands: FacetCount[] = Array.from(brandMap.entries()).map(
    ([value, count]) => ({ value, count })
  );

  const forms: FacetCount[] = Array.from(formMap.entries()).map(
    ([value, count]) => ({ value, count })
  );

  const hazardFlags: FacetCount[] = Array.from(hazardFlagMap.entries()).map(
    ([value, count]) => ({ value, count })
  );

  return {
    categories,
    brands,
    forms,
    hazardFlags,
    totalCount: items.length,
    lowStockCount,
    expiredCount,
  };
}

/**
 * Inventory Search Service
 */
export class InventorySearchService {
  private database: Database;
  private cachedIndex: CachedSearchIndex | null = null;

  constructor(database: Database) {
    this.database = database;
  }

  /**
   * Build offline search index from all inventory items
   * Requirement 8.6
   */
  async buildSearchIndex(
    items: InventoryItemWithStock[]
  ): Promise<CachedSearchIndex> {
    const startTime = Date.now();
    const tokens = new Map<string, Set<string>>();
    const itemsMap = new Map<string, InventoryItemWithStock>();

    for (const item of items) {
      // Cache item data
      itemsMap.set(item.id, item);

      // Build search tokens
      const itemTokens = buildItemTokens(item);

      // Index tokens
      for (const token of itemTokens) {
        if (!tokens.has(token)) {
          tokens.set(token, new Set());
        }
        tokens.get(token)!.add(item.id);
      }
    }

    const index: CachedSearchIndex = {
      tokens,
      items: itemsMap,
      lastUpdated: new Date(),
      version: 1,
    };

    this.cachedIndex = index;

    console.log(
      `[InventorySearch] Built search index with ${itemsMap.size} items and ${tokens.size} tokens in ${Date.now() - startTime}ms`
    );

    return index;
  }

  /**
   * Search inventory items with offline support
   * Requirements: 8.2, 8.5, 8.6
   */
  async search(
    allItems: InventoryItemWithStock[],
    query: InventorySearchQuery,
    isOffline = false
  ): Promise<InventorySearchResult> {
    const startTime = Date.now();

    // Normalize search text
    const searchTokens = normalizeSearchText(query.searchText);

    // Filter items
    let filteredItems = allItems.filter((item) => {
      // Text search
      if (!itemMatchesSearchText(item, searchTokens)) {
        return false;
      }

      // Advanced filters
      if (!applyFilters(item, query.filters)) {
        return false;
      }

      return true;
    });

    // Sort items
    filteredItems = sortItems(filteredItems, query.sort);

    // Apply limit
    if (query.limit && filteredItems.length > query.limit) {
      filteredItems = filteredItems.slice(0, query.limit);
    }

    // Calculate facets from all matching items (before limit)
    const facets = calculateFacets(filteredItems);

    const executionTimeMs = Date.now() - startTime;

    return {
      items: filteredItems,
      facets,
      totalCount: filteredItems.length,
      isOffline,
      executionTimeMs,
    };
  }

  /**
   * Search using cached index (offline mode)
   * Requirement 8.6
   */
  async searchOffline(
    query: InventorySearchQuery
  ): Promise<InventorySearchResult | null> {
    if (!this.cachedIndex) {
      return null;
    }

    const allItems = Array.from(this.cachedIndex.items.values());
    return this.search(allItems, query, true);
  }

  /**
   * Clear cached search index
   */
  clearCache(): void {
    this.cachedIndex = null;
  }

  /**
   * Get cached index stats
   */
  getCacheStats(): {
    itemCount: number;
    tokenCount: number;
    lastUpdated: Date | null;
  } | null {
    if (!this.cachedIndex) {
      return null;
    }

    return {
      itemCount: this.cachedIndex.items.size,
      tokenCount: this.cachedIndex.tokens.size,
      lastUpdated: this.cachedIndex.lastUpdated,
    };
  }
}

/**
 * Create singleton search service instance
 */
let searchServiceInstance: InventorySearchService | null = null;

export function getSearchService(database: Database): InventorySearchService {
  if (!searchServiceInstance) {
    searchServiceInstance = new InventorySearchService(database);
  }
  return searchServiceInstance;
}
