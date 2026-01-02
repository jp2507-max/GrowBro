/**
 * Low Stock List Screen
 *
 * Displays inventory items that are at or below minimum stock threshold,
 * sorted by days-to-zero forecast then percentage below threshold.
 *
 * Requirements: 4.2, 4.3
 */

import { useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { InventoryList } from '@/components/inventory/inventory-list';
import { Button, FocusAwareStatusBar, Text, View } from '@/components/ui';
import { useInventoryItems } from '@/lib/inventory/use-inventory-items';

/**
 * Calculate days until zero stock based on consumption forecast
 * TODO: Implement actual forecasting in Task 8
 */
function calculateDaysToZero(
  currentStock: number,
  minStock: number
): number | null {
  // Placeholder: Simple linear calculation
  // Real implementation will use 8-week SMA or exponential smoothing
  if (currentStock <= 0) return 0;
  if (currentStock <= minStock) {
    // Estimate based on how far below threshold
    const deficit = minStock - currentStock;
    return Math.max(1, Math.floor((currentStock / (deficit + 1)) * 7));
  }
  return null;
}

/**
 * Calculate percentage below threshold
 */
function calculatePercentageBelow(
  currentStock: number,
  minStock: number
): number {
  if (minStock === 0) return 0;
  return ((minStock - currentStock) / minStock) * 100;
}

export default function LowStockScreen(): React.ReactElement {
  const { t } = useTranslation();
  const router = useRouter();

  const { items, isLoading, error, refetch } = useInventoryItems();

  // Filter and sort low stock items
  const lowStockItems = React.useMemo(() => {
    const filtered = items.filter((item) => item.isLowStock);

    // Sort by days-to-zero (ascending), then percentage below threshold (descending)
    return filtered.sort((a, b) => {
      const aDays = calculateDaysToZero(a.currentStock, a.minStock);
      const bDays = calculateDaysToZero(b.currentStock, b.minStock);

      // Items with lower days-to-zero (more urgent) come first
      if (aDays !== null && bDays !== null) {
        if (aDays !== bDays) return aDays - bDays;
      } else if (aDays !== null) {
        return -1; // a has forecast, b doesn't
      } else if (bDays !== null) {
        return 1; // b has forecast, a doesn't
      }

      // If days are equal or both null, sort by percentage below threshold
      const aPercent = calculatePercentageBelow(a.currentStock, a.minStock);
      const bPercent = calculatePercentageBelow(b.currentStock, b.minStock);
      return bPercent - aPercent; // Higher percentage = more urgent
    });
  }, [items]);

  const handleItemPress = React.useCallback(
    (itemId: string) => {
      router.push(`/inventory/${itemId}`);
    },
    [router]
  );

  return (
    <View className="flex-1" testID="low-stock-screen">
      <FocusAwareStatusBar />

      {/* Header */}
      <View className="border-b border-neutral-200 bg-white px-4 pb-3 pt-4 dark:border-charcoal-700 dark:bg-charcoal-900">
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-2xl font-bold text-charcoal-900 dark:text-neutral-100">
              {t('inventory.low_stock')}
            </Text>
            {lowStockItems.length > 0 && (
              <Text className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                {t('inventory.low_stock_count', {
                  count: lowStockItems.length,
                })}
              </Text>
            )}
          </View>
          <Button
            onPress={() => router.back()}
            variant="ghost"
            size="sm"
            testID="back-button"
          >
            {t('common.back')}
          </Button>
        </View>

        {/* Info Banner */}
        <View className="mt-3 rounded-lg bg-warning-50 p-3 dark:bg-warning-900/20">
          <Text className="text-xs text-warning-700 dark:text-warning-400">
            {t('inventory.low_stock_info')}
          </Text>
        </View>
      </View>

      {/* List */}
      <InventoryList
        items={lowStockItems}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
        onItemPress={handleItemPress}
      />
    </View>
  );
}
