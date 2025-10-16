/**
 * Inventory Valuation Summary Component
 *
 * Displays real-time inventory valuation with category breakdown.
 * Updates automatically when batches or movements change.
 *
 * Requirements:
 * - 9.2: Display total inventory value by category and overall with real-time updates
 * - 9.5: Cost analysis with category breakdowns
 */

import React from 'react';

import { ActivityIndicator, Text, View } from '@/components/ui';
import { formatValue } from '@/lib/inventory/inventory-valuation-service';
import { useInventoryValuation } from '@/lib/inventory/use-inventory-valuation';

/**
 * Component props
 */
export interface InventoryValuationSummaryProps {
  /** Show detailed category breakdown */
  showCategories?: boolean;

  /** Currency symbol */
  currency?: string;

  /** Custom empty state message */
  emptyMessage?: string;

  /** Test ID for testing */
  testID?: string;
}

/**
 * Inventory valuation summary component
 *
 * Displays current inventory value with category breakdown.
 * Uses FIFO costing from batch-level costs.
 *
 * @example
 * ```tsx
 * <InventoryValuationSummary
 *   showCategories
 *   currency="$"
 * />
 * ```
 */
export function InventoryValuationSummary({
  showCategories = true,
  currency = '$',
  emptyMessage = 'No inventory items',
  testID = 'inventory-valuation-summary',
}: InventoryValuationSummaryProps) {
  const { valuation, isLoading, error } = useInventoryValuation();

  if (isLoading) {
    return (
      <View className="p-4" testID={`${testID}-loading`}>
        <ActivityIndicator size="small" />
      </View>
    );
  }

  if (error) {
    return (
      <View className="p-4" testID={`${testID}-error`}>
        <Text className="text-danger-600">{error.message}</Text>
      </View>
    );
  }

  if (!valuation || valuation.itemCount === 0) {
    return (
      <View className="p-4" testID={`${testID}-empty`}>
        <Text className="text-neutral-500">{emptyMessage}</Text>
      </View>
    );
  }

  const totalValue = formatValue(valuation.totalValueMinor, currency);

  return (
    <View className="p-4" testID={testID}>
      {/* Total Value Header */}
      <View className="mb-4">
        <Text className="text-sm text-neutral-600 dark:text-neutral-400">
          Total Inventory Value
        </Text>
        <Text
          className="text-3xl font-semibold text-charcoal-900 dark:text-neutral-100"
          testID={`${testID}-total-value`}
        >
          {totalValue}
        </Text>
        <Text className="text-xs text-neutral-500">
          {valuation.itemCount} items • {valuation.batchCount} batches
        </Text>
      </View>

      {/* Category Breakdown */}
      {showCategories && valuation.categories.length > 0 && (
        <View className="gap-2" testID={`${testID}-categories`}>
          <Text className="mb-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
            By Category
          </Text>

          {valuation.categories.map((category) => {
            const categoryValue = formatValue(
              category.totalValueMinor,
              currency
            );
            const percentage = Math.round(
              (category.totalValueMinor / valuation.totalValueMinor) * 100
            );

            return (
              <View
                key={category.category}
                className="flex-row items-center justify-between rounded-lg bg-neutral-50 p-3 dark:bg-charcoal-800"
                testID={`${testID}-category-${category.category}`}
              >
                <View className="flex-1">
                  <Text className="font-medium text-charcoal-900 dark:text-neutral-100">
                    {category.category}
                  </Text>
                  <Text className="text-xs text-neutral-500">
                    {category.itemCount} items • {category.batchCount} batches
                  </Text>
                </View>

                <View className="items-end">
                  <Text
                    className="font-semibold text-charcoal-900 dark:text-neutral-100"
                    testID={`${testID}-category-${category.category}-value`}
                  >
                    {categoryValue}
                  </Text>
                  <Text className="text-xs text-neutral-500">
                    {percentage}%
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
