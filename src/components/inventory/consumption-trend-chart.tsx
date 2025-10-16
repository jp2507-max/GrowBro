import { DateTime } from 'luxon';
import { useColorScheme } from 'nativewind';
import React, { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';

import { colors, Text } from '@/components/ui';
import type { ConsumptionDataPoint } from '@/lib/inventory/use-inventory-item-forecast';

type ConsumptionTrendChartProps = {
  data: ConsumptionDataPoint[];
  /** Optional prediction interval from SES forecasting [lower, upper] */
  predictionInterval?: [number, number];
  /** Next stockout date from forecast */
  stockoutDate?: Date | null;
  testID?: string;
};

/**
 * Group consumption data by week and calculate weekly totals
 */
function groupByWeek(data: ConsumptionDataPoint[]): Map<string, number> {
  const weeklyData = new Map<string, number>();
  data.forEach(({ timestamp, quantityUsed }) => {
    const dateTime = DateTime.fromMillis(timestamp);
    const weekStart = dateTime.startOf('week');
    const weekKey = weekStart.toISODate();
    weeklyData.set(weekKey, (weeklyData.get(weekKey) || 0) + quantityUsed);
  });
  return weeklyData;
}

/**
 * Format date for chart labels
 */
function formatWeekLabel(weekStart: string): string {
  const dateTime = DateTime.fromJSDate(new Date(weekStart));
  return dateTime.toLocaleString({
    month: 'numeric',
    day: 'numeric',
  });
}

/**
 * Prepare chart configuration
 */
function prepareChartConfig(
  data: ConsumptionDataPoint[],
  isDark: boolean
): any {
  if (data.length === 0) return null;

  const weeklyData = groupByWeek(data);
  const sortedWeeks = Array.from(weeklyData.entries()).sort(
    ([a], [b]) => new Date(a).getTime() - new Date(b).getTime()
  );
  const recentWeeks = sortedWeeks.slice(-8);

  const chartData = recentWeeks.map(([weekStart, value]) => ({
    value,
    label: formatWeekLabel(weekStart),
    dataPointText: `${value.toFixed(1)}`,
  }));

  return {
    data: chartData,
    width: 320,
    height: 200,
    color: colors.primary[600],
    thickness: 2.5,
    startFillColor: colors.primary[600],
    endFillColor: colors.primary[200],
    startOpacity: 0.4,
    endOpacity: 0.1,
    areaChart: true,
    yAxisColor: isDark ? colors.neutral[700] : colors.neutral[300],
    xAxisColor: isDark ? colors.neutral[700] : colors.neutral[300],
    yAxisTextStyle: {
      color: isDark ? colors.neutral[400] : colors.charcoal[600],
    },
    xAxisLabelTextStyle: {
      color: isDark ? colors.neutral[400] : colors.charcoal[600],
      fontSize: 10,
    },
    noOfSections: 4,
    maxValue:
      chartData.length > 0
        ? Math.max(...chartData.map((d) => d.value)) * 1.1
        : 100,
    hideDataPoints: chartData.length > 10,
    dataPointsColor: colors.primary[600],
    dataPointsRadius: 4,
    curved: true,
    isAnimated: true,
    animationDuration: 800,
  };
}

/**
 * Line chart showing consumption trends over time (weekly buckets).
 * Visualizes usage patterns to help predict future consumption.
 * Displays 80% prediction intervals when using SES forecasting.
 *
 * @see Requirements 6.2 (Consumption trends with 80% prediction interval)
 * @see Requirements 6.5 (Consumption forecasting visualization)
 */
const ConsumptionTrendChartComponent = ({
  data,
  predictionInterval,
  stockoutDate,
  testID = 'consumption-trend-chart',
}: ConsumptionTrendChartProps) => {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const chartConfig = useMemo(
    () => prepareChartConfig(data, isDark),
    [data, isDark]
  );

  if (data.length === 0 || !chartConfig) {
    return (
      <View
        className="rounded-xl bg-neutral-50 p-4 dark:bg-charcoal-900"
        testID={testID}
      >
        <Text className="text-sm text-charcoal-600 dark:text-neutral-400">
          {t('inventory.charts.noConsumptionData')}
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
          {t('inventory.charts.consumptionTrend')}
        </Text>
        <Text className="text-xs text-charcoal-600 dark:text-neutral-400">
          {t('inventory.charts.weekly')}
        </Text>
      </View>

      <LineChart {...chartConfig} />

      <Text className="mt-2 text-xs text-charcoal-600 dark:text-neutral-400">
        {t('inventory.charts.consumptionNote')}
      </Text>

      {predictionInterval && (
        <View className="dark:bg-primary-950 mt-3 rounded-lg bg-primary-50 p-3">
          <Text className="font-inter-medium text-xs text-primary-800 dark:text-primary-200">
            {t('inventory.charts.predictionInterval')}:{' '}
            {predictionInterval[0].toFixed(1)} -{' '}
            {predictionInterval[1].toFixed(1)}{' '}
            {t('inventory.charts.unitsPerWeek')}
          </Text>
          {stockoutDate && (
            <Text className="mt-1 text-xs text-primary-700 dark:text-primary-300">
              {t('inventory.charts.predictedStockout')}:{' '}
              {new Date(stockoutDate).toLocaleDateString()}
            </Text>
          )}
        </View>
      )}
    </View>
  );
};

/**
 * Memoized chart component to prevent unnecessary re-renders
 */
export const ConsumptionTrendChart = memo(ConsumptionTrendChartComponent);
