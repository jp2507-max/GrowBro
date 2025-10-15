/**
 * Inventory List Item Component
 *
 * Memoized row component for FlashList v2 performance.
 * Displays item name, category, stock level, and low-stock indicators.
 *
 * Requirements: 1.1, 1.3, 4.2
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable } from 'react-native';

import { Text, View } from '@/components/ui';
import type { InventoryItemWithStock } from '@/types/inventory';

interface InventoryListItemProps {
  item: InventoryItemWithStock;
  onPress?: (itemId: string) => void;
}

/**
 * Category badge component
 */
function CategoryBadge({ category }: { category: string }): React.ReactElement {
  return (
    <View className="rounded-md bg-neutral-100 px-2 py-1 dark:bg-charcoal-800">
      <Text className="text-xs text-neutral-700 dark:text-neutral-300">
        {category}
      </Text>
    </View>
  );
}

/**
 * Low stock indicator
 */
function LowStockIndicator(): React.ReactElement {
  const { t } = useTranslation();

  return (
    <View className="flex-row items-center gap-1">
      <View className="size-2 rounded-full bg-warning-500" />
      <Text className="text-xs font-medium text-warning-700 dark:text-warning-400">
        {t('inventory.low_stock')}
      </Text>
    </View>
  );
}

/**
 * Memoized inventory list item for optimal FlashList performance
 */
export const InventoryListItem = React.memo<InventoryListItemProps>(
  function InventoryListItem({ item, onPress }) {
    const { t } = useTranslation();

    const handlePress = React.useCallback(() => {
      onPress?.(item.id);
    }, [item.id, onPress]);

    return (
      <Pressable
        accessibilityRole="button"
        onPress={handlePress}
        testID={`inventory-item-${item.id}`}
        className="mx-4 mb-2 rounded-xl border border-neutral-200 bg-white p-4 active:bg-neutral-50 dark:border-charcoal-700 dark:bg-charcoal-800 dark:active:bg-charcoal-700"
      >
        <View className="flex-row items-start justify-between">
          {/* Left: Name and category */}
          <View className="flex-1">
            <Text className="text-base font-semibold text-charcoal-950 dark:text-white">
              {item.name}
            </Text>
            <View className="mt-2">
              <CategoryBadge category={item.category} />
            </View>
          </View>

          {/* Right: Stock info */}
          <View className="ml-4 items-end">
            <Text className="text-lg font-bold text-charcoal-950 dark:text-white">
              {item.currentStock.toFixed(1)}
            </Text>
            <Text className="text-xs text-neutral-600 dark:text-neutral-400">
              {item.unitOfMeasure}
            </Text>
            {item.isLowStock && (
              <View className="mt-1">
                <LowStockIndicator />
              </View>
            )}
          </View>
        </View>

        {/* Bottom: Value and min stock */}
        <View className="mt-3 flex-row items-center justify-between border-t border-neutral-100 pt-3 dark:border-charcoal-700">
          <Text className="text-xs text-neutral-600 dark:text-neutral-400">
            {t('inventory.total_value')}: ${(item.totalValue / 100).toFixed(2)}
          </Text>
          <Text className="text-xs text-neutral-600 dark:text-neutral-400">
            {t('inventory.min_stock')}: {item.minStock} {item.unitOfMeasure}
          </Text>
        </View>
      </Pressable>
    );
  }
);
