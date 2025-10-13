/**
 * Feeding Event Card Component
 *
 * Displays a single feeding event with targets and nutrients.
 * Compact card design for use in schedule timeline.
 */

import { DateTime } from 'luxon';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Text, View } from '@/components/ui';
import type { FeedingEvent } from '@/lib/nutrient-engine/services/schedule-service';

interface FeedingEventCardProps {
  event: FeedingEvent;
  testID?: string;
}

export function FeedingEventCard({
  event,
  testID = 'feeding-event-card',
}: FeedingEventCardProps) {
  const { t } = useTranslation();

  const scheduledDate = DateTime.fromMillis(event.scheduledDate).toFormat(
    'MMM dd, yyyy'
  );

  const phaseLabel = t(`nutrient.phase.${event.phase.phase}`);

  return (
    <View
      className="mb-3 rounded-lg border border-neutral-200 bg-white p-3 dark:border-charcoal-800 dark:bg-charcoal-900"
      testID={`${testID}-${event.id}`}
    >
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          {phaseLabel}
        </Text>
        <Text className="text-xs text-neutral-600 dark:text-neutral-400">
          {scheduledDate}
        </Text>
      </View>

      <View className="gap-1">
        <Text className="text-xs text-neutral-700 dark:text-neutral-300">
          pH: {event.targetPhMin.toFixed(1)} - {event.targetPhMax.toFixed(1)}
        </Text>
        <Text className="text-xs text-neutral-700 dark:text-neutral-300">
          EC: {event.targetEcMin25c.toFixed(2)} -{' '}
          {event.targetEcMax25c.toFixed(2)} mS/cm @25°C
        </Text>
      </View>

      {event.measurementCheckpoint && (
        <View className="dark:bg-warning-950 mt-2 rounded-md bg-warning-50 px-2 py-1">
          <Text className="text-xs text-warning-700 dark:text-warning-300">
            ⚠️ {t('nutrient.measurementCheckpoint')}
          </Text>
        </View>
      )}
    </View>
  );
}
