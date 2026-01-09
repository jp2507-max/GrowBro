/* eslint-disable max-lines-per-function */

import React from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Select, View } from '@/components/ui';

import { PhEcLineChart } from './ph-ec-line-chart';
import { PhEcTrendChart } from './ph-ec-trend-chart';

type Reading = {
  ph: number;
  ec: number;
  timestamp: number;
};

type EventMarker = {
  type: string;
  timestamp: number;
};

type Props = {
  readings: Reading[];
  events: EventMarker[];
  phRange: { min: number; max: number };
  ecRange: { min: number; max: number };
  onExportCSV?: () => void;
  onExportJSON?: () => void;
  testID?: string;
};

export function PhEcTrendChartContainer({
  readings,
  events,
  phRange,
  ecRange,
  onExportCSV,
  onExportJSON,
  testID,
}: Props): React.ReactElement {
  const safeBase = testID ? `${testID}` : undefined;
  const [timeRange, setTimeRange] = React.useState('30');
  const [viewMode, setViewMode] = React.useState<'chart' | 'list'>('chart');
  const [chartMetric, setChartMetric] = React.useState<'ph' | 'ec'>('ph');

  const { t } = useTranslation();

  const TIME_RANGE_OPTIONS = React.useMemo(
    () => [
      { label: t('nutrient.time_range.7days'), value: '7' },
      { label: t('nutrient.time_range.30days'), value: '30' },
      { label: t('nutrient.time_range.90days'), value: '90' },
      { label: t('nutrient.time_range.all'), value: 'all' },
    ],
    [t]
  );

  const now = Date.now();
  const filteredReadings =
    timeRange === 'all'
      ? readings
      : readings.filter((r) => {
          const daysAgo = parseInt(timeRange, 10);
          const cutoff = now - daysAgo * 24 * 60 * 60 * 1000;
          return r.timestamp >= cutoff;
        });

  return (
    <View className="flex-1" testID={testID}>
      {/* Controls Row */}
      <View className="mb-4 gap-3 px-4">
        {/* Time Range and Export */}
        <View className="flex-row items-center justify-between">
          <Select
            options={TIME_RANGE_OPTIONS}
            value={timeRange}
            onSelect={(value) => setTimeRange(String(value))}
            label={t('nutrient.time_range')}
            testID={safeBase ? `${safeBase}.timeRange` : undefined}
          />
          <View className="flex-row gap-2">
            {onExportCSV && (
              <Button
                label={t('nutrient.export.csv')}
                onPress={onExportCSV}
                variant="outline"
                size="sm"
                testID={safeBase ? `${safeBase}.exportCSV` : undefined}
              />
            )}
            {onExportJSON && (
              <Button
                label={t('nutrient.export.json')}
                onPress={onExportJSON}
                variant="outline"
                size="sm"
                testID={safeBase ? `${safeBase}.exportJSON` : undefined}
              />
            )}
          </View>
        </View>

        {/* View Mode Toggle */}
        <View className="flex-row items-center gap-2">
          <Button
            label={t('nutrient.view_chart')}
            onPress={() => setViewMode('chart')}
            variant={viewMode === 'chart' ? 'default' : 'outline'}
            size="sm"
            testID={safeBase ? `${safeBase}.viewChart` : undefined}
          />
          <Button
            label={t('nutrient.view_list')}
            onPress={() => setViewMode('list')}
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            testID={safeBase ? `${safeBase}.viewList` : undefined}
          />
          {viewMode === 'chart' && (
            <>
              <View className="mx-2 h-6 w-px bg-neutral-300 dark:bg-neutral-700" />
              <Button
                label={t('nutrient.metric.ph')}
                onPress={() => setChartMetric('ph')}
                variant={chartMetric === 'ph' ? 'default' : 'outline'}
                size="sm"
                testID={safeBase ? `${safeBase}.metricPh` : undefined}
              />
              <Button
                label={t('nutrient.metric.ec')}
                onPress={() => setChartMetric('ec')}
                variant={chartMetric === 'ec' ? 'default' : 'outline'}
                size="sm"
                testID={safeBase ? `${safeBase}.metricEc` : undefined}
              />
            </>
          )}
        </View>
      </View>

      {/* Content Area */}
      {viewMode === 'chart' ? (
        <PhEcLineChart
          readings={filteredReadings}
          events={events}
          metric={chartMetric}
          targetMin={chartMetric === 'ph' ? phRange.min : ecRange.min}
          targetMax={chartMetric === 'ph' ? phRange.max : ecRange.max}
          testID={safeBase ? `${safeBase}.lineChart` : undefined}
        />
      ) : (
        <PhEcTrendChart
          readings={filteredReadings}
          events={events}
          phRange={phRange}
          ecRange={ecRange}
          testID={safeBase ? `${safeBase}.listView` : undefined}
        />
      )}
    </View>
  );
}
