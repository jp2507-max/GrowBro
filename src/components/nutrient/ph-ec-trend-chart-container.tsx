import React from 'react';

import { Button, Select, View } from '@/components/ui';
import { translate } from '@/lib';

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

const TIME_RANGE_OPTIONS = [
  { label: '7 days', value: '7' },
  { label: '30 days', value: '30' },
  { label: '90 days', value: '90' },
  { label: 'All', value: 'all' },
];

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
      <View className="mb-4 flex-row items-center justify-between px-4">
        <Select
          options={TIME_RANGE_OPTIONS}
          value={timeRange}
          onSelect={(value) => setTimeRange(String(value))}
          label={translate('nutrient.time_range')}
          testID={safeBase ? `${safeBase}.timeRange` : undefined}
        />
        <View className="flex-row gap-2">
          {onExportCSV && (
            <Button
              label="CSV"
              onPress={onExportCSV}
              variant="outline"
              size="sm"
              testID={safeBase ? `${safeBase}.exportCSV` : undefined}
            />
          )}
          {onExportJSON && (
            <Button
              label="JSON"
              onPress={onExportJSON}
              variant="outline"
              size="sm"
              testID={safeBase ? `${safeBase}.exportJSON` : undefined}
            />
          )}
        </View>
      </View>
      <PhEcTrendChart
        readings={filteredReadings}
        events={events}
        phRange={phRange}
        ecRange={ecRange}
        testID={safeBase ? `${safeBase}.chart` : undefined}
      />
    </View>
  );
}
