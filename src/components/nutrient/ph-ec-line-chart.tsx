/**
 * pH/EC Line Chart Component
 *
 * Interactive trend visualization for pH and EC readings with target band overlays
 * and event markers. Follows the pattern from harvest WeightChart with performance
 * optimizations and accessibility.
 *
 * Requirements:
 * - 12.1: pH/EC trend charts with target bands and event annotations
 * - 2.5: Timeline charts with reservoir event annotations
 * - 7.3: Export functionality for trend data
 * - 15.4: Performance optimization with memoization
 */

/* eslint-disable max-lines-per-function */

import React, { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';

import { colors, Text } from '@/components/ui';
import {
  lttbDownsample,
  shouldDownsample,
} from '@/lib/harvest/lttb-downsample';

type Reading = {
  ph: number;
  ec: number;
  timestamp: number;
};

type EventMarker = {
  type: string;
  timestamp: number;
};

type ChartPoint = {
  value: number;
  label: string;
  dataPointText: string;
  timestamp: number;
};

type Props = {
  readings: Reading[];
  events?: EventMarker[];
  metric: 'ph' | 'ec';
  targetMin: number;
  targetMax: number;
  onError?: (error: Error) => void;
  testID?: string;
};

/**
 * Main chart component with performance optimizations
 */
const PhEcLineChartComponent = ({
  readings,
  events = [],
  metric,
  targetMin,
  targetMax,
  onError,
  testID,
}: Props) => {
  const { t } = useTranslation();

  // Prepare chart data with LTTB downsampling
  const chartData: ChartPoint[] = useMemo(() => {
    if (readings.length === 0) return [];

    const startTime = performance.now();

    // Convert readings to chart format
    const points = readings.map((reading, index) => ({
      x: index,
      y: metric === 'ph' ? reading.ph : reading.ec,
      originalData: reading,
    }));

    // Apply downsampling if needed (threshold: 365 points)
    const processed = shouldDownsample(points.length)
      ? lttbDownsample(points, 365)
      : points;

    // Convert to LineChart format
    const chartPoints: ChartPoint[] = processed.map((point) => ({
      value: point.y,
      label: formatTimestamp(point.originalData.timestamp),
      dataPointText:
        metric === 'ph' ? point.y.toFixed(1) : `${point.y.toFixed(1)} mS/cm`,
      timestamp: point.originalData.timestamp,
    }));

    const duration = performance.now() - startTime;

    if (__DEV__ && readings.length > 100) {
      console.log(
        `[PhEcLineChart] Processed ${readings.length} → ${chartPoints.length} ${metric.toUpperCase()} points in ${duration.toFixed(2)}ms`
      );
    }

    return chartPoints;
  }, [readings, metric]);

  // Prepare event markers as reference lines
  const referenceLines = useMemo(() => {
    if (!events || events.length === 0) return [];

    return events
      .map((event) => {
        const eventIndex = chartData.findIndex(
          (r) => r.timestamp >= event.timestamp
        );
        if (eventIndex === -1) return null;

        return {
          index: eventIndex,
          color: colors.primary[400],
          thickness: 2,
          labelText: getEventIcon(event.type),
        };
      })
      .filter(Boolean);
  }, [events, chartData]);

  // Calculate chart bounds with target band
  const chartConfig = useMemo(() => {
    try {
      if (chartData.length === 0) return null;

      const values = chartData.map((d) => d.value);
      const dataMin = Math.min(...values);
      const dataMax = Math.max(...values);

      // Extend bounds to include target range
      const minValue = Math.min(dataMin, targetMin) * 0.95;
      const maxValue = Math.max(dataMax, targetMax) * 1.05;

      return {
        data: chartData,
        width: 320,
        height: 220,
        color: metric === 'ph' ? colors.warning[600] : colors.success[600],
        thickness: 2.5,
        startFillColor:
          metric === 'ph' ? colors.warning[400] : colors.success[400],
        endFillColor:
          metric === 'ph' ? colors.warning[100] : colors.success[100],
        startOpacity: 0.3,
        endOpacity: 0.05,
        areaChart: true,
        yAxisColor: colors.neutral[300],
        xAxisColor: colors.neutral[300],
        yAxisTextStyle: { color: colors.neutral[600], fontSize: 11 },
        xAxisLabelTextStyle: {
          color: colors.neutral[600],
          fontSize: 9,
          width: 60,
        },
        noOfSections: 5,
        minValue,
        maxValue,
        hideDataPoints: chartData.length > 50,
        dataPointsColor:
          metric === 'ph' ? colors.warning[600] : colors.success[600],
        dataPointsRadius: 3,
        curved: true,
        animateOnDataChange: true,
        animationDuration: 800,
        // Target band as horizontal rules
        horizontalRulesConfig: {
          rulesColor: colors.neutral[200],
          rulesThickness: 1,
        },
        // Add target band reference lines
        referenceLine1Position: targetMax,
        referenceLine1Config: {
          color: colors.primary[300],
          thickness: 1.5,
          dashWidth: 4,
          dashGap: 4,
          labelText: t('nutrient.target_max'),
          labelTextStyle: {
            color: colors.neutral[600],
            fontSize: 9,
          },
        },
        referenceLine2Position: targetMin,
        referenceLine2Config: {
          color: colors.primary[300],
          thickness: 1.5,
          dashWidth: 4,
          dashGap: 4,
          labelText: t('nutrient.target_min'),
          labelTextStyle: {
            color: colors.neutral[600],
            fontSize: 9,
          },
        },
        // Event markers
        ...(referenceLines.length > 0 && {
          verticalLinesConfig: referenceLines,
        }),
      };
    } catch (error) {
      if (onError) {
        onError(error as Error);
      }
      return null;
    }
  }, [chartData, targetMin, targetMax, metric, referenceLines, t, onError]);

  // Error boundary - early return for empty data
  if (readings.length === 0) {
    return (
      <View
        testID={testID ? `${testID}-empty` : 'ph-ec-chart-empty'}
        className="items-center justify-center rounded-lg border-2 border-dashed border-neutral-300 bg-neutral-50 p-8 dark:border-neutral-700 dark:bg-neutral-900"
      >
        <Text className="mb-2 text-center text-4xl">📊</Text>
        <Text className="text-center text-base text-neutral-600 dark:text-neutral-400">
          {t('nutrient.chart.no_data')}
        </Text>
        <Text className="mt-1 text-center text-sm text-neutral-500 dark:text-neutral-500">
          {t('nutrient.chart.start_logging')}
        </Text>
      </View>
    );
  }

  if (!chartConfig) return null;

  try {
    return (
      <View testID={testID} className="px-4 py-2">
        <View className="mb-3 flex-row items-center justify-between">
          <Text className="text-lg font-semibold text-charcoal-950 dark:text-neutral-100">
            {metric === 'ph' ? t('nutrient.ph_trend') : t('nutrient.ec_trend')}
          </Text>
          <View className="rounded-md bg-neutral-100 px-2 py-1 dark:bg-charcoal-800">
            <Text className="text-xs text-neutral-600 dark:text-neutral-400">
              {t('nutrient.target_range')}: {targetMin.toFixed(1)}–
              {targetMax.toFixed(1)}
            </Text>
          </View>
        </View>
        <LineChart {...chartConfig} />
        {events && events.length > 0 && (
          <View className="mt-2 rounded-md bg-primary-50 px-3 py-2 dark:bg-primary-950">
            <Text className="text-xs text-primary-700 dark:text-primary-300">
              {t('nutrient.chart.event_markers_note', {
                count: events.length,
              })}
            </Text>
          </View>
        )}
      </View>
    );
  } catch (error) {
    if (onError) {
      onError(error as Error);
    }
    return null;
  }
};

/**
 * Memoized export to prevent unnecessary re-renders
 */
export const PhEcLineChart = memo(PhEcLineChartComponent);

/**
 * Format timestamp for chart labels
 */
function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}/${day}`;
}

/**
 * Get emoji icon for event type
 */
function getEventIcon(eventType: string): string {
  const iconMap: Record<string, string> = {
    FILL: '💧',
    DILUTE: '🌊',
    ADD_NUTRIENT: '🧪',
    PH_UP: '⬆️',
    PH_DOWN: '⬇️',
    CHANGE: '🔄',
  };
  return iconMap[eventType] || '📝';
}
