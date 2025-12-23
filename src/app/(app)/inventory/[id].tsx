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
import { ConsumptionTrendChart } from '@/components/inventory/consumption-trend-chart';
import { ReorderRecommendationCard } from '@/components/inventory/reorder-recommendation-card';
import { Button, FocusAwareStatusBar, Text, View } from '@/components/ui';
import { useInventoryItemDetail } from '@/lib/inventory/use-inventory-item-detail';
import { useInventoryItemForecast } from '@/lib/inventory/use-inventory-item-forecast';

export default function InventoryItemDetailScreen(): React.ReactElement {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { item, batches, isLoading, error, refetch } =
    useInventoryItemDetail(id);

  const {
    consumptionHistory,
    reorderRecommendation,
    isLoading: forecastLoading,
  } = useInventoryItemForecast(id);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text className="text-sm text-neutral-600 dark:text-neutral-400">
          {t('common.loading')}
        </Text>
      </View>
    );
  }

  if (error || !item) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-lg font-semibold text-danger-600">
          {t('harvest.inventory.error_title')}
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
          <Text className="text-2xl font-bold text-charcoal-900 dark:text-neutral-100">
            {item.name}
          </Text>
          <Text className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            {item.category} • {item.unitOfMeasure}
          </Text>
        </View>

        {/* Stock Info */}
        <View className="border-b border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-charcoal-900">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-sm text-neutral-500 dark:text-neutral-400">
                {t('harvest.inventory.current_stock')}
              </Text>
              <Text className="mt-1 text-3xl font-bold text-neutral-900 dark:text-neutral-100">
                {item.currentStock} {item.unitOfMeasure}
              </Text>
            </View>
            <View>
              <Text className="text-sm text-neutral-500 dark:text-neutral-400">
                {t('harvest.inventory.total_value')}
              </Text>
              <Text className="mt-1 text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                ${(item.totalValue / 100).toFixed(2)}
              </Text>
            </View>
          </View>
        </View>

        {/* Consumption Trends */}
        {!forecastLoading && consumptionHistory.length > 0 && (
          <View className="mt-4 border-b border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-charcoal-900">
            <Text className="mb-3 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              {t('harvest.inventory.charts.consumptionTrend')}
            </Text>
            <ConsumptionTrendChart data={consumptionHistory} />
          </View>
        )}

        {/* Reorder Recommendation */}
        {!forecastLoading && reorderRecommendation && item && (
          <View className="mt-4 px-4">
            <ReorderRecommendationCard
              recommendation={reorderRecommendation}
              unitOfMeasure={item.unitOfMeasure}
            />
          </View>
        )}

        {/* Batches */}
        <View className="mt-4 px-4">
          <Text className="mb-3 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            {t('harvest.inventory.batches_title')}
          </Text>
          <BatchList batches={batches} itemId={id} />
        </View>
      </ScrollView>
    </View>
  );
}
