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

import React, { useMemo } from 'react';
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
 * WeightChart component with LTTB downsampling
 * Requirement 4.1, 4.2
 */
export function WeightChart({ data, onError, testID }: Props) {
  const { t } = useTranslation();

  // Apply LTTB downsampling for performance (Requirement 4.2)
  const chartData = useMemo(() => prepareChartData(data), [data]);

  // Error boundary
  if (chartData.length === 0) {
    return null;
  }

  try {
    return (
      <View testID={testID} className="p-4">
        <Text className="mb-4 text-lg font-semibold text-charcoal-950 dark:text-neutral-100">
          {t('chart.title')}
        </Text>
        <LineChart {...getChartConfig(chartData)} />
      </View>
    );
  } catch (error) {
    // Requirement 4.6: Error handling
    if (onError) {
      onError(error as Error);
    }
    return null;
  }
}

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

/**
 * Get LineChart configuration
 */
function getChartConfig(chartData: any[]) {
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
