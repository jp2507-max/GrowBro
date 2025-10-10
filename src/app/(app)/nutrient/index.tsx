import { useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { useFetchReadings } from '@/api/ph-ec-readings';
import { PhEcReadingList } from '@/components/nutrient/ph-ec-reading-list';
import { Button, SafeAreaView, Text, View } from '@/components/ui';
import type { PhEcReading } from '@/lib/nutrient-engine/types';

/**
 * Nutrient Readings Screen
 *
 * Displays pH/EC reading history with ability to add new readings
 * Requirements: 2.1, 2.5, 6.2
 */
export default function NutrientReadingsScreen(): React.ReactElement {
  const { t } = useTranslation();
  const router = useRouter();

  const { data, isLoading, error } = useFetchReadings({
    variables: { limit: 100 },
  });

  const handleAddReading = useCallback(() => {
    router.push('/nutrient/add-reading');
  }, [router]);

  const handleSelectReading = useCallback((reading: PhEcReading) => {
    // TODO: Navigate to reading detail screen
    console.log('Selected reading:', reading.id);
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1">
        {/* Header */}
        <View className="border-b border-neutral-200 p-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-2xl font-bold text-neutral-900">
                {t('nutrient.reading_history')}
              </Text>
              {data && data.total > 0 && (
                <Text className="mt-1 text-sm text-neutral-600">
                  {data.total} {data.total === 1 ? 'reading' : 'readings'}
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
              Failed to load readings
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
    </SafeAreaView>
  );
}
