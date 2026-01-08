import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { useFetchReadings } from '@/api/ph-ec-readings';
import { PhEcReadingList } from '@/components/nutrient/ph-ec-reading-list';
import { Button, Text, View } from '@/components/ui';
import type { PhEcReading } from '@/lib/nutrient-engine/types';

/**
 * Nutrient Readings Screen
 *
 * Displays pH/EC reading history with ability to add new readings.
 * Accepts optional `plantId` query param to filter readings by plant.
 *
 * Requirements: 2.1, 2.5, 6.2
 */
export default function NutrientReadingsScreen(): React.ReactElement {
  const { t } = useTranslation();
  const router = useRouter();
  const { plantId } = useLocalSearchParams<{ plantId?: string }>();

  const { data, isLoading, error } = useFetchReadings({
    limit: 100,
    plantId: plantId ?? undefined,
  });

  const handleAddReading = useCallback(() => {
    const params = plantId ? `?plantId=${plantId}` : '';
    router.push(`/nutrient/add-reading${params}`);
  }, [router, plantId]);

  const handleSelectReading = useCallback(
    (reading: PhEcReading) => {
      router.push(`/nutrient/${reading.id}`);
    },
    [router]
  );

  return (
    <View className="flex-1 bg-white dark:bg-charcoal-950">
      <View className="flex-1">
        {/* Header */}
        <View className="border-b border-neutral-200 p-4 dark:border-charcoal-700">
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">
                {t('nutrient.reading_history')}
              </Text>
              {data && data.total > 0 && (
                <Text className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                  {data.total}{' '}
                  {t('nutrient.readings_count', { count: data.total })}
                </Text>
              )}
            </View>

            <Button
              label={t('nutrient.add_reading')}
              onPress={handleAddReading}
              size="sm"
              testID="add-reading-button"
            />
          </View>
        </View>

        {/* Error State */}
        {error && (
          <View className="flex-1 items-center justify-center p-4">
            <Text className="text-center text-danger-600">
              {t('nutrient.load_error')}
            </Text>
            <Text className="mt-2 text-center text-sm text-neutral-500">
              {error.message}
            </Text>
          </View>
        )}

        {/* List */}
        {!error && (
          <PhEcReadingList
            readings={data?.data || []}
            isLoading={isLoading}
            onSelect={handleSelectReading}
          />
        )}
      </View>
    </View>
  );
}
