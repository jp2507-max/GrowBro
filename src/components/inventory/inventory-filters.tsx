/**
 * Inventory Filters Component
 *
 * Combined filter and sort panel for inventory items.
 * Provides category filtering, stock level filters, and sorting options.
 *
 * Requirements:
 * - 8.2: Filtering and grouping by category, brand, form, hazard flags
 * - 8.5: Index item name, SKU, category, tags, brand
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView } from 'react-native';

import { Text, View } from '@/components/ui';
import type {
  AdvancedInventoryFilters,
  InventoryCategory,
  InventorySortField,
  InventorySortOptions,
  SortDirection,
} from '@/types/inventory';

interface InventoryFiltersProps {
  /** Current filters */
  filters?: AdvancedInventoryFilters;

  /** Current sort options */
  sortOptions?: InventorySortOptions;

  /** Callback when filters change */
  onFiltersChange: (filters: AdvancedInventoryFilters | undefined) => void;

  /** Callback when sort options change */
  onSortChange: (sort: InventorySortOptions | undefined) => void;

  /** Callback when clear all is pressed */
  onClearAll: () => void;

  /** Test ID for testing */
  testID?: string;
}

const CATEGORIES: InventoryCategory[] = [
  'Nutrients',
  'Seeds',
  'Growing Media',
  'Tools',
  'Containers',
  'Amendments',
];

const SORT_FIELDS: { value: InventorySortField; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'category', label: 'Category' },
  { value: 'currentStock', label: 'Stock Level' },
  { value: 'unitCost', label: 'Cost' },
  { value: 'totalValue', label: 'Total Value' },
  { value: 'updatedAt', label: 'Last Updated' },
];

/**
 * Filter chip component
 */
function FilterChip({
  label,
  isActive,
  onPress,
  testID,
}: {
  label: string;
  isActive: boolean;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
      testID={testID}
      className={`rounded-full border px-4 py-2 ${
        isActive
          ? 'border-primary-600 bg-primary-600'
          : 'border-neutral-300 bg-white dark:border-neutral-600 dark:bg-charcoal-900'
      }`}
    >
      <Text
        className={`text-sm font-medium ${
          isActive ? 'text-white' : 'text-charcoal-950 dark:text-white'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Inventory filters panel
 */
// eslint-disable-next-line max-lines-per-function -- Complex filter UI with multiple sections
export function InventoryFilters({
  filters,
  sortOptions,
  onFiltersChange,
  onSortChange,
  onClearAll,
  testID = 'inventory-filters',
}: InventoryFiltersProps): React.ReactElement {
  const { t } = useTranslation();

  const handleCategoryToggle = React.useCallback(
    (category: InventoryCategory) => {
      const newFilters = {
        ...filters,
        category: filters?.category === category ? undefined : category,
      };
      onFiltersChange(
        Object.keys(newFilters).length > 0 ? newFilters : undefined
      );
    },
    [filters, onFiltersChange]
  );

  const handleLowStockToggle = React.useCallback(() => {
    const newFilters = {
      ...filters,
      isLowStock: filters?.isLowStock ? undefined : true,
    };
    onFiltersChange(
      Object.keys(newFilters).length > 0 ? newFilters : undefined
    );
  }, [filters, onFiltersChange]);

  const handleSortFieldChange = React.useCallback(
    (field: InventorySortField) => {
      if (sortOptions?.field === field) {
        // Toggle direction
        const newDirection: SortDirection =
          sortOptions.direction === 'asc' ? 'desc' : 'asc';
        onSortChange({ field, direction: newDirection });
      } else {
        onSortChange({ field, direction: 'asc' });
      }
    },
    [sortOptions, onSortChange]
  );

  const hasActiveFilters = React.useMemo(() => {
    return !!(filters && Object.keys(filters).length > 0);
  }, [filters]);

  return (
    <ScrollView
      className="bg-white dark:bg-charcoal-900"
      testID={testID}
      contentContainerClassName="p-4 gap-4"
    >
      {/* Header */}
      <View className="flex-row items-center justify-between">
        <Text className="text-lg font-semibold text-charcoal-950 dark:text-white">
          {t('inventory.filters_and_sort')}
        </Text>
        {hasActiveFilters && (
          <Pressable
            onPress={onClearAll}
            accessibilityRole="button"
            testID={`${testID}-clear-all`}
          >
            <Text className="text-sm font-medium text-primary-600 dark:text-primary-400">
              {t('common.clear_all')}
            </Text>
          </Pressable>
        )}
      </View>

      {/* Category Filters */}
      <View>
        <Text className="mb-2 text-sm font-medium text-charcoal-950 dark:text-white">
          {t('inventory.category')}
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {CATEGORIES.map((category) => (
            <FilterChip
              key={category}
              label={category}
              isActive={filters?.category === category}
              onPress={() => handleCategoryToggle(category)}
              testID={`${testID}-category-${category.toLowerCase().replace(' ', '-')}`}
            />
          ))}
        </View>
      </View>

      {/* Stock Level Filters */}
      <View>
        <Text className="mb-2 text-sm font-medium text-charcoal-950 dark:text-white">
          {t('inventory.stock_level')}
        </Text>
        <View className="flex-row flex-wrap gap-2">
          <FilterChip
            label={t('inventory.low_stock')}
            isActive={!!filters?.isLowStock}
            onPress={handleLowStockToggle}
            testID={`${testID}-low-stock`}
          />
        </View>
      </View>

      {/* Sort Options */}
      <View>
        <Text className="mb-2 text-sm font-medium text-charcoal-950 dark:text-white">
          {t('inventory.sort_by')}
        </Text>
        <View className="gap-2">
          {SORT_FIELDS.map(({ value, label }) => {
            const isActive = sortOptions?.field === value;
            const direction = isActive ? sortOptions.direction : 'asc';

            return (
              <Pressable
                key={value}
                onPress={() => handleSortFieldChange(value)}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                testID={`${testID}-sort-${value}`}
                className={`flex-row items-center justify-between rounded-lg border p-3 ${
                  isActive
                    ? 'dark:bg-primary-950 border-primary-600 bg-primary-50'
                    : 'border-neutral-300 bg-white dark:border-neutral-600 dark:bg-charcoal-900'
                }`}
              >
                <Text
                  className={`text-sm font-medium ${
                    isActive
                      ? 'text-primary-600 dark:text-primary-400'
                      : 'text-charcoal-950 dark:text-white'
                  }`}
                >
                  {label}
                </Text>
                {isActive && (
                  <Text
                    className="text-sm text-primary-600 dark:text-primary-400"
                    testID={`${testID}-sort-direction-${value}`}
                  >
                    {direction === 'asc' ? '↑' : '↓'}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}
