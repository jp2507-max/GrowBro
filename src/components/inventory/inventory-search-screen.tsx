/**
 * Inventory Search Screen
 *
 * Complete inventory list with integrated search, filtering, and sorting.
 * Uses FlashList v2 for optimal performance with 1,000+ items.
 *
 * Requirements:
 * - 1.1: Display list of inventory items with current stock levels (<300ms, 60fps)
 * - 8.2: Filtering and grouping by category
 * - 8.5: Index item name, SKU, category, tags, brand with 150ms debounce
 * - 8.6: Instant offline results from cached index
 *
 * Performance targets:
 * - <300ms load time for 1,000+ items
 * - 60fps scrolling on mid-tier Android devices
 * - <150ms search response time
 */

import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { InventoryFilters } from '@/components/inventory/inventory-filters';
import { InventoryList } from '@/components/inventory/inventory-list';
import { InventorySearchBar } from '@/components/inventory/inventory-search-bar';
import { Modal, View } from '@/components/ui';
import { useInventorySearch } from '@/lib/inventory/use-inventory-search';

interface InventorySearchScreenProps {
  /** Callback when item is pressed */
  onItemPress?: (itemId: string) => void;

  /** Test ID for testing */
  testID?: string;
}

/**
 * Inventory search screen with filters and sorting
 */
export function InventorySearchScreen({
  onItemPress,
  testID = 'inventory-search-screen',
}: InventorySearchScreenProps): React.ReactElement {
  const { t } = useTranslation();
  const filterSheetRef = React.useRef<BottomSheetModal>(null);

  const {
    searchResults,
    isSearching,
    searchText,
    filters,
    sortOptions,
    setSearchText,
    setFilters,
    setSortOptions,
    clearSearch,
  } = useInventorySearch({
    debounceMs: 150,
    enableOfflineSearch: true,
  });

  const handleFilterPress = React.useCallback(() => {
    filterSheetRef.current?.present();
  }, []);

  const handleClearAll = React.useCallback(() => {
    clearSearch();
    filterSheetRef.current?.dismiss();
  }, [clearSearch]);

  const hasActiveFilters = React.useMemo(() => {
    return !!(filters && Object.keys(filters).length > 0) || !!sortOptions;
  }, [filters, sortOptions]);

  // Get items to display (from search results or empty)
  const displayItems = searchResults?.items || [];
  const isOffline = searchResults?.isOffline || false;

  return (
    <View className="flex-1" testID={testID}>
      {/* Search Bar */}
      <InventorySearchBar
        value={searchText}
        onChangeText={setSearchText}
        isSearching={isSearching}
        isOffline={isOffline}
        onFilterPress={handleFilterPress}
        hasActiveFilters={hasActiveFilters}
      />

      {/* Inventory List */}
      <InventoryList
        items={displayItems}
        isLoading={isSearching && displayItems.length === 0}
        error={null}
        onItemPress={onItemPress}
        testID={`${testID}-list`}
      />

      {/* Filter Bottom Sheet */}
      <Modal
        ref={filterSheetRef}
        snapPoints={['75%']}
        title={t('inventory.filters_and_sort')}
        testID={`${testID}-filter-sheet`}
      >
        <InventoryFilters
          filters={filters}
          sortOptions={sortOptions}
          onFiltersChange={setFilters}
          onSortChange={setSortOptions}
          onClearAll={handleClearAll}
        />
      </Modal>
    </View>
  );
}
