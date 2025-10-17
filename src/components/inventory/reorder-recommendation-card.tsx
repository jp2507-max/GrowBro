import React from 'react';
import { useTranslation } from 'react-i18next';

import { Text, View } from '@/components/ui';
import type { ReorderRecommendation } from '@/lib/inventory/types/forecasting';

type ReorderRecommendationCardProps = {
  recommendation: ReorderRecommendation | null;
  unitOfMeasure: string;
  testID?: string;
};

/**
 * Card displaying reorder recommendation with forecast confidence.
 * Shows recommended reorder quantity, timing, and prediction confidence level.
 *
 * @see Requirements 6.3, 6.5, 6.6 (Forecasting with confidence intervals)
 */
export function ReorderRecommendationCard({
  recommendation,
  unitOfMeasure,
  testID = 'reorder-recommendation-card',
}: ReorderRecommendationCardProps) {
  const { t } = useTranslation();

  if (!recommendation) {
    return null;
  }

  const { quantity, reorderByDate, confidence } = recommendation;

  // Determine confidence pill color
  const confidenceColor =
    confidence === 'high'
      ? 'bg-success-100 dark:bg-success-900/20'
      : confidence === 'medium'
        ? 'bg-warning-100 dark:bg-warning-900/20'
        : 'bg-danger-100 dark:bg-danger-900/20';

  const confidenceTextColor =
    confidence === 'high'
      ? 'text-success-700 dark:text-success-300'
      : confidence === 'medium'
        ? 'text-warning-700 dark:text-warning-300'
        : 'text-danger-700 dark:text-danger-300';

  const confidenceLabel =
    confidence === 'high'
      ? t('inventory.forecast.highConfidence')
      : confidence === 'medium'
        ? t('inventory.forecast.mediumConfidence')
        : t('inventory.forecast.lowConfidence');

  // Calculate days until reorder
  const daysUntilReorder = Math.ceil(
    (reorderByDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  return (
    <View
      className="rounded-xl bg-primary-50 p-4 dark:bg-primary-900/10"
      testID={testID}
    >
      <View className="mb-3 flex-row items-start justify-between">
        <View className="flex-1">
          <Text className="font-inter-semibold text-base text-charcoal-900 dark:text-neutral-100">
            {t('inventory.forecast.reorderRecommendation')}
          </Text>
          <Text className="mt-1 text-sm text-charcoal-700 dark:text-neutral-300">
            {t('inventory.forecast.basedOnUsagePattern')}
          </Text>
        </View>

        {/* Confidence pill */}
        <View className={`rounded-full px-2.5 py-1 ${confidenceColor}`}>
          <Text
            className={`font-inter-semibold text-xs ${confidenceTextColor}`}
          >
            {confidenceLabel}
          </Text>
        </View>
      </View>

      {/* Recommendation details */}
      <View className="gap-3">
        {/* Reorder quantity */}
        <View className="flex-row items-center justify-between">
          <Text className="text-sm text-charcoal-700 dark:text-neutral-300">
            {t('inventory.forecast.recommendedQuantity')}
          </Text>
          <Text className="font-inter-semibold text-base text-primary-700 dark:text-primary-300">
            {quantity} {unitOfMeasure}
          </Text>
        </View>

        {/* Days until reorder */}
        <View className="flex-row items-center justify-between">
          <Text className="text-sm text-charcoal-700 dark:text-neutral-300">
            {t('inventory.forecast.timeToReorder')}
          </Text>
          <Text className="font-inter-semibold text-base text-charcoal-900 dark:text-neutral-100">
            {daysUntilReorder > 0
              ? t('inventory.forecast.inDays', { days: daysUntilReorder })
              : t('inventory.forecast.reorderNow')}
          </Text>
        </View>
      </View>

      {/* Low confidence note */}
      {confidence === 'low' && (
        <View className="mt-3 rounded-lg bg-warning-50 p-2.5 dark:bg-warning-900/10">
          <Text className="text-xs text-warning-800 dark:text-warning-200">
            {t('inventory.forecast.lowConfidenceNote')}
          </Text>
        </View>
      )}
    </View>
  );
}
