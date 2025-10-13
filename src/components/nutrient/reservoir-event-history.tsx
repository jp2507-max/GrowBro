import { FlashList } from '@shopify/flash-list';
import { DateTime } from 'luxon';
import React from 'react';

import { Text, View } from '@/components/ui';
import { translate } from '@/lib';
import type { ReservoirEvent } from '@/lib/nutrient-engine/types';

type Props = {
  events: ReservoirEvent[];
  testID?: string;
};

export function ReservoirEventHistory({
  events,
  testID,
}: Props): React.ReactElement {
  const renderEvent = ({ item }: { item: ReservoirEvent }) => {
    const dateTime = DateTime.fromMillis(item.createdAt);
    const dateStr = dateTime.toFormat('MMM dd, yyyy');
    const timeStr = dateTime.toFormat('HH:mm');

    return (
      <View className="mb-3 rounded-lg border border-neutral-200 bg-white p-3">
        <View className="flex-row items-start justify-between">
          <View className="flex-1">
            <Text className="text-base font-semibold text-neutral-900">
              {item.kind}
            </Text>
            {(item.deltaPh !== undefined && item.deltaPh !== 0) ||
            (item.deltaEc25c !== undefined && item.deltaEc25c !== 0) ? (
              <View className="mt-1 flex-row gap-3">
                {item.deltaPh !== undefined && item.deltaPh !== 0 && (
                  <Text className="text-sm text-neutral-600">
                    pH: {item.deltaPh > 0 ? '+' : ''}
                    {item.deltaPh.toFixed(1)}
                  </Text>
                )}
                {item.deltaEc25c !== undefined && item.deltaEc25c !== 0 && (
                  <Text className="text-sm text-neutral-600">
                    EC: {item.deltaEc25c > 0 ? '+' : ''}
                    {item.deltaEc25c.toFixed(1)} mS/cm
                  </Text>
                )}
              </View>
            ) : null}
            {item.note && (
              <Text className="mt-2 text-xs text-neutral-500">{item.note}</Text>
            )}
          </View>
        </View>
        <Text className="mt-2 text-xs text-neutral-400">
          {dateStr} • {timeStr}
        </Text>
      </View>
    );
  };

  if (events.length === 0) {
    return (
      <View className="items-center justify-center p-8" testID={testID}>
        <Text className="text-center text-base text-neutral-600">
          {translate('nutrient.no_events_title')}
        </Text>
        <Text className="mt-1 text-center text-sm text-neutral-500">
          {translate('nutrient.no_events_description')}
        </Text>
      </View>
    );
  }

  return (
    <FlashList
      data={events}
      renderItem={renderEvent}
      className="px-4"
      testID={testID}
    />
  );
}
