/**
 * Inventory List Component
 *
 * High-performance FlashList v2 implementation for rendering 1,000+ inventory items.
 * Uses stable keys, getItemType, and memoized row rendering for optimal performance.
 *
 * Performance targets:
 * - <300ms load time for 1,000+ items
 * - 60fps scrolling on mid-tier Android devices
 *
 * Requirements: 1.1, 1.3
 */

import { FlashList, type ListRenderItemInfo } from '@shopify/flash-list';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable } from 'react-native';

import { InventoryListItem } from '@/components/inventory/inventory-list-item';
import { Text, View } from '@/components/ui';
import type { InventoryItemWithStock } from '@/types/inventory';

interface InventoryListProps {
  items: InventoryItemWithStock[];
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  onItemPress?: (itemId: string) => void;
  testID?: string;
}

const keyExtractor = (item: InventoryItemWithStock) => item.id;
const getItemType = () => 'inventory-item';

/**
 * Empty state component
 */
function InventoryEmptyState(): React.ReactElement {
  const { t } = useTranslation();

  return (
    <View
      className="flex-1 items-center justify-center px-6 py-12"
      testID="inventory-empty-state"
    >
      <Text className="text-center text-lg font-semibold text-charcoal-950 dark:text-white">
        {t('inventory.empty_title')}
      </Text>
      <Text className="mt-2 text-center text-sm text-neutral-600 dark:text-neutral-300">
        {t('inventory.empty_description')}
      </Text>
    </View>
  );
}

/**
 * Error state component
 */
function InventoryErrorState({
  error,
  onRetry,
}: {
  error: Error;
  onRetry?: () => void;
}): React.ReactElement {
  const { t } = useTranslation();

  return (
    <View
      className="flex-1 items-center justify-center px-6 py-12"
      testID="inventory-error-state"
    >
      <Text className="text-center text-lg font-semibold text-danger-600 dark:text-danger-400">
        {t('inventory.error_title')}
      </Text>
      <Text className="mt-2 text-center text-sm text-neutral-600 dark:text-neutral-300">
        {error.message}
      </Text>
      {onRetry && (
        <Pressable
          accessibilityRole="button"
          onPress={onRetry}
          className="mt-4 rounded-lg bg-primary-600 px-4 py-2"
          testID="retry-button"
        >
          <Text className="text-sm font-medium text-white">
            {t('common.retry')}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

/**
 * InventoryList component with FlashList v2 optimizations
 */
export const InventoryList = React.forwardRef<any, InventoryListProps>(
  function InventoryList(
    {
      items,
      isLoading,
      error,
      onRetry,
      onItemPress,
      testID = 'inventory-list',
    },
    ref
  ): React.ReactElement {
    const renderItem = React.useCallback(
      ({ item }: ListRenderItemInfo<InventoryItemWithStock>) => (
        <InventoryListItem item={item} onPress={onItemPress} />
      ),
      [onItemPress]
    );

    // Loading state
    if (isLoading && items.length === 0) {
      return (
        <View className="flex-1 items-center justify-center">
          <Text className="text-sm text-neutral-600 dark:text-neutral-300">
            Loading...
          </Text>
        </View>
      );
    }

    // Error state
    if (error && items.length === 0) {
      return <InventoryErrorState error={error} onRetry={onRetry} />;
    }

    // Empty state
    if (items.length === 0) {
      return <InventoryEmptyState />;
    }

    return (
      <FlashList
        ref={ref}
        data={items}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        getItemType={getItemType}
        testID={testID}
        className="py-2"
      />
    );
  }
);
