/**
 * Inventory List Screen
 *
 * Main inventory management screen with FlashList v2 optimized rendering.
 * Displays all inventory items with current stock levels, low-stock indicators,
 * and category filtering.
 *
 * Performance budget:
 * - <300ms load time for 1,000+ items
 * - 60fps scrolling on mid-tier Android devices
 *
 * Requirements: 1.1, 1.3, 4.2
 */

import { useScrollToTop } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { InventoryList } from '@/components/inventory/inventory-list';
import { Button, FocusAwareStatusBar, Text, View } from '@/components/ui';
import { useInventoryItems } from '@/lib/inventory/use-inventory-items';

export default function InventoryScreen(): React.ReactElement {
  const { t } = useTranslation();
  const router = useRouter();
  const listRef = React.useRef<any>(null);

  useScrollToTop(listRef);

  const { items, isLoading, error, refetch, lowStockCount } =
    useInventoryItems();

  const handleAddItem = React.useCallback(() => {
    router.push('/inventory/add');
  }, [router]);

  const handleViewLowStock = React.useCallback(() => {
    router.push('/inventory/low-stock');
  }, [router]);

  const handleItemPress = React.useCallback(
    (itemId: string) => {
      router.push(`/inventory/${itemId}`);
    },
    [router]
  );

  return (
    <View className="flex-1" testID="inventory-screen">
      <FocusAwareStatusBar />

      {/* Header */}
      <View className="border-b border-neutral-200 bg-white px-4 pb-3 pt-4 dark:border-charcoal-700 dark:bg-charcoal-900">
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-charcoal-950 dark:text-white">
            {t('inventory.title')}
          </Text>
          <Button
            onPress={handleAddItem}
            variant="default"
            size="sm"
            testID="add-item-button"
          >
            {t('inventory.add_item')}
          </Button>
        </View>

        {lowStockCount > 0 && (
          <Button
            onPress={handleViewLowStock}
            variant="ghost"
            size="sm"
            className="mt-2"
            testID="low-stock-button"
          >
            <View className="flex-row items-center gap-2">
              <View className="size-2 rounded-full bg-warning-500" />
              <Text className="text-sm text-warning-700 dark:text-warning-400">
                {t('inventory.low_stock_count', { count: lowStockCount })}
              </Text>
            </View>
          </Button>
        )}
      </View>

      {/* List */}
      <InventoryList
        ref={listRef}
        items={items}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
        onItemPress={handleItemPress}
      />
    </View>
  );
}
