/**
 * Harvest Chart Container
 *
 * Container component with filtering, error handling, and fallback
 * Requirements: 4.3 (filtering), 4.4 (batch view), 4.5 (empty states), 4.6 (fallback)
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ActivityIndicator, Button, Text } from '@/components/ui';
import {
  aggregateByDate,
  filterByPlant,
  filterByTimeRange,
} from '@/lib/harvest/chart-data-utils';
import type { ChartDataPoint, TimeRange } from '@/types/harvest';

import { WeightChart } from './weight-chart';
import { WeightChartEmpty } from './weight-chart-empty';
import { WeightChartTable } from './weight-chart-table';

type Props = {
  data: ChartDataPoint[];
  plantId?: string;
  onCreateHarvest?: () => void;
  isLoading?: boolean;
  testID?: string;
};

/**
 * Container with filtering and error handling
 * Requirements: 4.3, 4.4, 4.5, 4.6
 */

export function HarvestChartContainer({
  data,
  plantId,
  onCreateHarvest,
  isLoading,
  testID,
}: Props) {
  const { t } = useTranslation();
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [showBatchView, setShowBatchView] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Apply filters (Requirements 4.3, 4.4)
  const filteredData = useMemo(() => {
    let result = data;

    // Plant filter (Requirement 4.3)
    if (plantId && !showBatchView) {
      result = filterByPlant(result, plantId);
    }

    // Batch aggregation (Requirement 4.4)
    if (showBatchView) {
      result = aggregateByDate(result);
    }

    // Time range filter
    result = filterByTimeRange(result, timeRange);

    return result;
  }, [data, plantId, showBatchView, timeRange]);

  // Reset error state when filter inputs change to retry chart rendering
  useEffect(() => {
    setHasError(false);
  }, [data, plantId, showBatchView, timeRange]);

  // Loading state
  if (isLoading) {
    return (
      <View testID={testID} className="items-center justify-center p-8">
        <ActivityIndicator />
      </View>
    );
  }

  // Empty state (Requirement 4.5)
  if (data.length === 0) {
    return (
      <WeightChartEmpty
        variant="no-data"
        onCreateHarvest={onCreateHarvest}
        testID={`${testID}-empty`}
      />
    );
  }

  // Filtered empty state
  if (filteredData.length === 0) {
    return (
      <WeightChartEmpty
        variant="filtered"
        testID={`${testID}-filtered-empty`}
      />
    );
  }

  return (
    <View testID={testID} className="flex-1">
      {/* Filter Controls */}
      <View className="mb-4 flex-row items-center justify-between px-4">
        <TimeRangeSelector
          value={timeRange}
          onChange={setTimeRange}
          testID={`${testID}-time-range`}
        />

        {!plantId && (
          <Button
            label={
              showBatchView
                ? t('harvest.chart.filters.individual_view')
                : t('harvest.chart.filters.batch_view')
            }
            onPress={() => setShowBatchView(!showBatchView)}
            variant="outline"
            size="sm"
            testID={`${testID}-batch-toggle`}
          />
        )}
      </View>

      {/* Chart or Table Fallback (Requirement 4.6) */}
      {hasError ? (
        <View className="p-4">
          <Text className="mb-4 text-center text-sm text-danger-600 dark:text-danger-400">
            {t('harvest.chart.error.render_failed')}
          </Text>
          <WeightChartTable data={filteredData} testID={`${testID}-table`} />
        </View>
      ) : (
        <WeightChart
          data={filteredData}
          onError={() => setHasError(true)}
          testID={`${testID}-chart`}
        />
      )}
    </View>
  );
}

/**
 * Time range selector component
 */
function TimeRangeSelector({
  value,
  onChange,
  testID,
}: {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
  testID?: string;
}) {
  const { t } = useTranslation();
  const ranges: TimeRange[] = ['7d', '30d', '90d', '365d', 'all'];

  return (
    <View testID={testID} className="flex-row gap-2">
      {ranges.map((range) => (
        <Button
          key={range}
          label={t(`harvest.chart.time_range.${range}`)}
          onPress={() => onChange(range)}
          variant={value === range ? 'default' : 'outline'}
          size="sm"
          testID={`${testID}-${range}`}
        />
      ))}
    </View>
  );
}
