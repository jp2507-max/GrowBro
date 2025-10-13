import { FlashList } from '@shopify/flash-list';
import { DateTime } from 'luxon';
import React from 'react';
import { useTranslation } from 'react-i18next';

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

type TimelineItem = {
  type: 'reading' | 'event';
  timestamp: number;
  data: Reading | EventMarker;
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
  const { t } = useTranslation();
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
          <Text className="text-xs text-neutral-500">{t('nutrient.ph')}</Text>
          <Text
            className={`text-base font-semibold ${phInRange ? 'text-success-600' : 'text-warning-600'}`}
          >
            {reading.ph.toFixed(1)}
          </Text>
        </View>
        <View className="items-end">
          <Text className="text-xs text-neutral-500">
            {t('nutrient.ec_label')}
          </Text>
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

function EventMarkerRow({ event }: { event: EventMarker }): React.ReactElement {
  const { t } = useTranslation();
  const dateTime = DateTime.fromMillis(event.timestamp);

  // Map event types to display info
  const eventTypeMap: Record<
    string,
    { icon: string; label: string; color: string }
  > = {
    FILL: {
      icon: '💧',
      label: t('nutrient.eventTypes.fill'),
      color: 'text-primary-600',
    },
    DILUTE: {
      icon: '🌊',
      label: t('nutrient.eventTypes.dilute'),
      color: 'text-primary-500',
    },
    ADD_NUTRIENT: {
      icon: '🧪',
      label: t('nutrient.eventTypes.addNutrient'),
      color: 'text-success-600',
    },
    PH_UP: {
      icon: '⬆️',
      label: t('nutrient.eventTypes.phUp'),
      color: 'text-warning-600',
    },
    PH_DOWN: {
      icon: '⬇️',
      label: t('nutrient.eventTypes.phDown'),
      color: 'text-warning-600',
    },
    CHANGE: {
      icon: '🔄',
      label: t('nutrient.eventTypes.change'),
      color: 'text-neutral-600',
    },
  };

  const eventInfo = eventTypeMap[event.type] || {
    icon: '📝',
    label: event.type,
    color: 'text-neutral-600',
  };

  return (
    <View className="mb-2 rounded-lg border-l-4 border-primary-400 bg-primary-50 p-3">
      <View className="flex-row items-center gap-2">
        <Text className="text-base">{eventInfo.icon}</Text>
        <View className="flex-1">
          <Text className={`text-sm font-medium ${eventInfo.color}`}>
            {eventInfo.label}
          </Text>
          <Text className="text-xs text-neutral-500">
            {dateTime.toFormat('MMM dd, yyyy • HH:mm')}
          </Text>
        </View>
      </View>
    </View>
  );
}

function EmptyState({ testID }: { testID?: string }): React.ReactElement {
  const { t } = useTranslation();

  return (
    <View className="items-center justify-center p-8" testID={testID}>
      <Text className="text-center text-base text-neutral-600">
        {t('nutrient.no_readings')}
      </Text>
      <Text className="mt-1 text-center text-sm text-neutral-500">
        {t('nutrient.start_logging_ph_ec')}
      </Text>
    </View>
  );
}

function createTimelineItems(
  readings: Reading[],
  events: EventMarker[]
): TimelineItem[] {
  return [
    ...readings.map(
      (r): TimelineItem => ({
        type: 'reading',
        timestamp: r.timestamp,
        data: r,
      })
    ),
    ...events.map(
      (e): TimelineItem => ({ type: 'event', timestamp: e.timestamp, data: e })
    ),
  ].sort((a, b) => b.timestamp - a.timestamp); // Sort descending (most recent first)
}

export function PhEcTrendChart({
  readings,
  events,
  phRange,
  ecRange,
  testID,
}: Props): React.ReactElement {
  const { t } = useTranslation();

  if (readings.length === 0 && events.length === 0) {
    return <EmptyState testID={testID} />;
  }

  const timelineItems = createTimelineItems(readings, events);

  return (
    <View testID={testID} className="flex-1">
      <View className="mb-3 rounded-lg bg-neutral-50 p-3">
        <Text className="mb-1 text-xs font-medium text-neutral-600">
          {t('nutrient.targetRanges')}
        </Text>
        <View className="flex-row gap-4">
          <Text className="text-sm text-neutral-700">
            {t('nutrient.ph')}: {phRange.min.toFixed(1)}–
            {phRange.max.toFixed(1)}
          </Text>
          <Text className="text-sm text-neutral-700">
            {t('nutrient.ec')}: {ecRange.min.toFixed(1)}–
            {ecRange.max.toFixed(1)} {t('units.msPerCm')}
          </Text>
        </View>
      </View>
      <FlashList
        data={timelineItems}
        renderItem={({ item }) => {
          if (item.type === 'reading') {
            return (
              <ReadingRow
                reading={item.data as Reading}
                phRange={phRange}
                ecRange={ecRange}
              />
            );
          }
          return <EventMarkerRow event={item.data as EventMarker} />;
        }}
        keyExtractor={(item) => `${item.type}-${item.timestamp}`}
        getItemType={(item) => item.type}
        className="px-4"
      />
    </View>
  );
}
