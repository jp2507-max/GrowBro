import { FlashList } from '@shopify/flash-list';
import { DateTime } from 'luxon';
import React from 'react';

import { Text, View } from '@/components/ui';

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
  testID?: string;
};

function ReadingRow({
  reading,
  phRange,
  ecRange,
}: {
  reading: Reading;
  phRange: { min: number; max: number };
  ecRange: { min: number; max: number };
}): React.ReactElement {
  const dateTime = DateTime.fromMillis(reading.timestamp);
  const phInRange = reading.ph >= phRange.min && reading.ph <= phRange.max;
  const ecInRange = reading.ec >= ecRange.min && reading.ec <= ecRange.max;

  return (
    <View className="mb-2 flex-row items-center justify-between rounded-lg border border-neutral-200 bg-white p-3">
      <View>
        <Text className="text-xs text-neutral-500">
          {dateTime.toFormat('MMM dd, yyyy')}
        </Text>
        <Text className="text-xs text-neutral-400">
          {dateTime.toFormat('HH:mm')}
        </Text>
      </View>
      <View className="flex-row gap-4">
        <View className="items-end">
          <Text className="text-xs text-neutral-500">pH</Text>
          <Text
            className={`text-base font-semibold ${phInRange ? 'text-success-600' : 'text-warning-600'}`}
          >
            {reading.ph.toFixed(1)}
          </Text>
        </View>
        <View className="items-end">
          <Text className="text-xs text-neutral-500">EC</Text>
          <Text
            className={`text-base font-semibold ${ecInRange ? 'text-success-600' : 'text-warning-600'}`}
          >
            {reading.ec.toFixed(1)}
          </Text>
        </View>
      </View>
    </View>
  );
}

export function PhEcTrendChart({
  readings,
  events: _events,
  phRange,
  ecRange,
  testID,
}: Props): React.ReactElement {
  if (readings.length === 0) {
    return (
      <View className="items-center justify-center p-8" testID={testID}>
        <Text className="text-center text-base text-neutral-600">
          No readings available
        </Text>
        <Text className="mt-1 text-center text-sm text-neutral-500">
          Start logging pH and EC to see trends
        </Text>
      </View>
    );
  }

  return (
    <View testID={testID} className="flex-1">
      <View className="mb-3 rounded-lg bg-neutral-50 p-3">
        <Text className="mb-1 text-xs font-medium text-neutral-600">
          Target Ranges
        </Text>
        <View className="flex-row gap-4">
          <Text className="text-sm text-neutral-700">
            pH: {phRange.min.toFixed(1)}–{phRange.max.toFixed(1)}
          </Text>
          <Text className="text-sm text-neutral-700">
            EC: {ecRange.min.toFixed(1)}–{ecRange.max.toFixed(1)} mS/cm
          </Text>
        </View>
      </View>
      <FlashList
        data={readings}
        renderItem={({ item }) => (
          <ReadingRow reading={item} phRange={phRange} ecRange={ecRange} />
        )}
        className="px-4"
      />
    </View>
  );
}
