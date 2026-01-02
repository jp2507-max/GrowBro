/**
 * Cost Breakdown Card Component
 *
 * Displays cost analysis by category or time period with proper
 * currency formatting from integer minor units.
 *
 * Requirements:
 * - 9.4: Display quantity and cost with preserved batch valuation
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

import { Text, View } from '@/components/ui';
import type { CategoryCostSummary } from '@/lib/inventory/cost-analysis-service';
import { formatCost } from '@/lib/inventory/cost-analysis-service';

type CostBreakdownCardProps = {
  categorySummaries: CategoryCostSummary[];
  testID?: string;
};

/**
 * Card displaying cost breakdown by category
 *
 * @example
 * ```tsx
 * <CostBreakdownCard categorySummaries={summaries} />
 * ```
 */
export const CostBreakdownCard = ({
  categorySummaries,
  testID = 'cost-breakdown-card',
}: CostBreakdownCardProps): React.JSX.Element => {
  const { t } = useTranslation();

  // Calculate total cost
  const totalCostMinor = categorySummaries.reduce(
    (sum, cat) => sum + cat.totalCostMinor,
    0
  );

  // Sort by cost descending
  const sortedCategories = [...categorySummaries].sort(
    (a, b) => b.totalCostMinor - a.totalCostMinor
  );

  if (categorySummaries.length === 0) {
    return (
      <View
        className="rounded-xl bg-neutral-50 p-4 dark:bg-charcoal-900"
        testID={testID}
      >
        <Text className="text-sm text-charcoal-600 dark:text-neutral-400">
          {t('inventory.costBreakdown.noData')}
        </Text>
      </View>
    );
  }

  return (
    <View
      className="rounded-xl bg-neutral-50 p-4 dark:bg-charcoal-900"
      testID={testID}
    >
      <Text className="font-inter-semibold mb-3 text-base text-charcoal-900 dark:text-neutral-100">
        {t('inventory.costBreakdown.title')}
      </Text>

      <View className="mb-4 rounded-lg bg-primary-50 p-3 dark:bg-primary-950">
        <Text className="text-xs text-primary-700 dark:text-primary-300">
          {t('inventory.costBreakdown.totalCost')}
        </Text>
        <Text className="font-inter-bold mt-1 text-2xl text-primary-800 dark:text-primary-200">
          {formatCost(totalCostMinor)}
        </Text>
      </View>

      <View className="gap-3">
        {sortedCategories.map((category) => {
          const percentage =
            totalCostMinor > 0
              ? (category.totalCostMinor / totalCostMinor) * 100
              : 0;

          return (
            <View key={category.category} className="gap-1">
              <View className="flex-row items-center justify-between">
                <Text className="font-inter-medium text-sm text-charcoal-800 dark:text-neutral-200">
                  {category.category}
                </Text>
                <Text className="font-inter-semibold text-sm text-charcoal-900 dark:text-neutral-100">
                  {formatCost(category.totalCostMinor)}
                </Text>
              </View>

              <View className="flex-row items-center gap-2">
                <View className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-200 dark:bg-charcoal-800">
                  <View
                    className="h-full rounded-full bg-primary-600"
                    style={{ width: `${percentage}%` }}
                  />
                </View>
                <Text className="w-12 text-right text-xs text-charcoal-600 dark:text-neutral-400">
                  {percentage.toFixed(0)}%
                </Text>
              </View>

              <Text className="text-xs text-charcoal-600 dark:text-neutral-400">
                {category.itemCount} {t('inventory.costBreakdown.items')} •{' '}
                {category.movementCount}{' '}
                {t('inventory.costBreakdown.movements')} •{' '}
                {category.totalQuantity.toFixed(1)}{' '}
                {t('inventory.costBreakdown.units')}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};
