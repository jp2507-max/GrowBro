/**
 * Cost Trend Chart Component
 *
 * Bar chart showing consumption costs by category over time.
 * Supports weekly and monthly bucketing.
 *
 * Requirements:
 * - 9.4: Cost analysis showing supply costs over time periods
 */

import { DateTime } from 'luxon';
import { useColorScheme } from 'nativewind';
import React, { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';

import { colors, Text } from '@/components/ui';
import type { TimeSerieCostData } from '@/lib/inventory/cost-analysis-service';

type CostTrendChartProps = {
  data: TimeSerieCostData[];
  bucketType: 'week' | 'month';
  testID?: string;
};

/**
 * Helper function to compute period key and start timestamp
 */
const getPeriodInfo = (date: Date, bucketType: 'week' | 'month') => {
  const dt = DateTime.fromJSDate(date);
  if (bucketType === 'week') {
    // Use ISO week format for stable period key
    const periodStart = dt.startOf('week');
    const periodKey = periodStart.toISODate()!;
    const label = `W${dt.weekNumber}`;
    return { periodKey, periodStart: periodStart.toMillis(), label };
  } else {
    // Use month format for stable period key
    const periodStart = dt.startOf('month');
    const periodKey = periodStart.toFormat('yyyy-MM');
    const label = dt.toFormat('MMM');
    return { periodKey, periodStart: periodStart.toMillis(), label };
  }
};

/**
 * Compute aggregated chart data from time series
 */
const computeChartData = (
  data: TimeSerieCostData[],
  bucketType: 'week' | 'month'
) => {
  if (data.length === 0) return [];

  // Aggregate all categories into single bars per period
  const periodMap = new Map<
    string,
    { label: string; value: number; periodStart: number }
  >();

  data.forEach((series) => {
    series.dataPoints.forEach((point) => {
      const { periodKey, periodStart, label } = getPeriodInfo(
        point.date,
        bucketType
      );
      const existing = periodMap.get(periodKey) ?? {
        label,
        value: 0,
        periodStart,
      };
      existing.value += point.costMinor / 100; // Convert to dollars
      periodMap.set(periodKey, existing);
    });
  });

  return Array.from(periodMap.values()).sort(
    (a, b) => a.periodStart - b.periodStart
  );
};

/**
 * Bar chart showing cost trends by category over time
 *
 * @example
 * ```tsx
 * <CostTrendChart
 *   data={timeSeries}
 *   bucketType="week"
 * />
 * ```
 */
const CostTrendChartComponent = ({
  data,
  bucketType,
  testID = 'cost-trend-chart',
}: CostTrendChartProps) => {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const chartData = useMemo(
    () => computeChartData(data, bucketType),
    [data, bucketType]
  );

  const maxValue = useMemo(() => {
    if (chartData.length === 0) return 100;
    return Math.max(...chartData.map((d) => d.value)) * 1.1;
  }, [chartData]);

  if (data.length === 0) {
    return (
      <View
        className="rounded-xl bg-neutral-50 p-4 dark:bg-charcoal-900"
        testID={testID}
      >
        <Text className="text-sm text-charcoal-600 dark:text-neutral-400">
          {t('inventory.charts.noCostData')}
        </Text>
      </View>
    );
  }

  return (
    <View
      className="rounded-xl bg-neutral-50 p-4 dark:bg-charcoal-900"
      testID={testID}
    >
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="font-inter-semibold text-base text-charcoal-900 dark:text-neutral-100">
          {t('inventory.charts.costTrend')}
        </Text>
        <Text className="text-xs text-charcoal-600 dark:text-neutral-400">
          {bucketType === 'week'
            ? t('inventory.charts.weekly')
            : t('inventory.charts.monthly')}
        </Text>
      </View>

      <BarChart
        data={chartData}
        width={320}
        height={200}
        barWidth={24}
        spacing={16}
        frontColor={colors.primary[600]}
        yAxisColor={isDark ? colors.neutral[700] : colors.neutral[300]}
        xAxisColor={isDark ? colors.neutral[700] : colors.neutral[300]}
        yAxisTextStyle={{
          color: isDark ? colors.neutral[400] : colors.charcoal[600],
        }}
        xAxisLabelTextStyle={{
          color: isDark ? colors.neutral[400] : colors.charcoal[600],
        }}
        noOfSections={4}
        maxValue={maxValue}
        isAnimated
        animationDuration={800}
      />

      <View className="mt-3 flex-row flex-wrap gap-2">
        <View className="flex-row items-center gap-1">
          <View
            className="size-3 rounded-sm"
            style={{
              backgroundColor: colors.primary[600],
            }}
          />
          <Text className="text-xs text-charcoal-600 dark:text-neutral-400">
            {t('inventory.charts.total')}
          </Text>
        </View>
      </View>

      <Text className="mt-2 text-xs text-charcoal-600 dark:text-neutral-400">
        {t('inventory.charts.costTrendNote')}
      </Text>
    </View>
  );
};

/**
 * Memoized chart component
 */
export const CostTrendChart = memo(CostTrendChartComponent);
