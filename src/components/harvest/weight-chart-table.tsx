/**
 * Weight Chart Table Fallback
 *
 * Tabular view shown when chart rendering fails
 * Requirement: 4.6 (fallback view)
 */

import { FlashList } from '@shopify/flash-list';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Text } from '@/components/ui';
import { formatWeight } from '@/lib/harvest/weight-conversion';
import type { ChartDataPoint, HarvestStage } from '@/types/harvest';

type Props = {
  data: ChartDataPoint[];
  testID?: string;
};

type TableRow = {
  id: string;
  date: string;
  weight: string;
  stage: string;
};

/**
 * Table fallback for chart rendering errors
 * Requirement 4.6
 */
export function WeightChartTable({ data, testID }: Props) {
  const { t } = useTranslation();

  const tableData: TableRow[] = data.map((point, index) => ({
    id: `${point.date.getTime()}-${index}`,
    date: formatDate(point.date),
    weight: formatWeight(point.weight_g),
    stage: t(`harvest.stages.${point.stage as HarvestStage}`),
  }));

  return (
    <View testID={testID} className="flex-1">
      {/* Header */}
      <View className="mb-2 flex-row border-b border-neutral-300 pb-2 dark:border-neutral-700">
        <Text className="flex-1 text-sm font-semibold text-charcoal-950 dark:text-neutral-100">
          {t('harvest.chart.table.date')}
        </Text>
        <Text className="flex-1 text-sm font-semibold text-charcoal-950 dark:text-neutral-100">
          {t('harvest.chart.table.weight')}
        </Text>
        <Text className="flex-1 text-sm font-semibold text-charcoal-950 dark:text-neutral-100">
          {t('harvest.chart.table.stage')}
        </Text>
      </View>

      {/* Data rows using FlashList v2 */}
      <FlashList
        data={tableData}
        renderItem={({ item }) => <TableRowItem item={item} />}
        testID="table-list"
      />
    </View>
  );
}

/**
 * Table row component
 */
function TableRowItem({ item }: { item: TableRow }) {
  return (
    <View className="flex-row border-b border-neutral-200 py-2 dark:border-neutral-800">
      <Text className="flex-1 text-sm text-charcoal-950 dark:text-neutral-100">
        {item.date}
      </Text>
      <Text className="flex-1 text-sm text-charcoal-950 dark:text-neutral-100">
        {item.weight}
      </Text>
      <Text className="flex-1 text-sm text-charcoal-950 dark:text-neutral-100">
        {item.stage}
      </Text>
    </View>
  );
}

/**
 * Format date for table display
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
