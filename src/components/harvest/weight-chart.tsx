/**
 * Weight Chart Component
 *
 * Displays harvest weight progression over time using line chart
 * with LTTB downsampling for performance optimization
 *
 * Requirements:
 * - 4.1: Line chart display
 * - 4.2: Performance optimization with downsampling
 * - 4.6: Error handling with fallback
 * - 15.1-15.4: Performance validation
 */

import React, { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';

import { colors, Text } from '@/components/ui';
import {
  lttbDownsample,
  shouldDownsample,
} from '@/lib/harvest/lttb-downsample';
import type { ChartDataPoint } from '@/types/harvest';

type Props = {
  data: ChartDataPoint[];
  onError?: (error: Error) => void;
  testID?: string;
};

/**
 * WeightChart component with LTTB downsampling and performance optimizations
 * Requirements: 4.1, 4.2, 15.1, 15.4
 *
 * Performance optimizations:
 * - React.memo to prevent unnecessary re-renders
 * - useMemo for expensive data transformations
 * - LTTB downsampling for datasets > 365 points
 * - Memoized chart configuration
 */
const WeightChartComponent = ({ data, onError, testID }: Props) => {
  const { t } = useTranslation();

  // Apply LTTB downsampling for performance (Requirement 4.2, 15.2)
  // Hooks must be called unconditionally before any early returns
  const chartData = useMemo(() => {
    if (data.length === 0) return [];

    const startTime = performance.now();
    const result = prepareChartData(data);
    const duration = performance.now() - startTime;

    // Log performance in dev mode
    if (__DEV__ && data.length > 100) {
      console.log(
        `[WeightChart] Processed ${data.length} → ${result.length} points in ${duration.toFixed(2)}ms`
      );
    }

    return result;
  }, [data]);

  // Memoize chart config to prevent object recreation on every render
  const chartConfig = useMemo(() => getChartConfig(chartData), [chartData]);

  // Error boundary - early return for empty data
  if (data.length === 0) {
    return null;
  }

  try {
    return (
      <View testID={testID} className="p-4">
        <Text className="mb-4 text-lg font-semibold text-charcoal-950 dark:text-neutral-100">
          {t('harvest.chart.title')}
        </Text>
        <LineChart {...chartConfig} />
      </View>
    );
  } catch (error) {
    // Requirement 4.6: Error handling
    if (onError) {
      onError(error as Error);
    }
    return null;
  }
};

/**
 * Memoized WeightChart to prevent unnecessary re-renders
 * Requirements: 15.4 (performance optimization)
 */
export const WeightChart = memo(WeightChartComponent);

/**
 * Prepare chart data with LTTB downsampling
 */
function prepareChartData(data: ChartDataPoint[]) {
  if (data.length === 0) return [];

  // Convert to format expected by LTTB algorithm
  const points = data.map((point, index) => ({
    x: index,
    y: point.weight_g,
    originalData: point,
  }));

  // Apply downsampling if needed (threshold: 365 points)
  const processed = shouldDownsample(points.length)
    ? lttbDownsample(points, 365)
    : points;

  // Convert to LineChart format
  return processed.map((point) => ({
    value: point.y,
    label: formatDate(point.originalData.date),
    dataPointText: `${Math.round(point.y)}g`,
  }));
}

type LineChartDataPoint = {
  value: number;
  label: string;
  dataPointText: string;
};

/**
 * Get LineChart configuration
 */
function getChartConfig(chartData: LineChartDataPoint[]) {
  return {
    data: chartData,
    width: 320,
    height: 200,
    color: colors.primary[600],
    thickness: 2,
    startFillColor: colors.primary[600],
    endFillColor: colors.primary[200],
    startOpacity: 0.4,
    endOpacity: 0.1,
    areaChart: true,
    yAxisColor: colors.neutral[300],
    xAxisColor: colors.neutral[300],
    yAxisTextStyle: { color: colors.neutral[600] },
    xAxisLabelTextStyle: { color: colors.neutral[600], fontSize: 10 },
    noOfSections: 4,
    maxValue: Math.max(...chartData.map((d) => d.value)) * 1.1,
    hideDataPoints: chartData.length > 50,
    dataPointsColor: colors.primary[600],
    dataPointsRadius: 3,
    curved: true,
    isAnimated: true,
    animationDuration: 800,
  };
}

/**
 * Format date for chart labels
 */
function formatDate(date: Date): string {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}/${day}`;
}
