/**
 * Inventory Item Detail Screen
 *
 * Displays item details with batch list showing FEFO ordering
 * and expiration status pills.
 *
 * Requirements: 1.3, 2.2
 */

import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';

import { BatchList } from '@/components/inventory/batch-list';
import { Button, FocusAwareStatusBar, Text, View } from '@/components/ui';
import { useInventoryItemDetail } from '@/lib/inventory/use-inventory-item-detail';

export default function InventoryItemDetailScreen(): React.ReactElement {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { item, batches, isLoading, error, refetch } =
    useInventoryItemDetail(id);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text className="text-sm text-neutral-600 dark:text-neutral-300">
          {t('common.loading')}
        </Text>
      </View>
    );
  }

  if (error || !item) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-lg font-semibold text-danger-600">
          {t('inventory.error_title')}
        </Text>
        <Button onPress={refetch} variant="outline" className="mt-4">
          {t('common.retry')}
        </Button>
      </View>
    );
  }

  return (
    <View className="flex-1" testID="inventory-item-detail-screen">
      <FocusAwareStatusBar />
      <ScrollView className="flex-1">
        {/* Header */}
        <View className="border-b border-neutral-200 bg-white p-4 dark:border-charcoal-700 dark:bg-charcoal-900">
          <Text className="text-2xl font-bold text-charcoal-950 dark:text-white">
            {item.name}
          </Text>
          <Text className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            {item.category} • {item.unitOfMeasure}
          </Text>
        </View>

        {/* Stock Info */}
        <View className="border-b border-neutral-200 bg-white p-4 dark:border-charcoal-700 dark:bg-charcoal-900">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-sm text-neutral-600 dark:text-neutral-400">
                {t('inventory.current_stock')}
              </Text>
              <Text className="mt-1 text-3xl font-bold text-charcoal-950 dark:text-white">
                {item.currentStock} {item.unitOfMeasure}
              </Text>
            </View>
            <View>
              <Text className="text-sm text-neutral-600 dark:text-neutral-400">
                {t('inventory.total_value')}
              </Text>
              <Text className="mt-1 text-2xl font-bold text-charcoal-950 dark:text-white">
                ${(item.totalValue / 100).toFixed(2)}
              </Text>
            </View>
          </View>
        </View>

        {/* Batches */}
        <View className="mt-4 px-4">
          <Text className="mb-3 text-lg font-semibold text-charcoal-950 dark:text-white">
            {t('inventory.batches_title')}
          </Text>
          <BatchList batches={batches} itemId={id} />
        </View>
      </ScrollView>
    </View>
  );
}
